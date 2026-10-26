import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getActeurId } from "@/lib/exploitation/garde-session"
import { membreEncyclopedie } from "@/lib/encyclopedie/http"
import { discussionAccessibleMembre, ErreurEncyclopedie, reponseErreurEncyclopedie } from "@/lib/encyclopedie/service"
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await membreEncyclopedie(request, "retrait")
  if (error) return error
  try { const { id } = await params
    const discussion = await discussionAccessibleMembre(id)
    const admin = session.user.role === "ADMIN", acteur = getActeurId(session)
    if (!admin && discussion.userId !== acteur) throw new ErreurEncyclopedie(403, "Vous ne pouvez retirer que vos propres sujets.")
    const retiree = await prisma.discussionEncyclopedie.deleteMany({ where: { id, ...(admin ? {} : { userId: acteur }) } })
    if (!retiree.count) throw new ErreurEncyclopedie(404, "Discussion introuvable.")
    return NextResponse.json({ ok: true })
  } catch (e) { return reponseErreurEncyclopedie(e) }
}
