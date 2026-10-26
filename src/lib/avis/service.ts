import type { Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'
import prisma from '@/lib/prisma'
import { visibiliteReferentiel } from '@/lib/referentiel-communaute'
import { nomPublic, visibiliteEnfantPublic, visibiliteReferentielPublic } from '@/lib/referentiel-public'
import { AVIS_REF_TYPES, type AvisRefType } from './types'
import type { PhotoAvisVue, TemoignageRecolteVue, VuePartageRecolte, StatsPartagesAvis } from './photos'
import { ErreurAvis, type PhotoPreparee } from './photos-serveur'
import { nomAffichableItp } from '@/lib/itp-label'

type Base = Prisma.TransactionClient
export const SELECTION_PHOTO_AVIS = { id: true, position: true, width: true, height: true, legende: true } as const
export const SELECTION_TEMOIGNAGE = {
  id: true, dateRecolte: true, quantite: true, unite: true, commentaire: true, createdAt: true,
  photos: { select: SELECTION_PHOTO_AVIS, orderBy: { position: 'asc' as const } },
} as const
export const SELECTION_AVIS = {
  id: true, userId: true, refType: true, refId: true, reprend: true, notes: true, commentaire: true,
  contexteTypeSol: true, contexteZoneClimat: true, createdAt: true, updatedAt: true,
  user: { select: { name: true } }, photos: { select: SELECTION_PHOTO_AVIS, orderBy: { position: 'asc' as const } },
  temoignages: { select: SELECTION_TEMOIGNAGE, orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }], take: 10 },
  _count: { select: { temoignages: true } },
} satisfies Prisma.AvisSelect
export type AvisLu = Prisma.AvisGetPayload<{ select: typeof SELECTION_AVIS }>
export function parseAvisRefType(type: string): AvisRefType | null { return AVIS_REF_TYPES.includes(type as AvisRefType) ? type as AvisRefType : null }
export async function refAvisVisible(db: Base, refType: AvisRefType, refId: string, tenant: string): Promise<boolean> {
  const where = { id: refId, AND: [visibiliteReferentiel(tenant)] }, select = { id: true }
  switch (refType) {
    case 'ESPECE': return !!await db.espece.findFirst({ where, select })
    case 'VARIETE': return !!await db.variete.findFirst({ where: { ...where, espece: visibiliteReferentiel(tenant) }, select })
    case 'ITP': return !!await db.iTP.findFirst({ where: { ...where, espece: visibiliteReferentiel(tenant) }, select })
    case 'PORTE_GREFFE': return !!await db.porteGreffe.findFirst({ where, select })
    case 'RACE': return !!await db.raceAnimale.findFirst({ where, select })
  }
}
export function photoAvisVue(avisId: string, photo: { id: string; width: number; height: number; legende: string | null }): PhotoAvisVue {
  return { id: photo.id, width: photo.width, height: photo.height, legende: photo.legende,
    url: `/api/avis/photos/${encodeURIComponent(avisId)}/${photo.id}` }
}
export function temoignageVue(avisId: string, item: Prisma.TemoignageRecolteGetPayload<{ select: typeof SELECTION_TEMOIGNAGE }>, isMine: boolean): TemoignageRecolteVue {
  return { id: item.id, dateRecolte: item.dateRecolte.toISOString(), quantite: item.quantite, unite: item.unite, commentaire: item.commentaire,
    photos: item.photos.map(p => photoAvisVue(avisId, p)), isMine, createdAt: item.createdAt.toISOString() }
}
export function avisVue(avis: AvisLu, acteur: string) {
  const isMine = avis.userId === acteur
  return { id: avis.id, auteur: avis.user.name || 'Membre de Gleba', isMine,
    reprend: avis.reprend, notes: avis.notes ?? {}, commentaire: avis.commentaire,
    contexteTypeSol: avis.contexteTypeSol, contexteZoneClimat: avis.contexteZoneClimat,
    createdAt: avis.createdAt.toISOString(), updatedAt: avis.updatedAt.toISOString(),
    photos: avis.photos.map(p => photoAvisVue(avis.id, p)),
    temoignages: avis.temoignages.map(t => temoignageVue(avis.id, t, isMine)), nbTemoignages: avis._count.temoignages }
}
export async function verrouAuteurAvis(tx: Base, acteur: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "users" WHERE "id" = ${acteur} FOR KEY SHARE`
  if (!rows.length) throw new ErreurAvis(401, 'Votre compte n’est plus accessible.')
}
export async function remplacerPhotosAvis(tx: Base, avisId: string, photos: PhotoPreparee[] | undefined) {
  if (photos === undefined) return
  await tx.$queryRaw`SELECT "id" FROM "avis" WHERE "id" = ${avisId} FOR UPDATE`
  const actuelles = await tx.photoAvis.findMany({ where: { avisId }, select: { id: true, position: true } })
  const gardees = photos.filter(p => !p.donnees)
  if (gardees.some(p => !actuelles.some(a => a.id === p.id))) throw new ErreurAvis(400, 'Une photo ne fait pas partie de votre avis. Rechargez le formulaire.')
  await tx.photoAvis.deleteMany({ where: { avisId, id: { notIn: gardees.map(p => p.id) } } })
  const positions = new Set(actuelles.filter(a => gardees.some(g => g.id === a.id)).map(a => a.position))
  for (const photo of photos) {
    if (!photo.donnees) { await tx.photoAvis.update({ where: { id: photo.id }, data: { legende: photo.legende } }); continue }
    const position = [0, 1, 2].find(i => !positions.has(i))
    if (position === undefined) throw new ErreurAvis(400, 'Au maximum trois photos par avis.')
    positions.add(position)
    await tx.photoAvis.create({ data: { id: photo.id, avisId, position, donnees: photo.donnees, width: photo.width!, height: photo.height!, legende: photo.legende } })
  }
}
async function recolteProprietaire(db: Base, recolteId: number, acteur: string, tenant: string) {
  if (acteur !== tenant) throw new ErreurAvis(403, 'Seul le propriétaire de l’exploitation peut partager une récolte. Vous pouvez publier votre propre avis sans lier les données de la ferme.')
  const r = await db.recolte.findFirst({ where: { id: recolteId, userId: acteur }, select: {
    id: true, userId: true, date: true, quantite: true, unite: true, especeId: true,
    culture: { select: { varieteId: true, itpId: true } },
  } })
  if (!r) throw new ErreurAvis(404, 'Récolte introuvable.')
  const unite = r.unite ?? 'kg' // null est l'unité historique explicitement définie par Recolte.
  if (!Number.isFinite(r.quantite) || r.quantite <= 0 || !['kg', 'piece', 'tige', 'botte'].includes(unite)) throw new ErreurAvis(400, 'Cette récolte ne peut pas être partagée avec une quantité et une unité fiables.')
  const cibles: VuePartageRecolte['cibles'] = []
  const espece = await db.espece.findFirst({ where: { id: r.especeId, AND: [visibiliteReferentielPublic] }, select: { id: true, nom: true } })
  if (espece) {
    cibles.push({ refType: 'ESPECE', refId: espece.id, nom: nomPublic(espece) })
    if (r.culture.varieteId) {
      const v = await db.variete.findFirst({ where: { id: r.culture.varieteId, especeId: r.especeId, AND: [visibiliteEnfantPublic()] }, select: { id: true, nom: true } })
      if (v) cibles.push({ refType: 'VARIETE', refId: v.id, nom: nomPublic(v) })
    }
    if (r.culture.itpId) {
      const itp = await db.iTP.findFirst({ where: { id: r.culture.itpId, especeId: r.especeId, actif: true, AND: [visibiliteEnfantPublic()] },
        select: { id: true, nom: true, userId: true, especeId: true, typePlanche: true, modeDemarrage: true } })
      if (itp) cibles.push({ refType: 'ITP', refId: itp.id, nom: nomAffichableItp({ ...itp, espece }) })
    }
  }
  const empreinte = createHash('sha256').update(JSON.stringify({ id: r.id, date: r.date.toISOString(), quantite: r.quantite, unite,
    especeId: r.especeId, varieteId: r.culture.varieteId, itpId: r.culture.itpId, cibles })).digest('hex')
  return { r, unite, cibles, empreinte }
}
export async function apercuPartageRecolte(recolteId: number, acteur: string, tenant: string): Promise<VuePartageRecolte> {
  const { r, unite, cibles, empreinte } = await recolteProprietaire(prisma, recolteId, acteur, tenant)
  const partages = await prisma.temoignageRecolte.findMany({ where: { recolteId, avis: { userId: acteur } },
    select: { id: true, avis: { select: { refType: true, refId: true } } }, take: 10 })
  return { dateRecolte: r.date.toISOString(), quantite: r.quantite, unite, empreinte, cibles, partages: partages.map(t => ({ id: t.id, refType: t.avis.refType, refId: t.avis.refId })) }
}
export async function partagerRecolte(recolteId: number, acteur: string, tenant: string, data: {
  refType: 'ESPECE' | 'VARIETE' | 'ITP'; refId: string; commentaire?: string | null; partagerQuantite: boolean; empreinteBase: string
}, photos: PhotoPreparee[] = []) {
  return prisma.$transaction(async tx => {
    await verrouAuteurAvis(tx, acteur)
    if (acteur !== tenant) throw new ErreurAvis(403, 'Le partage d’une récolte est réservé au propriétaire de l’exploitation.')
    const locked = await tx.$queryRaw<Array<{ id: number }>>`SELECT "id" FROM "recoltes" WHERE "id" = ${recolteId} AND "user_id" = ${acteur} FOR SHARE`
    if (!locked.length) throw new ErreurAvis(404, 'Récolte introuvable.')
    const { r, unite, cibles, empreinte } = await recolteProprietaire(tx, recolteId, acteur, tenant)
    if (!cibles.some(c => c.refType === data.refType && c.refId === data.refId)) throw new ErreurAvis(404, 'Cette référence publique ne correspond pas à la récolte.')
    // Une répétition retourne le témoignage déjà partagé, sans en modifier le
    // snapshot ni ajouter des photos. Aucune nouvelle donnée n'est publiée.
    const precedent = await tx.avis.findUnique({ where: { refType_refId_userId: { refType: data.refType, refId: data.refId, userId: acteur } }, select: { id: true } })
    if (precedent) {
      await tx.$queryRaw`SELECT "id" FROM "avis" WHERE "id" = ${precedent.id} FOR UPDATE`
      const partage = await tx.temoignageRecolte.findUnique({ where: { avisId_recolteId: { avisId: precedent.id, recolteId } }, select: SELECTION_TEMOIGNAGE })
      if (partage) return { temoignage: temoignageVue(precedent.id, partage, true), cree: false }
    }
    if (data.empreinteBase !== empreinte) throw new ErreurAvis(409, 'Cette récolte a changé depuis l’aperçu. Rechargez-le avant de confirmer le partage.')
    // Ne jamais remplacer les notes, commentaires ou photos de l'avis existant.
    const avis = await tx.avis.upsert({ where: { refType_refId_userId: { refType: data.refType, refId: data.refId, userId: acteur } }, update: {},
      create: { refType: data.refType, refId: data.refId, userId: acteur }, select: { id: true } })
    await tx.$queryRaw`SELECT "id" FROM "avis" WHERE "id" = ${avis.id} FOR UPDATE`
    const existant = await tx.temoignageRecolte.findUnique({ where: { avisId_recolteId: { avisId: avis.id, recolteId } }, select: SELECTION_TEMOIGNAGE })
    if (existant) return { temoignage: temoignageVue(avis.id, existant, true), cree: false }
    const temoignage = await tx.temoignageRecolte.create({ data: { avisId: avis.id, recolteId, dateRecolte: r.date,
      quantite: data.partagerQuantite ? r.quantite : null, unite: data.partagerQuantite ? unite : null, commentaire: data.commentaire?.trim() || null }, select: { id: true } })
    for (const [position, photo] of photos.entries()) {
      if (!photo.donnees || position > 2) throw new ErreurAvis(400, 'Photo de témoignage invalide.')
      await tx.photoAvis.create({ data: { id: photo.id, temoignageId: temoignage.id, position, donnees: photo.donnees, width: photo.width!, height: photo.height!, legende: photo.legende } })
    }
    const partage = await tx.temoignageRecolte.findUniqueOrThrow({ where: { id: temoignage.id }, select: SELECTION_TEMOIGNAGE })
    return { temoignage: temoignageVue(avis.id, partage, true), cree: true }
  })
}
export async function statsPartagesAvis(refType: AvisRefType, refId: string): Promise<StatsPartagesAvis> {
  const [groupes, nbContributeurs] = await Promise.all([
    prisma.temoignageRecolte.groupBy({ by: ['unite'], where: { avis: { refType, refId } }, _count: { _all: true }, _sum: { quantite: true } }),
    prisma.avis.count({ where: { refType, refId, temoignages: { some: {} } } }),
  ])
  return { nbRecoltes: groupes.reduce((s, g) => s + g._count._all, 0), nbContributeurs,
    quantitesParUnite: Object.fromEntries(groupes.filter(g => g.unite !== null && g._sum.quantite !== null).map(g => [g.unite!, Math.round(g._sum.quantite! * 1000) / 1000])) }
}
