/**
 * Contexte réglementaire d'une ligne du registre phytosanitaire : culture
 * traitée, localisation du lieu de traitement et caractère biologique de la
 * production.
 *
 * Arrêté du 24 décembre 2025 relatif à la tenue des registres d'utilisation
 * des produits phytopharmaceutiques (NOR AGRG2536515A), annexe I : ces trois
 * mentions sont obligatoires ; annexe II : localisation par référence RPG ou,
 * à défaut, coordonnées GPS en degrés décimaux WGS84. Gleba ne connaît pas les
 * îlots RPG : la localisation donne la planche, la parcelle, la commune et,
 * quand elles sont connues, les coordonnées GPS.
 *
 * Article 3 (pérennité et intégrité) : le contexte est FIGÉ sur le traitement
 * au jour de son enregistrement (`cultureRegistre`, `localisationRegistre`,
 * `conduiteBio`). Relu des fiches vivantes, un renommage de variété ou une
 * conversion en bio réécrivait silencieusement un registre passé (revue de
 * conformité du 2026-11-12, constat C4). Les lignes antérieures, sans
 * contexte figé, restent relues des fiches actuelles.
 */

import type { Prisma } from "@prisma/client"
import { resoudreIdPlanche } from "@/lib/planches/resolution"
import { statutBioCourant } from "@/lib/statut-bio"

type Tx = Prisma.TransactionClient

export interface ContexteRegistre {
  cultureRegistre: string | null
  localisationRegistre: string | null
  conduiteBio: boolean | null
}

export type LigneAvecContexte = Partial<ContexteRegistre> & {
  date?: Date
  contexteFige?: boolean | null
}

/**
 * Une ligne a-t-elle un contexte FIGÉ ? Règle unique du PATCH, de l'écran du
 * registre, de son export et des traces conservées.
 *
 * Le marqueur `contexteFige` (posé à chaque écriture du contexte, y compris
 * quand les trois mentions sont vides) distingue durablement un contexte
 * délibérément vidé d'une ligne ancienne jamais figée : sans lui, effacer la
 * seule mention connue faisait relire les fiches vivantes, la dénomination
 * effacée revenait au registre et à l'export (contre-revue ADV89-1). Les
 * lignes sans marqueur (antérieures, ou modèles qui ne le portent pas)
 * restent figées dès qu'une mention est enregistrée.
 */
export function contexteEstFige(ligne: LigneAvecContexte): boolean {
  return (
    ligne.contexteFige === true ||
    ligne.cultureRegistre != null ||
    ligne.localisationRegistre != null ||
    ligne.conduiteBio != null
  )
}

/**
 * Lecture commune au registre et à ses exports. Dès qu'un contexte est
 * figé, ses mentions inconnues ou vides restent telles quelles. Seules les
 * lignes anciennes jamais figées relisent les fiches de l'exploitation.
 */
export async function lireContexteRegistre(
  db: Tx,
  userId: string,
  ligne: LigneAvecContexte,
  refs: ReferencesLieu,
): Promise<ContexteRegistre & { contexteFige: boolean }> {
  if (contexteEstFige(ligne)) {
    return {
      cultureRegistre: ligne.cultureRegistre ?? null,
      localisationRegistre: ligne.localisationRegistre ?? null,
      conduiteBio: ligne.conduiteBio ?? null,
      contexteFige: true,
    }
  }
  return {
    ...(await chargerContexteRegistre(db, userId, refs, ligne.date ?? new Date())),
    contexteFige: false,
  }
}

/**
 * Provenance d'une mention du contexte d'un semis ou d'un traitement de
 * semences (tableaux C et D) : SAISIE par l'utilisateur (y compris vidée
 * délibérément) ou DÉDUITE des fiches référencées. `null` : inconnue (ligne
 * enregistrée avant le suivi de provenance) ou mention vide non saisie.
 */
export type OrigineMention = "saisie" | "deduite"

export function estOrigineMention(v: unknown): v is OrigineMention {
  return v === "saisie" || v === "deduite"
}

/** Mention écrite à la création : la saisie prime sur la déduction. */
export function mentionALaCreation<T>(
  saisie: T | null | undefined,
  deduite: T | null | undefined,
): { valeur: T | null; origine: OrigineMention | null } {
  if (saisie != null) return { valeur: saisie, origine: "saisie" }
  if (deduite != null) return { valeur: deduite, origine: "deduite" }
  return { valeur: null, origine: null }
}

