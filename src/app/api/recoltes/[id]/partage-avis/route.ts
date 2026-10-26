import { NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { getActeurId, getUserId } from '@/lib/exploitation/garde-session'
import { membreEncyclopedie, ENTETES_PRIVES } from '@/lib/encyclopedie/http'
import { apercuPartageRecolte, partagerRecolte } from '@/lib/avis/service'
import { ErreurAvis, lireCorpsAvis, preparerPhotosAvis, reponseErreurAvis } from '@/lib/avis/photos-serveur'
const partageSchema = z.object({ refType: z.enum(['ESPECE', 'VARIETE', 'ITP']), refId: z.string().min(1).max(400),
  commentaire: z.string().trim().max(4000).nullable().optional(), partagerQuantite: z.boolean(), empreinteBase: z.string().regex(/^[a-f0-9]{64}$/), confirmerPartage: z.literal(true),
  photos: z.unknown().optional(), confirmationDroitsPhotos: z.literal(true).optional() }).strict()
function identifiant(raw: string) { const id = Number(raw); if (!Number.isSafeInteger(id) || id <= 0) throw new ErreurAvis(400, 'Récolte invalide.'); return id }
export const dynamic = 'force-dynamic'
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuthApi(request)
  if (error) return error
  try {
    const acteur = getActeurId(session), compte = await prisma.user.findUnique({ where: { id: acteur }, select: { id: true, active: true } })
    if (!compte?.active) throw new ErreurAvis(401, 'Votre compte n’est plus accessible.')
    const { id } = await params
    return NextResponse.json(await apercuPartageRecolte(identifiant(id), acteur, getUserId(session)), { headers: ENTETES_PRIVES })
  } catch (e) { return reponseErreurAvis(e) }
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await membreEncyclopedie(request, 'partage-recolte')
  if (error) return error
  try {
    const body = partageSchema.safeParse(await lireCorpsAvis(request))
    if (!body.success) throw new ErreurAvis(400, 'Confirmez le partage et choisissez une référence de la récolte.')
    const { id } = await params
    const photos = await preparerPhotosAvis(body.data.photos, body.data.confirmationDroitsPhotos, true)
    const result = await partagerRecolte(identifiant(id), getActeurId(session), getUserId(session), body.data, photos)
    return NextResponse.json({ temoignage: result.temoignage }, { status: result.cree ? 201 : 200, headers: ENTETES_PRIVES })
  } catch (e) { return reponseErreurAvis(e) }
}
