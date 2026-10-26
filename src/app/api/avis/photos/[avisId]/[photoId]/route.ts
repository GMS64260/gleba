import prisma from '@/lib/prisma'
import { getUserId } from '@/lib/exploitation/garde-session'
import { membreEncyclopedie, ENTETES_PRIVES } from '@/lib/encyclopedie/http'
import { refAvisVisible } from '@/lib/avis/service'
import { reponseErreurAvis, ErreurAvis } from '@/lib/avis/photos-serveur'
export const dynamic = 'force-dynamic'
export async function GET(_request: Request, { params }: { params: Promise<{ avisId: string; photoId: string }> }) {
  // Les galeries ne consomment pas le plafond IP partagé de toutes les API.
  // Garde fraîche et quota de lectures par personne restent appliqués.
  const { error, session } = await membreEncyclopedie()
  const priver = (r: Response) => { for (const [k,v] of Object.entries(ENTETES_PRIVES)) r.headers.set(k,v); return r }
  if (error) return priver(error)
  try {
    const { avisId, photoId } = await params
    if (avisId.length > 64 || !/^[a-f0-9-]{36}$/.test(photoId)) throw new ErreurAvis(404, 'Photo introuvable.')
    const photo = await prisma.photoAvis.findUnique({ where: { id: photoId }, select: {
      avis: { select: { id: true, refType: true, refId: true } }, temoignage: { select: { avis: { select: { id: true, refType: true, refId: true } } } },
    } })
    const avis = photo?.avis ?? photo?.temoignage?.avis
    if (!avis || avis.id !== avisId || !await refAvisVisible(prisma, avis.refType, avis.refId, getUserId(session))) throw new ErreurAvis(404, 'Photo introuvable.')
    const data = await prisma.photoAvis.findUnique({ where: { id: photoId }, select: { donnees: true } })
    if (!data) throw new ErreurAvis(404, 'Photo introuvable.')
    return new Response(new Uint8Array(data.donnees), { headers: { ...ENTETES_PRIVES, 'Content-Type': 'image/jpeg',
      'Content-Disposition': 'inline; filename="photo-recolte.jpg"', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } })
  } catch (e) { return priver(reponseErreurAvis(e)) }
}
