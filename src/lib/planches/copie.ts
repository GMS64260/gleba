/**
 * Copie d'une planche (« Dupliquer » du plan 2D), en un ou plusieurs
 * exemplaires.
 *
 * Ticket QA du 2026-10-19 : les copies gardaient leurs dimensions mais
 * perdaient îlot, type (plein champ, serre…), sol, rétention et rotation. Le
 * plan ne recopiait que ce qu'il avait chargé pour se dessiner, puis passait
 * par la création ordinaire ; les copies comptaient comme terrain incomplet,
 * donc sans conseil d'arrosage fiable.
 *
 * Règle unique, appliquée par la route `POST /api/planches/[id]/dupliquer` qui
 * relit la source en base : la copie reprend tout le TERRAIN de la source.
 * Seuls changent l'identifiant, le nom (numéroté depuis le nom de base,
 * `nomsCopiesEnLot`) et la position (décalée selon l'orientation de la
 * planche, `poseCopieObjet`). Chaque colonne de `Planche` est classée
 * ci-dessous : une colonne ajoutée au schéma ne compile pas tant qu'on n'a pas
 * décidé si une copie la reprend.
 */

import type { Prisma } from "@prisma/client"

import { nomsCopiesEnLot } from "@/lib/jardin/noms-copie"
import { poseCopieObjet } from "@/lib/jardin/objets-plan"
import { surfacePlanche } from "./surface"

/** Garde-fou sur la duplication en lot. */
export const MAX_COPIES_PLANCHE = 20

/**
 * Sort de chaque colonne de `Planche` dans une copie.
 * - `terrain` : reprise telle quelle ;
 * - `identite` : propre à la copie (identifiant, propriétaire, nom numéroté) ;
 * - `position` : recalculée à côté de la source ;
 * - `propre` : non reprise, avec sa raison.
 */
export const SORT_COLONNE_COPIE_PLANCHE: Record<
  Prisma.PlancheScalarFieldEnum,
  "terrain" | "identite" | "position" | "propre"
> = {
  id: "identite",
  userId: "identite",
  nom: "identite",
  posX: "position",
  posY: "position",
  largeur: "terrain",
  longueur: "terrain",
  surface: "terrain",
  rotation2D: "terrain",
  ilot: "terrain",
  parcelleGeoId: "terrain",
  type: "terrain",
  irrigation: "terrain",
  rotationId: "terrain",
  annee: "terrain",
  typeSol: "terrain",
  retentionEau: "terrain",
  argile: "terrain",
  limon: "terrain",
  sable: "terrain",
  phSol: "terrain",
  carboneOrg: "terrain",
  derniereAnalyseSol: "terrain",
  // Voisinage calculé d'après la position de la source : faux pour la copie.
  planchesInfluencees: "propre",
  // Observations d'une planche précise, comme pour la copie d'un arbre.
  notes: "propre",
  // Statut réglementaire : ni la création ni la modification d'une planche ne
  // le posent, une copie ne le déclare pas davantage (défaut « Conventionnel »).
  statutBio: "propre",
  dateDebutConversion: "propre",
  certificateur: "propre",
  nCertificat: "propre",
}

/** Ce qu'il faut lire de la source pour la copier. */
export interface PlancheSourceCopie {
  nom: string
  posX: number | null
  posY: number | null
  largeur: number | null
  longueur: number | null
  surface: number | null
  rotation2D: number | null
  ilot: string | null
  parcelleGeoId: string | null
  type: string | null
  irrigation: string | null
  rotationId: string | null
  annee: number | null
  typeSol: string | null
  retentionEau: string | null
  argile: number | null
  limon: number | null
  sable: number | null
  phSol: number | null
  carboneOrg: number | null
  derniereAnalyseSol: Date | null
}

/** `select` Prisma de la source : exactement les champs de `PlancheSourceCopie`. */
export const SELECT_SOURCE_COPIE_PLANCHE = {
  nom: true,
  posX: true,
  posY: true,
  largeur: true,
  longueur: true,
  surface: true,
  rotation2D: true,
  ilot: true,
  parcelleGeoId: true,
  type: true,
  irrigation: true,
  rotationId: true,
  annee: true,
  typeSol: true,
  retentionEau: true,
  argile: true,
  limon: true,
  sable: true,
  phSol: true,
  carboneOrg: true,
  derniereAnalyseSol: true,
} as const satisfies Record<keyof PlancheSourceCopie, true>

export type AttributsCopiePlanche = Omit<PlancheSourceCopie, "nom" | "posX" | "posY">

/** Terrain repris par chaque copie (tout sauf identité et position). */
export function attributsCopiePlanche(source: PlancheSourceCopie): AttributsCopiePlanche {
  return {
    largeur: source.largeur,
    longueur: source.longueur,
    // Même calcul qu'à la création ; la surface saisie seule reste celle de la source.
    surface: surfacePlanche(source.largeur, source.longueur) ?? source.surface,
    rotation2D: source.rotation2D,
    ilot: source.ilot,
    parcelleGeoId: source.parcelleGeoId,
    type: source.type,
    irrigation: source.irrigation,
    rotationId: source.rotationId,
    annee: source.annee,
    typeSol: source.typeSol,
    retentionEau: source.retentionEau,
    argile: source.argile,
    limon: source.limon,
    sable: source.sable,
    phSol: source.phSol,
    carboneOrg: source.carboneOrg,
    derniereAnalyseSol: source.derniereAnalyseSol,
  }
}

/**
 * Noms et positions des copies : numérotées depuis le nom de base de la source
 * (« A3 (2) », « A3 (3) »…), posées côte à côte le long de la largeur, dans
 * l'orientation de la planche, 0,4 m d'écart.
 */
export function planCopiesPlanche(
  source: Pick<PlancheSourceCopie, "nom" | "posX" | "posY" | "largeur" | "longueur" | "rotation2D">,
  nombre: number,
  nomsExistants: Iterable<string>,
): { nom: string; posX: number; posY: number }[] {
  const copies = Math.max(1, Math.min(Math.floor(nombre) || 1, MAX_COPIES_PLANCHE))
  const noms = nomsCopiesEnLot(source.nom, nomsExistants, copies)
  const pose = {
    posX: source.posX ?? 0,
    posY: source.posY ?? 0,
    largeur: source.largeur || 1,
    longueur: source.longueur || 1,
    rotation2D: source.rotation2D ?? 0,
  }
  return noms.map((nom, index) => ({ nom, ...poseCopieObjet(pose, index + 1, false) }))
}
