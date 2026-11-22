/* eslint-disable no-restricted-syntax -- Identifiants techniques exacts des modèles Prisma. */
/**
 * Restauration d'un compte : recréation des référentiels PERSONNELS du fichier.
 *
 * Une espèce, une variété, un itinéraire, une espèce animale, une race, un
 * aliment, un porte-greffe ou une essence créés par l'utilisateur vivent dans
 * les tables de référentiel, avec un propriétaire. Une restauration par un
 * compte ordinaire ne savait que les RETROUVER par identifiant : sur un compte
 * vierge (autre compte de la même instance, ou autre instance) elles sont
 * invisibles ou absentes, et toute culture, récolte, stock ou animal qui en
 * dépend rendait la restauration impossible (FB-GJLDGZ).
 *
 * Règles :
 * - seules les lignes que le fichier marque personnelles sont recréées, jamais
 *   une entrée officielle absente de l'instance ;
 * - la copie appartient au compte cible, n'est jamais partagée, reçoit un
 *   nouvel identifiant : l'entrée privée d'un autre compte n'est ni lue, ni
 *   réutilisée, ni modifiée ;
 * - une entrée du compte cible portant déjà le même nom est reprise plutôt que
 *   doublée ;
 * - ce qui relève de la modération ou du catalogue officiel (provenance,
 *   statut de validation, partage, variété « Non spécifiée » d'une espèce
 *   d'autrui) est remis à sa valeur « personnel » ;
 * - la clé de dédoublonnage est recalculée depuis le nom, jamais lue du fichier ;
 * - seules les entrées utiles au compte sont recréées (les siennes et celles
 *   que ses données référencent), pas tout le catalogue partagé d'une instance.
 */

import { normalizeReferentielKey, normalizeVarieteName } from "@/lib/normalize"

type Ligne = Record<string, unknown>

export type ChampProprietaire = "userId" | "ownerUserId"

export interface RelationReferentiel {
  fkField: string
  targetModel: string
  nullable: boolean
}

interface DelegueReferentiel {
  findFirst: (args: { where: Ligne; select?: Ligne }) => Promise<Ligne | null>
  count: (args: { where: Ligne }) => Promise<number>
  create: (args: { data: Ligne }) => Promise<Ligne>
}

/** Référentiels dont le propriétaire n'est pas porté par `userId`. */
const PROPRIETAIRE_PARTICULIER: Record<string, ChampProprietaire> = { Aliment: "ownerUserId" }

/** Champ du propriétaire d'un référentiel personnel, ou null s'il n'en a pas. */
export function champProprietaire(modele: string, estCommunautaire: boolean): ChampProprietaire | null {
  return PROPRIETAIRE_PARTICULIER[modele] ?? (estCommunautaire ? "userId" : null)
}

/**
 * Unicités portées par toute l'instance, tous comptes confondus : une entrée
 * privée d'un autre compte (souvent le compte d'origine, sur la même instance)
 * bloque le même nom. La copie est alors renommée.
 */
const UNICITES_INSTANCE: Record<string, { champs: string[]; nom: string }> = {
  PorteGreffe: { champs: ["nom"], nom: "nom" },
  RaceAnimale: { champs: ["especeAnimaleId", "nom"], nom: "nom" },
}

/** Champs qui limitent la recherche d'un homonyme (une variété se nomme dans son espèce). */
const PORTEE_HOMONYME: Record<string, string[]> = {
  Variete: ["especeId"],
  RaceAnimale: ["especeAnimaleId"],
}

/** Valeurs imposées à une copie personnelle, quoi que dise le fichier. */
const VALEURS_PERSONNELLES: Record<string, Ligne> = {
  ITP: { sourceRecordId: null, statutValidation: "personnel" },
  Aliment: { origine: "prive" },
}

let compteur = 0
/** Identifiant au format des `@default(cuid())` du schéma (« c » + 24 caractères base 36). */
function nouvelIdentifiantReferentiel(): string {
  const alea = new Uint8Array(12)
  globalThis.crypto.getRandomValues(alea)
  compteur = (compteur + 1) % 36 ** 4
  return "c" + Date.now().toString(36).padStart(8, "0").slice(-8)
    + compteur.toString(36).padStart(4, "0")
    + Array.from(alea, (octet) => (octet % 36).toString(36)).join("")
}

/** Clé de dédoublonnage recalculée depuis le nom, comme le font les routes de création. */
const CLE_DEPUIS_NOM: Record<string, (nom: string) => string> = {
  Espece: normalizeReferentielKey,
  ITP: normalizeReferentielKey,
  Variete: normalizeVarieteName,
}

