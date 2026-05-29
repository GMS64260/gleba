/**
 * Référentiel communautaire — signal data-driven (production réelle), par type.
 * SERVEUR uniquement (importe Prisma). Sert au badge « confirmé terrain » et à
 * la crédibilité hybride des avis.
 */

import type { PrismaClient } from '@prisma/client'
import { type AvisRefType, type RendementReel, SEUIL_TERRAIN } from './types'

/** Accumulateur générique : compte d'unités productives, exploitations, quantité. */
type Acc = { unites: number; users: Set<string>; total: number }

function vide(): Map<string, RendementReel> {
  return new Map()
}

function finaliser(acc: Map<string, Acc>): Map<string, RendementReel> {
  const out = new Map<string, RendementReel>()
  for (const [refId, a] of acc) {
    out.set(refId, { nbProductif: a.unites, nbExploitations: a.users.size, quantiteTotale: a.total })
  }
  return out
}

/** VARIETE : cultures liées ayant réellement produit (Culture → Recolte). */
async function rendementVariete(prisma: PrismaClient, refIds: string[]) {
  const cultures = await prisma.culture.findMany({
    where: { varieteId: { in: refIds }, recoltes: { some: { quantite: { gt: 0 } } } },
    select: { varieteId: true, userId: true, recoltes: { where: { quantite: { gt: 0 } }, select: { quantite: true } } },
  })
  const acc = new Map<string, Acc>()
  for (const c of cultures) {
    if (!c.varieteId) continue
    const a = acc.get(c.varieteId) ?? { unites: 0, users: new Set<string>(), total: 0 }
    a.unites += 1
    a.users.add(c.userId)
    a.total += c.recoltes.reduce((s, r) => s + r.quantite, 0)
    acc.set(c.varieteId, a)
  }
  return finaliser(acc)
}

/** Agrège les arbres (par clé porte-greffe ou espèce) ayant réellement produit. */
async function rendementArbresPar(
  prisma: PrismaClient,
  champ: 'porteGreffeId' | 'especeId',
  refIds: string[]
) {
  const arbres = await prisma.arbre.findMany({
    where: { [champ]: { in: refIds }, recoltesArbres: { some: { quantite: { gt: 0 } } } },
    select: {
      porteGreffeId: true,
      especeId: true,
      userId: true,
      recoltesArbres: { where: { quantite: { gt: 0 } }, select: { quantite: true } },
    },
  })
  const acc = new Map<string, Acc>()
  for (const arbre of arbres) {
    const key = arbre[champ]
    if (!key) continue
    const a = acc.get(key) ?? { unites: 0, users: new Set<string>(), total: 0 }
    a.unites += 1
    a.users.add(arbre.userId)
    a.total += arbre.recoltesArbres.reduce((s, r) => s + r.quantite, 0)
    acc.set(key, a)
  }
  return acc
}

/** PORTE_GREFFE : arbres greffés dessus ayant produit (Arbre → RecolteArbre). */
async function rendementPorteGreffe(prisma: PrismaClient, refIds: string[]) {
  return finaliser(await rendementArbresPar(prisma, 'porteGreffeId', refIds))
}

/** ESPECE : fruitière via arbres, légumière via cultures — on fusionne les deux. */
async function rendementEspece(prisma: PrismaClient, refIds: string[]) {
  const accArbres = await rendementArbresPar(prisma, 'especeId', refIds)
  const cultures = await prisma.culture.findMany({
    where: { especeId: { in: refIds }, recoltes: { some: { quantite: { gt: 0 } } } },
    select: { especeId: true, userId: true, recoltes: { where: { quantite: { gt: 0 } }, select: { quantite: true } } },
  })
  for (const c of cultures) {
    const a = accArbres.get(c.especeId) ?? { unites: 0, users: new Set<string>(), total: 0 }
    a.unites += 1
    a.users.add(c.userId)
    a.total += c.recoltes.reduce((s, r) => s + r.quantite, 0)
    accArbres.set(c.especeId, a)
  }
  return finaliser(accArbres)
}

/** ITP : cultures suivant cet itinéraire ayant réellement produit (Culture.itpId → Recolte). */
async function rendementITP(prisma: PrismaClient, refIds: string[]) {
  const cultures = await prisma.culture.findMany({
    where: { itpId: { in: refIds }, recoltes: { some: { quantite: { gt: 0 } } } },
    select: { itpId: true, userId: true, recoltes: { where: { quantite: { gt: 0 } }, select: { quantite: true } } },
  })
  const acc = new Map<string, Acc>()
  for (const c of cultures) {
    if (!c.itpId) continue
    const a = acc.get(c.itpId) ?? { unites: 0, users: new Set<string>(), total: 0 }
    a.unites += 1
    a.users.add(c.userId)
    a.total += c.recoltes.reduce((s, r) => s + r.quantite, 0)
    acc.set(c.itpId, a)
  }
  return finaliser(acc)
}

/** RACE : animaux réellement élevés de cette race (preuve terrain). */
async function rendementRace(prisma: PrismaClient, refIds: string[]) {
  const animaux = await prisma.animal.findMany({
    where: { raceAnimaleId: { in: refIds } },
    select: { raceAnimaleId: true, userId: true },
  })
  const acc = new Map<string, Acc>()
  for (const a of animaux) {
    if (!a.raceAnimaleId) continue
    const x = acc.get(a.raceAnimaleId) ?? { unites: 0, users: new Set<string>(), total: 0 }
    x.unites += 1
    x.users.add(a.userId)
    x.total += 1
    acc.set(a.raceAnimaleId, x)
  }
  return finaliser(acc)
}

/** Production réelle par objet noté. Aiguille selon le type. */
export async function rendementReel(
  prisma: PrismaClient,
  refType: AvisRefType,
  refIds: string[]
): Promise<Map<string, RendementReel>> {
  if (refIds.length === 0) return vide()
  switch (refType) {
    case 'VARIETE':
      return rendementVariete(prisma, refIds)
    case 'PORTE_GREFFE':
      return rendementPorteGreffe(prisma, refIds)
    case 'ESPECE':
      return rendementEspece(prisma, refIds)
    case 'RACE':
      return rendementRace(prisma, refIds)
    case 'ITP':
      return rendementITP(prisma, refIds)
  }
}

/** Badge « ✔ confirmé terrain » : objet réellement éprouvé (≥ SEUIL_TERRAIN unités productives). */
export function badgeTerrain(reel: RendementReel | undefined): boolean {
  return (reel?.nbProductif ?? 0) >= SEUIL_TERRAIN
}
