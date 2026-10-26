import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActeurId } from '@/lib/exploitation/garde-session'
import { membreEncyclopedie, ENTETES_PRIVES } from '@/lib/encyclopedie/http'
import { reponseErreurAvis, ErreurAvis } from '@/lib/avis/photos-serveur'
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await membreEncyclopedie(request, 'avis-retrait')
  if (error) return error
  try {
    const { id } = await params
    const result = await prisma.temoignageRecolte.deleteMany({ where: { id, avis: { userId: getActeurId(session) } } })
    if (!result.count) throw new ErreurAvis(404, 'Témoignage introuvable.')
    return NextResponse.json({ ok: true }, { headers: ENTETES_PRIVES })
  } catch (e) { return reponseErreurAvis(e) }
}