/**
 * Période d'un itinéraire : unique par auteur et par espèce (index
 * `itps_periode_unique_idx`). Un itinéraire du compte sur la même période est
 * repris, sinon la création violerait l'index et annulerait tout.
 */
const PERIODE_ITP = ["especeId", "semaineSemis", "semainePlantation", "semaineRecolte", "typePlanche"] as const

/** Plafond des entrées recréées par restauration (chacune coûte plusieurs requêtes). */
export const PLAFOND_REFERENTIELS_RECREES = 5000

const SUFFIXE = "restauré"
const ESSAIS_RENOMMAGE = 50

/**
 * Critères d'homonymie, du plus sûr au plus large : la clé de dédoublonnage,
 * puis le nom exact d'une entrée ancienne qui n'a pas de clé.
 */
function criteresHomonyme(modele: string, donnees: Ligne): Ligne[] {
  const criteres: Ligne[] = []
  const nom = typeof donnees.nom === "string" && donnees.nom ? donnees.nom : null
  if (typeof donnees.nomNormalise === "string" && donnees.nomNormalise) {
    criteres.push({ nomNormalise: donnees.nomNormalise })
    // La clé d'une variété est obligatoire : aucune entrée ancienne sans clé à chercher.
    if (nom && modele !== "Variete") criteres.push({ nomNormalise: null, nom })
  } else if (nom) criteres.push({ nom })
  else if (typeof donnees.nomCommun === "string" && donnees.nomCommun) {
    criteres.push({ nomCommun: donnees.nomCommun, ...(typeof donnees.nomLatin === "string" ? { nomLatin: donnees.nomLatin } : {}) })
  }
  const portee = Object.fromEntries((PORTEE_HOMONYME[modele] ?? []).map((champ) => [champ, donnees[champ] ?? null]))
  return criteres.map((critere) => ({ ...critere, ...portee }))
}

export interface RecreationReferentiel {
  modele: string
  /** Délégué Prisma du modèle, pris sur la transaction de la restauration. */
  delegue: DelegueReferentiel
  pkField: string
  /** Ligne du fichier, scalaires déjà typés (dates, décimaux). */
  donnees: Ligne
  proprietaire: ChampProprietaire
  /** Compte qui restaure : seul propriétaire possible de la copie. */
  utilisateurCible: string
  relations: readonly RelationReferentiel[]
  /** Nouvel identifiant d'une référence déjà traitée, `undefined` si elle est indisponible. */
  resoudre: (modeleCible: string, ancienId: unknown) => unknown | undefined
  /** L'entrée (identifiant déjà résolu) est-elle une copie ou une reprise du compte cible ? */
  estDuCompte: (modeleCible: string, id: unknown) => boolean
}

/**
 * Recrée (ou reprend) une entrée personnelle pour le compte cible.
 * Rend `null` quand une référence obligatoire de l'entrée est elle-même
 * indisponible : rien n'est écrit, la restauration décide de la suite.
 */
