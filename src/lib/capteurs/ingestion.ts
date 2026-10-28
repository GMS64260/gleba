/**
 * Enregistrement des trames normalisées d'un connecteur. Tout ce qui est écrit
 * appartient au propriétaire DU CONNECTEUR (celui du jeton), quel que soit
 * l'identifiant annoncé dans l'envoi : un DevEUI ne fait pas entrer une mesure
 * chez quelqu'un d'autre.
 *
 * Doublons : clé unique capteur + grandeur + instant (`skipDuplicates`). Un
 * webhook TTN ou ChirpStack rejoué porte le même instant réseau et n'écrit
 * rien. Un envoi générique SANS `mesureeA` prend l'instant de réception : le
 * renvoyer écrit une seconde mesure (le guide de l'écran le dit).
 */
import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import type { TrameNormalisee } from "./adaptateurs"
import { consommerBudgets } from "./budget"
import { CLES_MAX, CLES_POSITION, lireCorrespondances, resoudreMesures, type RefusMesure } from "./decodage"

/** Une mesure datée de plus de 5 min dans le futur vient d'une horloge fausse. */
const AVANCE_MAX_MS = 5 * 60 * 1000
/** Rattrapage accepté (format générique) ; au-delà, la mesure serait déjà agrégée. */
const RETARD_MAX_MS = 7 * 24 * 3600 * 1000
/** Un connecteur ne crée pas de capteurs à l'infini (identifiants libres du format générique). */
export const MAX_CAPTEURS_PAR_CONNECTEUR = 200
const MAX_REFUS_GARDES = 10
/**
 * Mesures écrites par compte et par quart d'heure, tous connecteurs confondus,
 * comptées APRÈS résolution : les clés inconnues ou ignorées d'un décodeur
 * bavard n'entament pas le budget. Une ferme de 50 capteurs à 4 grandeurs
 * toutes les 5 min en écrit 600.
 */
export const MESURES_MAX_PAR_COMPTE = 3000
export const FENETRE_BUDGET_MS = 15 * 60 * 1000

export interface BilanIngestion {
  /** Budget de mesures du compte épuisé : trames suivantes non traitées. */
  limite: { reessayerDansS: number } | null
  trames: number
  mesures: number
  doublons: number
  refusees: number
  inconnues: string[]
  avertissements: string[]
}

interface RefusDate extends RefusMesure {
  a: string
}

function lireRefus(brut: unknown): RefusDate[] {
  return Array.isArray(brut) ? (brut as RefusDate[]).slice(0, MAX_REFUS_GARDES) : []
}

const SELECTION = { id: true, modele: true, correspondances: true, clesInconnues: true, clesRecues: true, refus: true } as const

/** Le capteur de la trame, créé à sa première trame ; null si le plafond du connecteur est atteint. */
async function capteurDe(connecteur: { id: string; userId: string }, trame: TrameNormalisee) {
  const ou = { connecteurId_identifiantExterne: { connecteurId: connecteur.id, identifiantExterne: trame.identifiantExterne } }
  const existant = await prisma.capteur.findUnique({ where: ou, select: SELECTION })
  if (existant) return existant
  if ((await prisma.capteur.count({ where: { connecteurId: connecteur.id } })) >= MAX_CAPTEURS_PAR_CONNECTEUR) return null
  try {
    return await prisma.capteur.create({
      data: {
        userId: connecteur.userId,
        connecteurId: connecteur.id,
        identifiantExterne: trame.identifiantExterne,
        // Profil annoncé par le serveur de réseau, à la création seulement :
        // un choix fait ensuite à l'écran n'est jamais écrasé.
        modele: trame.modele,
      },
      select: SELECTION,
    })
  } catch (e) {
    // Deux premières trames simultanées du même capteur : l'autre l'a créé.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return prisma.capteur.findUniqueOrThrow({ where: ou, select: SELECTION })
    }
    throw e
  }
}

