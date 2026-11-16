/**
 * Import de l'historique climatique SAFRAN des mailles demandées.
 *
 * Une maille est demandée la première fois qu'une parcelle y tombe
 * (`historique.ts`). L'import lit alors en flux un fichier par année depuis
 * `PREMIERE_ANNEE_HISTORIQUE` (137 Mo compressés et une dizaine de secondes
 * chacun, rien n'est écrit sur disque) et n'en garde que les mailles demandées.
 * Chaque nuit, le fichier des 60 derniers jours complète l'année en cours.
 *
 * Un seul import à la fois, tous processus confondus : les mailles sont prises
 * sous bail (`verrouJeton`, `verrouJusqua`), renouvelé à chaque année lue. Un
 * processus tué en route laisse son bail expirer et un autre reprend.
 */

import { randomUUID } from "node:crypto"
import { Readable, pipeline } from "node:stream"
import type { ReadableStream as FluxWeb } from "node:stream/web"
import { createGunzip } from "node:zlib"
import prisma from "@/lib/prisma"
import { cleMaille } from "./grille-safran"
import {
  PREMIERE_ANNEE_SAFRAN,
  URL_RECENT_SAFRAN,
  creerLecteurSafran,
  fusionnerSerie,
  urlAnneeSafran,
  type SeriesSafran,
} from "./safran"

/** Première année importée : de quoi couvrir la normale de 30 ans avec de la marge. */
export const PREMIERE_ANNEE_HISTORIQUE = Math.max(PREMIERE_ANNEE_SAFRAN, 1991)
/** Années minimales pour déclarer une maille prête. */
const ANNEES_MIN_PRETE = 20
const BAIL_MS = 30 * 60_000
const DELAI_FICHIER_MS = 5 * 60_000
const TENTATIVES_MAX = 5
/** Au-delà, le fichier des 60 derniers jours ne suffit plus à combler le retard. */
const RETARD_MAX_RECENT_MS = 50 * 86_400_000

export const ETAT_DEMANDEE = "demandee"
export const ETAT_PRETE = "prete"
export const ETAT_ECHEC = "echec"

/** L'import se coupe par `GLEBA_AGROCLIMAT_IMPORT=false` (banc d'essai, hébergement sans sortie réseau). */
export function importAgroclimatActif(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.GLEBA_AGROCLIMAT_IMPORT !== "false"
}

/** Lignes d'un fichier SAFRAN compressé, ou `null` s'il n'existe pas (404). */
export type OuvrirFichier = (url: string) => Promise<AsyncIterable<string> | null>

/** Découpe un flux de texte en lignes, sans garder le fichier en mémoire. */
export async function* lignesDuFlux(flux: AsyncIterable<Buffer | string>): AsyncGenerator<string> {
  let reste = ""
  for await (const morceau of flux) {
    const texte = reste + (typeof morceau === "string" ? morceau : morceau.toString("utf8"))
    let debut = 0
    let fin = texte.indexOf("\n", debut)
    while (fin >= 0) {
      yield texte.charCodeAt(fin - 1) === 13 ? texte.slice(debut, fin - 1) : texte.slice(debut, fin)
      debut = fin + 1
      fin = texte.indexOf("\n", debut)
    }
    reste = texte.slice(debut)
  }
  if (reste !== "") yield reste
}

const ouvrirFichierDistant: OuvrirFichier = async (url) => {
  const reponse = await fetch(url, { signal: AbortSignal.timeout(DELAI_FICHIER_MS) })
  if (reponse.status === 404) return null
  if (!reponse.ok || !reponse.body) throw new Error(`SAFRAN : ${reponse.status} sur ${url}`)
  const decompression = createGunzip()
  // `pipeline` détruit la décompression si le téléchargement casse : la lecture
  // des lignes échoue alors au lieu d'attendre sans fin.
  pipeline(Readable.fromWeb(reponse.body as unknown as FluxWeb<Uint8Array>), decompression, () => {})
  return lignesDuFlux(decompression)
}