export async function recreerReferentielPersonnel(
  args: RecreationReferentiel
): Promise<{ id: unknown; reprise: boolean; renomme: string | null; reprisePeriode?: boolean } | null> {
  const { modele, delegue, pkField, proprietaire, utilisateurCible } = args
  const donnees: Ligne = { ...args.donnees }

  for (const rel of args.relations) {
    if (rel.fkField === proprietaire || rel.fkField === "userId" || rel.targetModel === "User") continue
    const ancien = donnees[rel.fkField]
    if (ancien === null || ancien === undefined) continue
    const nouveau = args.resoudre(rel.targetModel, ancien)
    if (nouveau !== undefined) donnees[rel.fkField] = nouveau
    else if (rel.nullable) donnees[rel.fkField] = null
    else return null
  }

  donnees[proprietaire] = utilisateurCible
  if ("partageCommunaute" in donnees) donnees.partageCommunaute = false
  Object.assign(donnees, VALEURS_PERSONNELLES[modele] ?? {})
  // La variété « Non spécifiée » d'une espèce est attribuée d'office aux cultures
  // sans variété : elle ne reste telle que sur une espèce du compte lui-même,
  // jamais sur une espèce officielle ou partagée, où elle capterait les
  // cultures des autres comptes.
  if (modele === "Variete" && "isPlaceholder" in donnees) {
    donnees.isPlaceholder = donnees.isPlaceholder === true && args.estDuCompte("Espece", donnees.especeId)
  }
  const cle = CLE_DEPUIS_NOM[modele]
  if (cle) {
    if (typeof donnees.nom === "string" && donnees.nom.trim()) donnees.nomNormalise = cle(donnees.nom)
    else if (modele === "Variete") return null
    else donnees.nomNormalise = null
  }

  for (const homonyme of criteresHomonyme(modele, donnees)) {
    const existante = await delegue.findFirst({
      where: { ...homonyme, [proprietaire]: utilisateurCible },
      select: { [pkField]: true },
    })
    if (existante) return { id: existante[pkField], reprise: true, renomme: null }
  }

  if (modele === "ITP" && donnees.especeId !== null && donnees.especeId !== undefined) {
    const memePeriode = await delegue.findFirst({
      where: {
        ...Object.fromEntries(PERIODE_ITP.map((champ) => [champ, donnees[champ] ?? null])),
        sourceRecordId: null,
        [proprietaire]: utilisateurCible,
      },
      select: { [pkField]: true },
    })
    if (memePeriode) return { id: memePeriode[pkField], reprise: true, renomme: null, reprisePeriode: true }
  }

  let renomme: string | null = null
  const unicite = UNICITES_INSTANCE[modele]
  if (unicite && typeof donnees[unicite.nom] === "string") {
    const origine = donnees[unicite.nom] as string
    const pris = (nom: string) =>
      delegue.count({ where: Object.fromEntries(unicite.champs.map((c) => [c, c === unicite.nom ? nom : donnees[c]])) })
    let candidat = origine
    for (let essai = 1; (await pris(candidat)) > 0; essai++) {
      if (essai > ESSAIS_RENOMMAGE) return null
      candidat = `${origine} (${SUFFIXE}${essai > 1 ? ` ${essai}` : ""})`
    }
    if (candidat !== origine) {
      donnees[unicite.nom] = candidat
      renomme = candidat
    }
  }

  const id = nouvelIdentifiantReferentiel()
  donnees[pkField] = id
  await delegue.create({ data: donnees })
  return { id, reprise: false, renomme }
}

export interface ModeleRestaure {
  name: string
  referentiel: boolean
  pkField: string | null
  relations: readonly RelationReferentiel[]
}

/**
 * Entrées de référentiel que les données du compte utilisent, directement ou
 * par une autre entrée utile (une variété tire son espèce, une race son espèce
 * animale). Une sauvegarde embarque tout le catalogue partagé visible de son
 * instance : sans ce tri, une restauration ailleurs le recopierait en entier
 * comme entrées privées du compte.
 */
export function referentielsUtilises(
  modeles: readonly ModeleRestaure[],
  data: Readonly<Record<string, readonly Ligne[] | undefined>>
): Map<string, Set<unknown>> {
  const referentiels = new Map(modeles.filter((m) => m.referentiel).map((m) => [m.name, m]))
  const utiles = new Map<string, Set<unknown>>()
  const noter = (modele: string, id: unknown): boolean => {
    if (id === null || id === undefined || !referentiels.has(modele)) return false
    const connus = utiles.get(modele) ?? utiles.set(modele, new Set()).get(modele)!
    if (connus.has(id)) return false
    connus.add(id)
    return true
  }
  for (const modele of modeles) {
    if (modele.referentiel) continue
    for (const ligne of data[modele.name] ?? []) {
      for (const rel of modele.relations) noter(rel.targetModel, ligne[rel.fkField])
      // Composition d'une ration : liste d'aliments portée par un champ JSON.
      if (modele.name === "PlanRation" && Array.isArray(ligne.composition)) {
        for (const element of ligne.composition) noter("Aliment", (element as Ligne | null)?.alimentId)
      }
    }
  }
  for (let change = true; change; ) {
    change = false
    for (const modele of referentiels.values()) {
      if (!modele.pkField) continue
      const retenus = utiles.get(modele.name)
      if (!retenus?.size) continue
      for (const ligne of data[modele.name] ?? []) {
        if (!retenus.has(ligne[modele.pkField])) continue
        for (const rel of modele.relations) change = noter(rel.targetModel, ligne[rel.fkField]) || change
      }
    }
  }
  return utiles
}

/** Réécrit les aliments d'une composition de ration ; rend le nombre d'éléments laissés tels quels. */
export function remapperCompositionRation(
  composition: unknown,
  resoudre: (ancienId: unknown) => unknown | undefined
): { composition: unknown; nonResolus: number } {
  if (!Array.isArray(composition)) return { composition, nonResolus: 0 }
  let nonResolus = 0
  const reecrite = composition.map((element) => {
    if (!element || typeof element !== "object" || !("alimentId" in element)) return element
    const nouveau = resoudre((element as Ligne).alimentId)
    if (nouveau === undefined) { nonResolus++; return element }
    return { ...(element as Ligne), alimentId: nouveau }
  })
  return { composition: reecrite, nonResolus }
}
