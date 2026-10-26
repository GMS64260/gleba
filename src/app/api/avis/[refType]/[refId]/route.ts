/** Avis et récoltes explicitement partagées, accessibles aux comptes personnels. */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { getActeurId, getUserId } from '@/lib/exploitation/garde-session'
import { membreEncyclopedie, ENTETES_PRIVES } from '@/lib/encyclopedie/http'
import { terroirDeUser } from '@/lib/terroir'
import { criteresKeys } from '@/lib/avis/criteres'
import { calculerStats, moyenneGlobaleNotes, dispersionParTerroir, avisSchema } from '@/lib/avis/stats'
import { filtreAvisAvecContributions, filtreAvisDirect } from '@/lib/avis/filtres'
import { SELECTION_AVIS, avisVue, parseAvisRefType, refAvisVisible, remplacerPhotosAvis, verrouAuteurAvis, statsPartagesAvis } from '@/lib/avis/service'
import { ErreurAvis, lireCorpsAvis, preparerPhotosAvis, reponseErreurAvis } from '@/lib/avis/photos-serveur'

type RouteParams = { params: Promise<{ refType: string; refId: string }> }
export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { error, session } = await membreEncyclopedie(request)
  if (error) return error
  try {
    const { refType: type, refId } = await params, refType = parseAvisRefType(type)
    if (!refType) throw new ErreurAvis(400, 'Type invalide.')
    const acteur = getActeurId(session), tenant = getUserId(session)
    const page = Number(request.nextUrl.searchParams.get('page') ?? '1')
    if (!Number.isInteger(page) || page < 1 || page > 100000) throw new ErreurAvis(400, 'Page invalide.')
    const visible = await refAvisVisible(prisma, refType, refId, tenant)
    const where = { refType, refId, AND: [filtreAvisAvecContributions(refType)] }
    const [avis, monAvis, notables, total, partages] = visible ? await Promise.all([
      prisma.avis.findMany({ where, select: SELECTION_AVIS, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: 20, skip: (page - 1) * 20 }),
      prisma.avis.findUnique({ where: { refType_refId_userId: { refType, refId, userId: acteur } }, select: SELECTION_AVIS }),
      prisma.avis.findMany({ where: { refType, refId, AND: [filtreAvisDirect(refType)] }, select: { reprend: true, notes: true, contexteTypeSol: true, contexteZoneClimat: true }, orderBy: { updatedAt: 'desc' }, take: 2001 }),
      prisma.avis.count({ where }), statsPartagesAvis(refType, refId),
    ]) : [[], null, [], 0, { nbRecoltes: 0, nbContributeurs: 0, quantitesParUnite: {} }]
    const pourStats = notables.slice(0, 2000).map(a => ({ reprend: a.reprend, notes: (a.notes ?? {}) as Record<string, number | null>, contexteTypeSol: a.contexteTypeSol, contexteZoneClimat: a.contexteZoneClimat }))
    return NextResponse.json({ data: {
      avis: avis.map(a => avisVue(a, acteur)), monAvis: monAvis ? avisVue(monAvis, acteur) : null,
      stats: calculerStats(pourStats, moyenneGlobaleNotes(pourStats), criteresKeys(refType)), dispersionTerroir: dispersionParTerroir(pourStats),
      partages, reel: { nbProductif: 0, nbExploitations: 0, quantiteTotale: 0 }, badgeTerrain: false,
      total, page, pages: Math.max(1, Math.ceil(total / 20)), statsLimitees: notables.length > 2000,
    } }, { headers: ENTETES_PRIVES })
  } catch (e) { return reponseErreurAvis(e) }
}
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { error, session } = await membreEncyclopedie(request, 'avis-envoi')
  if (error) return error
  try {
    const { refType: type, refId } = await params, refType = parseAvisRefType(type)
    if (!refType) throw new ErreurAvis(400, 'Type invalide.')
    const raw = await lireCorpsAvis(request)
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ErreurAvis(400, 'Corps invalide.')
    const body = raw as Record<string, unknown>
    const parsed = z.object(avisSchema(criteresKeys(refType)).shape).safeParse(body)
    if (!parsed.success) throw new ErreurAvis(400, 'Avis invalide.')
    const acteur = getActeurId(session), tenant = getUserId(session)
    if (!await refAvisVisible(prisma, refType, refId, tenant)) throw new ErreurAvis(404, 'Objet introuvable.')
    const photos = await preparerPhotosAvis(body.photos, body.confirmationDroitsPhotos)
    const terroir = await terroirDeUser(prisma, tenant)
    const payload = { reprend: parsed.data.reprend ?? null, notes: parsed.data.notes ?? {}, commentaire: parsed.data.commentaire?.trim() || null }
    const avis = await prisma.$transaction(async tx => {
      await verrouAuteurAvis(tx, acteur)
      if (!await refAvisVisible(tx, refType, refId, tenant)) throw new ErreurAvis(404, 'Objet introuvable.')
      const existant = await tx.avis.findUnique({ where: { refType_refId_userId: { refType, refId, userId: acteur } }, select: { id: true } })
      const aDuContenu = payload.reprend !== null || Boolean(payload.commentaire) || Object.values(payload.notes).some(n => n !== null && n !== undefined)
      if (!existant && !aDuContenu && !photos?.length) throw new ErreurAvis(400, 'Ajoutez un avis, un commentaire ou une photo.')
      const a = await tx.avis.upsert({ where: { refType_refId_userId: { refType, refId, userId: acteur } }, update: payload,
        create: { refType, refId, userId: acteur, ...payload, contexteTypeSol: terroir.typeSol, contexteZoneClimat: terroir.zoneClimat, contexteCodePostal: terroir.codePostal }, select: { id: true } })
      await remplacerPhotosAvis(tx, a.id, photos)
      return tx.avis.findUniqueOrThrow({ where: { id: a.id }, select: SELECTION_AVIS })
    })
    return NextResponse.json({ data: avisVue(avis, acteur) }, { status: 201, headers: ENTETES_PRIVES })
  } catch (e) { return reponseErreurAvis(e) }
}
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { error, session } = await membreEncyclopedie(request, 'avis-retrait')
  if (error) return error
  try {
    const { refType: type, refId } = await params, refType = parseAvisRefType(type)
    if (!refType) throw new ErreurAvis(400, 'Type invalide.')
    await prisma.avis.deleteMany({ where: { refType, refId, userId: getActeurId(session) } })
    return NextResponse.json({ data: { ok: true } }, { headers: ENTETES_PRIVES })
  } catch (e) { return reponseErreurAvis(e) }
}
