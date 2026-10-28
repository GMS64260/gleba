/**
 * Rattachement d'un capteur, partie sans base (écran et routes) : types de
 * cible, validation et colonnes. Les lectures en base vivent dans
 * `rattachement.ts`.
 */
import { z } from "zod"

export const TYPES_CIBLE = {
  planche: "Planche",
  parcelle: "Parcelle",
  arbre: "Arbre",
  lot: "Lot d'animaux",
  animal: "Animal",
  objet: "Élément du plan",
} as const

export type TypeCible = keyof typeof TYPES_CIBLE

export const schemaCible = z.discriminatedUnion("type", [
  z.object({ type: z.literal("planche"), id: z.string().min(1).max(40) }),
  z.object({ type: z.literal("parcelle"), id: z.string().min(1).max(40) }),
  z.object({ type: z.literal("arbre"), id: z.number().int().positive() }),
  z.object({ type: z.literal("lot"), id: z.number().int().positive() }),
  z.object({ type: z.literal("animal"), id: z.number().int().positive() }),
  z.object({ type: z.literal("objet"), id: z.number().int().positive() }),
])

export type Cible = z.infer<typeof schemaCible>

interface ColonnesRattachement {
  plancheId: string | null
  parcelleGeoId: string | null
  arbreId: number | null
  lotAnimauxId: number | null
  animalId: number | null
  objetJardinId: number | null
}

/** Colonnes à écrire : la cible, et null partout ailleurs (CHECK en base : une seule). */
export function colonnesRattachement(cible: Cible | null): ColonnesRattachement {
  return {
    plancheId: cible?.type === "planche" ? cible.id : null,
    parcelleGeoId: cible?.type === "parcelle" ? cible.id : null,
    arbreId: cible?.type === "arbre" ? cible.id : null,
    lotAnimauxId: cible?.type === "lot" ? cible.id : null,
    animalId: cible?.type === "animal" ? cible.id : null,
    objetJardinId: cible?.type === "objet" ? cible.id : null,
  }
}

export function cibleDuCapteur(c: Partial<ColonnesRattachement>): Cible | null {
  if (c.plancheId) return { type: "planche", id: c.plancheId }
  if (c.parcelleGeoId) return { type: "parcelle", id: c.parcelleGeoId }
  if (c.arbreId) return { type: "arbre", id: c.arbreId }
  if (c.lotAnimauxId) return { type: "lot", id: c.lotAnimauxId }
  if (c.animalId) return { type: "animal", id: c.animalId }
  if (c.objetJardinId) return { type: "objet", id: c.objetJardinId }
  return null
}

export interface OptionCible {
  type: TypeCible
  id: string | number
  libelle: string
}