/** Séries des mailles demandées dans un fichier ; `null` si le fichier n'existe pas. */
export async function lireFichierSafran(
  url: string,
  mailles: ReadonlySet<string>,
  ouvrir: OuvrirFichier = ouvrirFichierDistant
): Promise<SeriesSafran | null> {
  const lignes = await ouvrir(url)
  if (lignes === null) return null
  const lecteur = creerLecteurSafran(mailles)
  for await (const ligne of lignes) lecteur.ligne(ligne)
  if (!lecteur.bilan().enteteLue) throw new Error(`SAFRAN : fichier vide sur ${url}`)
  return lecteur.series
}

/** Écrit les séries lues, en les superposant à ce qui est déjà stocké. Rend le nombre d'années écrites. */
async function enregistrerSeries(idParCle: ReadonlyMap<string, number>, series: SeriesSafran): Promise<number> {
  let ecrites = 0
  for (const [cle, parAnnee] of series) {
    const mailleId = idParCle.get(cle)
    if (mailleId === undefined) continue
    for (const [annee, serie] of parAnnee) {
      const existante = await prisma.climatMailleAnnee.findUnique({
        where: { mailleId_annee: { mailleId, annee } },
        select: { tmin: true, tmax: true },
      })
      const fusion = fusionnerSerie(existante, serie)
      await prisma.climatMailleAnnee.upsert({
        where: { mailleId_annee: { mailleId, annee } },
        create: { mailleId, annee, tmin: fusion.tmin, tmax: fusion.tmax },
        update: { tmin: fusion.tmin, tmax: fusion.tmax },
      })
      ecrites++
    }
  }
  return ecrites
}

function messageErreur(erreur: unknown): string {
  return (erreur instanceof Error ? erreur.message : String(erreur)).slice(0, 300)
}

export interface BilanImport {
  mailles: number
  annees: number
}

let importEnCours = false

/**
 * Importe l'historique complet des mailles en attente. Sans effet s'il n'y en a
 * pas ou si un import tourne déjà. Compter cinq à six minutes pour 35 ans.
 */
export async function importerMaillesDemandees(
  options: { ouvrir?: OuvrirFichier; maintenant?: Date } = {}
): Promise<BilanImport> {
  const vide = { mailles: 0, annees: 0 }
  if (!importAgroclimatActif() || importEnCours) return vide
  importEnCours = true
  const jeton = randomUUID()
  const maintenant = options.maintenant ?? new Date()
  try {
    const prises = await prisma.climatMaille.updateMany({
      where: {
        etat: ETAT_DEMANDEE,
        tentatives: { lt: TENTATIVES_MAX },
        OR: [{ verrouJusqua: null }, { verrouJusqua: { lt: new Date() } }],
      },
      data: { verrouJeton: jeton, verrouJusqua: new Date(Date.now() + BAIL_MS) },
    })
    if (prises.count === 0) return vide

    const mailles = await prisma.climatMaille.findMany({
      where: { verrouJeton: jeton },
      select: { id: true, lambx: true, lamby: true },
    })
    const idParCle = new Map(mailles.map((m) => [cleMaille(m.lambx, m.lamby), m.id]))
    const cles = new Set(idParCle.keys())
    const ids = mailles.map((m) => m.id)

    try {
      let annees = 0
      const derniere = maintenant.getFullYear()
      for (let annee = PREMIERE_ANNEE_HISTORIQUE; annee <= derniere; annee++) {
        const series = await lireFichierSafran(urlAnneeSafran(annee), cles, options.ouvrir)
        // Le fichier de l'année en cours peut manquer début janvier : le
        // fichier récent, lu ensuite, en tient lieu.
        if (series === null && annee < derniere) throw new Error(`SAFRAN : fichier ${annee} introuvable`)
        if (series) annees += await enregistrerSeries(idParCle, series)
        await prisma.climatMaille.updateMany({
          where: { verrouJeton: jeton },
          data: { verrouJusqua: new Date(Date.now() + BAIL_MS) },
        })
      }
      const recent = await lireFichierSafran(URL_RECENT_SAFRAN, cles, options.ouvrir)
      if (recent) await enregistrerSeries(idParCle, recent)

      const maintenantFin = new Date()
      for (const id of ids) {
        const stockees = await prisma.climatMailleAnnee.count({ where: { mailleId: id } })
        const prete = stockees >= ANNEES_MIN_PRETE
        await prisma.climatMaille.updateMany({
          where: { id, verrouJeton: jeton },
          data: prete
            ? { etat: ETAT_PRETE, erreur: null, importeeLe: maintenantFin, actualiseeLe: maintenantFin, verrouJeton: null, verrouJusqua: null }
            : { etat: ETAT_ECHEC, erreur: `Historique incomplet : ${stockees} année(s)`, verrouJeton: null, verrouJusqua: null },
        })
      }
      return { mailles: ids.length, annees }
    } catch (erreur) {
      // Les années déjà écrites restent : la reprise les superpose sans perte.
      await prisma.climatMaille.updateMany({
        where: { verrouJeton: jeton, tentatives: { gte: TENTATIVES_MAX - 1 } },
        data: { etat: ETAT_ECHEC },
      })
      await prisma.climatMaille.updateMany({
        where: { verrouJeton: jeton },
        data: { tentatives: { increment: 1 }, erreur: messageErreur(erreur), verrouJeton: null, verrouJusqua: null },
      })
      throw erreur
    }
  } finally {
    importEnCours = false
  }
}