/**
 * Mention après relecture des fiches (lieu, culture, jour ou utilisation
 * modifiés). Fonction pure.
 * - Une SAISIE renseignée est conservée : la saisie prime, comme à la création.
 * - Une saisie VIDÉE (« à compléter ») le reste tant que les références ne
 *   changent pas ; une nouvelle référence peut à nouveau la renseigner.
 * - Une DÉDUCTION ne survit pas à sa source : elle est remplacée par la
 *   valeur relue, `null` (à compléter) si la nouvelle source ne la donne pas
 *   (contre-revue ADV89-2 : la comparaison avec une fiche modifiée depuis la
 *   saisie prenait l'ancienne déduction pour une saisie).
 * - Provenance INCONNUE (ligne enregistrée avant ce suivi) : traitée
 *   prudemment comme une déduction ; mieux vaut une mention « à compléter »
 *   qu'une mention héritée d'une source retirée. La valeur d'avant reste au
 *   journal des rectifications.
 */
export function mentionApresRelecture<T>(m: {
  stockee: T | null
  origine: string | null | undefined
  relue: T | null
  referencesChangees: boolean
}): { valeur: T | null; origine: OrigineMention | null } {
  if (m.origine === "saisie" && (m.stockee != null || !m.referencesChangees)) {
    return { valeur: m.stockee, origine: "saisie" }
  }
  return { valeur: m.relue, origine: m.relue != null ? "deduite" : null }
}

interface LieuBio {
  nom: string
  statutBio?: string | null
  dateDebutConversion?: Date | null
}
interface ParcelleLieu extends LieuBio {
  commune?: string | null
  centroidLat?: number | null
  centroidLng?: number | null
}
interface PlancheLieu extends LieuBio {
  ilot?: string | null
  parcelleGeo?: ParcelleLieu | null
}

export interface SourcesContexte {
  culture?: { espece: string | null; variete: string | null; planche?: PlancheLieu | null } | null
  planche?: PlancheLieu | null
  arbre?: {
    nom: string
    espece: string | null
    variete: string | null
    gpsLat: number | null
    gpsLng: number | null
    parcelleGeo?: ParcelleLieu | null
    zone?: LieuBio | null
  } | null
  parcelle?: ParcelleLieu | null
}

/** « 43.2951234, -0.3707890 (WGS84) » : sept décimales, comme l'annexe II. */
export function coordonneesGps(lat: number | null | undefined, lng: number | null | undefined): string | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return `GPS ${lat.toFixed(7)}, ${lng.toFixed(7)} (WGS84)`
}

/** Conduite biologique : conversion (C1 à C3) comprise, au jour du traitement. */
export function estConduiteBio(lieu: LieuBio | null | undefined, jour: Date): boolean | null {
  if (!lieu || lieu.statutBio == null) return null
  return statutBioCourant(lieu.statutBio, lieu.dateDebutConversion ?? null, jour) !== "Conventionnel"
}

/** Compose le contexte d'une ligne à partir des fiches qui la localisent. Fonction pure. */
export function composerContexteRegistre(s: SourcesContexte, jour: Date): ContexteRegistre {
  const planche = s.culture?.planche ?? s.planche ?? null
  const parcelle = s.parcelle ?? planche?.parcelleGeo ?? s.arbre?.parcelleGeo ?? null

  let cultureRegistre: string | null = null
  if (s.culture?.espece) {
    cultureRegistre = s.culture.variete ? `${s.culture.espece} (${s.culture.variete})` : s.culture.espece
  } else if (s.arbre) {
    const espece = [s.arbre.espece, s.arbre.variete].filter(Boolean).join(" ")
    cultureRegistre = espece && espece !== s.arbre.nom ? `${espece} — ${s.arbre.nom}` : s.arbre.nom
  }

  const morceaux: string[] = []
  if (planche) morceaux.push(planche.ilot ? `Planche ${planche.nom} (îlot ${planche.ilot})` : `Planche ${planche.nom}`)
  if (s.arbre && !s.culture) morceaux.push(`Arbre ${s.arbre.nom}`)
  if (parcelle) morceaux.push(`Parcelle ${parcelle.nom}`)
  if (parcelle?.commune) morceaux.push(parcelle.commune)
  const gps = coordonneesGps(s.arbre?.gpsLat, s.arbre?.gpsLng) ?? coordonneesGps(parcelle?.centroidLat, parcelle?.centroidLng)
  if (gps) morceaux.push(gps)

  const conduiteBio =
    estConduiteBio(planche, jour) ?? estConduiteBio(s.arbre?.zone, jour) ?? estConduiteBio(parcelle, jour)

  return {
    cultureRegistre,
    localisationRegistre: morceaux.length > 0 ? morceaux.join(" · ") : null,
    conduiteBio,
  }
}

const PARCELLE_SELECT = {
  nom: true,
  commune: true,
  centroidLat: true,
  centroidLng: true,
  statutBio: true,
  dateDebutConversion: true,
} as const
const PLANCHE_SELECT = {
  nom: true,
  ilot: true,
  statutBio: true,
  dateDebutConversion: true,
  parcelleGeo: { select: PARCELLE_SELECT },
} as const

