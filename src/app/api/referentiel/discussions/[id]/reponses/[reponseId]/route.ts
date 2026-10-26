import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getActeurId } from "@/lib/exploitation/garde-session"
import { membreEncyclopedie } from "@/lib/encyclopedie/http"
import { discussionAccessibleMembre, ErreurEncyclopedie, reponseErreurEncyclopedie } from "@/lib/encyclopedie/service"
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; reponseId: string }> }) {
  const { error, session } = await membreEncyclopedie(request, "retrait")
  if (error) return error
  try { const { id, reponseId } = await params
    await prisma.$transaction(async tx => {
      await discussionAccessibleMembre(id, tx)
      const reponse = await tx.reponseEncyclopedie.findFirst({ where: { id: reponseId, discussionId: id } })
      if (!reponse) throw new ErreurEncyclopedie(404, "Réponse introuvable.")
      const admin = session.user.role === "ADMIN", acteur = getActeurId(session)
      if (!admin && reponse.userId !== acteur) throw new ErreurEncyclopedie(403, "Vous ne pouvez retirer que vos propres réponses.")
      await tx.reponseEncyclopedie.delete({ where: { id: reponseId } })
      await tx.discussionEncyclopedie.update({ where: { id }, data: { derniereActiviteAt: new Date() } })
    })
    return NextResponse.json({ ok: true })
  } catch (e) { return reponseErreurEncyclopedie(e) }
}