export async function ingererTrames(
  connecteur: { id: string; userId: string; type: string },
  trames: TrameNormalisee[],
  maintenant: Date = new Date(),
): Promise<BilanIngestion> {
  const bilan: BilanIngestion = { limite: null, trames: trames.length, mesures: 0, doublons: 0, refusees: 0, inconnues: [], avertissements: [] }
  const avertir = (texte: string) => {
    if (!bilan.avertissements.includes(texte)) bilan.avertissements.push(texte)
  }

  for (const trame of trames) {
    const capteur = await capteurDe(connecteur, trame)
    if (!capteur) {
      bilan.refusees += trame.valeurs.length
      avertir(`Plafond de ${MAX_CAPTEURS_PAR_CONNECTEUR} capteurs atteint pour ce connecteur : nouveaux capteurs refusés.`)
      continue
    }
    const ecart = trame.mesureeA.getTime() - maintenant.getTime()
    const horsFenetre =
      ecart > AVANCE_MAX_MS ? "date dans le futur (horloge du capteur ?)" : ecart < -RETARD_MAX_MS ? "date de plus de 7 jours" : null

    const resolution = resoudreMesures(trame.valeurs, {
      modele: capteur.modele,
      correspondances: lireCorrespondances(capteur.correspondances),
      nomsGleba: connecteur.type === "generique",
    })
    const refus: RefusMesure[] = horsFenetre
      ? resolution.mesures.map((m) => ({ cle: m.cle, valeur: m.valeur, raison: horsFenetre }))
      : resolution.refus
    const mesures = horsFenetre ? [] : resolution.mesures

    if (mesures.length > 0) {
      const budget = consommerBudgets(
        [{ cle: `mesures:${connecteur.userId}`, quantite: mesures.length, max: MESURES_MAX_PAR_COMPTE }],
        FENETRE_BUDGET_MS,
      )
      if (!budget.ok) {
        bilan.limite = { reessayerDansS: budget.reessayerDansS }
        break
      }
    }

    let enregistrees = 0
    if (mesures.length > 0) {
      const { count } = await prisma.mesureCapteur.createMany({
        data: mesures.map((m) => ({ capteurId: capteur.id, grandeur: m.grandeur, valeur: m.valeur, unite: m.unite, mesureeA: trame.mesureeA })),
        skipDuplicates: true,
      })
      enregistrees = count
    }
    bilan.mesures += enregistrees
    bilan.doublons += mesures.length - enregistrees
    bilan.refusees += refus.length
    for (const cle of resolution.inconnues) if (!bilan.inconnues.includes(cle)) bilan.inconnues.push(cle)
    if (trame.avertissement) avertir(trame.avertissement)

    const batterieMesuree = mesures.find((m) => m.grandeur === "batterie")?.valeur ?? null
    const clesTrame = trame.valeurs.map(([cle]) => cle).filter((cle) => !CLES_POSITION.has(cle))
    const clesRecues = [...new Set([...capteur.clesRecues, ...clesTrame])].slice(0, CLES_MAX)
    const inconnues = [...new Set([...capteur.clesInconnues, ...resolution.inconnues])].slice(0, CLES_MAX)
    const refusDates: RefusDate[] = refus.map((r) => ({ ...r, a: maintenant.toISOString() }))
    await prisma.capteur.update({
      where: { id: capteur.id },
      data: {
        derniereVueA: maintenant,
        // Le dernier avertissement reste affiché jusqu'à une trame qui produit des mesures.
        ...(trame.avertissement ? { avertissement: trame.avertissement } : mesures.length > 0 ? { avertissement: null } : {}),
        ...(trame.batterie !== null || batterieMesuree !== null ? { batterie: trame.batterie ?? batterieMesuree } : {}),
        ...(trame.rssi !== null ? { rssi: trame.rssi, snr: trame.snr } : {}),
        ...(trame.position ? { lat: trame.position.lat, lng: trame.position.lng } : {}),
        ...(clesTrame.length > 0 ? { clesRecues } : {}),
        ...(resolution.inconnues.length > 0 ? { clesInconnues: inconnues } : {}),
        ...(refusDates.length > 0
          ? { refus: [...refusDates, ...lireRefus(capteur.refus)].slice(0, MAX_REFUS_GARDES) as unknown as Prisma.InputJsonValue }
          : {}),
      },
    })
  }

  await prisma.connecteurCapteurs.update({ where: { id: connecteur.id }, data: { derniereReceptionA: maintenant } })
  return bilan
}