/**
 * Pourquoi `ObservationSante` et `OperationArbre` ne portent PAS de marqueur
 * `contexte_fige` (lot registre-phyto-marqueur-contexte-fige-po, 2026-11-15).
 *
 * Le marqueur d'`Intervention` (contre-revue ADV89-1) distingue un contexte
 * délibérément VIDÉ par l'utilisateur d'une ligne ancienne jamais figée. Sur
 * ces deux tables, ce cas ne peut pas se produire :
 *
 * 1. Le contexte n'est pas modifiable par l'utilisateur. Aucune route ne lit
 *    `cultureRegistre`, `localisationRegistre` ni `conduiteBio` dans le corps
 *    de la requête : POST et PUT `/api/arbres/observations[/:id]`, POST et PUT
 *    `/api/arbres/operations[/:id]`, POST `/api/arbres/operations/bulk` et
 *    l'assistant (`executor-verger.ts`) écrivent seulement le résultat de
 *    `chargerContexteRegistre` / `contexteOperationTraitement`. Les autres
 *    écritures (`generer-calendrier`, `creation-arbre`, script de reprise des
 *    fenêtres) ne touchent pas au contexte. La restauration d'une sauvegarde
 *    (`account-transfer.ts`) recopie les colonnes du fichier, puis recalcule
 *    sur les fiches importées le contexte d'un traitement arrivé entièrement
 *    vide (`contexte-registre-import.ts`, décision du 2026-11-16) : elle ne
 *    laisse donc pas non plus un contexte vide à réinterpréter.
 * 2. Le contexte écrit n'est jamais entièrement vide. Ces lignes ont un
 *    `arbre_id` obligatoire (clé étrangère en cascade) et l'arbre est relu
 *    borné au compte : avec un arbre, `composerContexteRegistre` renvoie
 *    toujours une dénomination (au moins `Arbre.nom`, colonne NOT NULL) et une
 *    localisation (« Arbre <nom> »). Figé une fois, le contexte garde donc au
 *    moins une mention non nulle, et la règle « figé dès qu'une mention est
 *    enregistrée » suffit (PUT, registre, export et `preserverTracesPhytoArbre`).
 *
 * Ajouter un jour une saisie ou un effacement du contexte sur ces tables
 * exige d'y ajouter le marqueur, comme pour `Intervention`. Garanties
 * couvertes par `__tests__/contexte-registre-arbre-non-vide.test.ts`.
 */

/**
 * Contexte à figer sur une opération d'arbre : seulement pour un traitement
 * RÉALISÉ (revue Codex CR-PHY-03 : ces opérations relisaient toujours les
 * fiches actuelles, un renommage ou un déplacement de l'arbre réécrivait le
 * registre). `null` sinon : rien à figer.
 */
export async function contexteOperationTraitement(
  db: Tx,
  userId: string,
  op: { type: string; fait: boolean; arbreId: number; date: Date },
): Promise<ContexteRegistre | null> {
  if (op.type !== 'traitement' || !op.fait) return null
  return chargerContexteRegistre(db, userId, { arbreId: op.arbreId }, op.date)
}

export interface ReferencesLieu {
  cultureId?: number | null
  plancheId?: string | null
  arbreId?: number | null
  parcelleId?: string | null
}

/**
 * Lit les fiches qui localisent un traitement, toujours bornées au compte
 * (colonnes sans clé étrangère), et compose son contexte au jour `jour`.
 */
export async function chargerContexteRegistre(
  db: Tx,
  userId: string,
  refs: ReferencesLieu,
  jour: Date,
): Promise<ContexteRegistre> {
  const culture = refs.cultureId
    ? await db.culture.findFirst({
        where: { id: refs.cultureId, userId },
        select: {
          espece: { select: { id: true, nom: true } },
          variete: { select: { id: true, nom: true } },
          planche: { select: PLANCHE_SELECT },
        },
      })
    : null
  const plancheId = !culture?.planche && refs.plancheId ? await resoudreIdPlanche(db, refs.plancheId, userId) : null
  const planche = plancheId
    ? await db.planche.findFirst({ where: { id: plancheId, userId }, select: PLANCHE_SELECT })
    : null
  const arbre = refs.arbreId
    ? await db.arbre.findFirst({
        where: { id: refs.arbreId, userId },
        select: {
          nom: true,
          espece: true,
          variete: true,
          gpsLat: true,
          gpsLng: true,
          parcelleGeo: { select: PARCELLE_SELECT },
          zone: { select: { nom: true, statutBio: true, dateDebutConversion: true } },
        },
      })
    : null
  const parcelle = refs.parcelleId
    ? await db.parcelleGeo.findFirst({ where: { id: refs.parcelleId, userId }, select: PARCELLE_SELECT })
    : null

  return composerContexteRegistre(
    {
      culture: culture
        ? {
            espece: culture.espece.nom ?? culture.espece.id,
            variete: culture.variete ? culture.variete.nom ?? culture.variete.id : null,
            planche: culture.planche,
          }
        : null,
      planche,
      arbre,
      parcelle,
    },
    jour,
  )
}