/**
 * Passage nocturne : complète les mailles prêtes avec les 60 derniers jours et
 * redonne une chance aux mailles en échec. Si l'application est restée arrêtée
 * plus longtemps que la fenêtre du fichier récent, relit aussi l'année en cours
 * et la précédente. Rend le nombre de mailles actualisées.
 */
export async function actualiserMailles(options: { ouvrir?: OuvrirFichier; maintenant?: Date } = {}): Promise<number> {
  if (!importAgroclimatActif()) return 0
  const maintenant = options.maintenant ?? new Date()

  await prisma.climatMaille.updateMany({
    where: { etat: ETAT_ECHEC, OR: [{ verrouJusqua: null }, { verrouJusqua: { lt: new Date() } }] },
    data: { etat: ETAT_DEMANDEE, tentatives: 0 },
  })

  const mailles = await prisma.climatMaille.findMany({
    where: { etat: ETAT_PRETE },
    select: { id: true, lambx: true, lamby: true, actualiseeLe: true },
  })
  if (mailles.length === 0) return 0
  const idParCle = new Map(mailles.map((m) => [cleMaille(m.lambx, m.lamby), m.id]))
  const cles = new Set(idParCle.keys())

  const enRetard = mailles.some(
    (m) => m.actualiseeLe === null || maintenant.getTime() - m.actualiseeLe.getTime() > RETARD_MAX_RECENT_MS
  )
  // Début janvier, le fichier récent déborde sur l'année précédente, que le
  // fichier annuel publié en cours d'année n'avait pas encore complète.
  const urls = enRetard
    ? [urlAnneeSafran(maintenant.getFullYear() - 1), urlAnneeSafran(maintenant.getFullYear()), URL_RECENT_SAFRAN]
    : [URL_RECENT_SAFRAN]
  for (const url of urls) {
    const series = await lireFichierSafran(url, cles, options.ouvrir)
    if (series) await enregistrerSeries(idParCle, series)
  }
  await prisma.climatMaille.updateMany({
    where: { id: { in: mailles.map((m) => m.id) }, etat: ETAT_PRETE },
    data: { actualiseeLe: new Date() },
  })
  return mailles.length
}
