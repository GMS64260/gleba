/**
 * Rattachement d'un capteur à UNE cible de l'exploitation, toujours par id
 * (règle du vault : un libellé se renomme, un id ne bouge pas). La cible doit
 * appartenir au même tenant que le capteur : sinon refus, jamais d'écriture
 * d'une clé étrangère vers la planche d'un autre compte.
 */
import prisma from "@/lib/prisma"
import type { Cible, OptionCible } from "./rattachement-types"

export { TYPES_CIBLE, schemaCible, colonnesRattachement, cibleDuCapteur } from "./rattachement-types"
export type { Cible, OptionCible, TypeCible } from "./rattachement-types"

export async function cibleAppartient(userId: string, cible: Cible): Promise<boolean> {
  const select = { id: true } as const
  switch (cible.type) {
    case "planche":
      return !!(await prisma.planche.findFirst({ where: { id: cible.id, userId }, select }))
    case "parcelle":
      return !!(await prisma.parcelleGeo.findFirst({ where: { id: cible.id, userId }, select }))
    case "arbre":
      return !!(await prisma.arbre.findFirst({ where: { id: cible.id, userId }, select }))
    case "lot":
      return !!(await prisma.lotAnimaux.findFirst({ where: { id: cible.id, userId }, select }))
    case "animal":
      return !!(await prisma.animal.findFirst({ where: { id: cible.id, userId }, select }))
    case "objet":
      return !!(await prisma.objetJardin.findFirst({ where: { id: cible.id, userId }, select }))
  }
}

/** Cibles proposées à l'écran, du compte seulement, par id avec un libellé d'affichage. */
export async function ciblesDuCompte(userId: string): Promise<OptionCible[]> {
  const [planches, parcelles, arbres, lots, animaux, objets] = await Promise.all([
    prisma.planche.findMany({ where: { userId }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
    prisma.parcelleGeo.findMany({ where: { userId }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
    prisma.arbre.findMany({ where: { userId }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
    prisma.lotAnimaux.findMany({ where: { userId }, select: { id: true, nom: true }, orderBy: { id: "asc" } }),
    prisma.animal.findMany({ where: { userId }, select: { id: true, nom: true, identifiant: true }, orderBy: { id: "asc" } }),
    prisma.objetJardin.findMany({ where: { userId }, select: { id: true, nom: true, type: true }, orderBy: { id: "asc" } }),
  ])
  return [
    ...planches.map((p) => ({ type: "planche" as const, id: p.id, libelle: p.nom })),
    ...parcelles.map((p) => ({ type: "parcelle" as const, id: p.id, libelle: p.nom })),
    ...arbres.map((a) => ({ type: "arbre" as const, id: a.id, libelle: a.nom })),
    ...lots.map((l) => ({ type: "lot" as const, id: l.id, libelle: l.nom || `Lot n° ${l.id}` })),
    ...animaux.map((a) => ({ type: "animal" as const, id: a.id, libelle: a.nom || a.identifiant || `Animal n° ${a.id}` })),
    ...objets.map((o) => ({ type: "objet" as const, id: o.id, libelle: o.nom || `${o.type} n° ${o.id}` })),
  ]
}
