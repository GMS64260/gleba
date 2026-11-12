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
