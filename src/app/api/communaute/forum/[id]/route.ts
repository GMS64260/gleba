import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getActeurId } from "@/lib/exploitation/garde-session"
import { membreEncyclopedie, corpsInvalide, ENTETES_PRIVES } from "@/lib/encyclopedie/http"
import { modifierSujetForumSchema } from "@/lib/encyclopedie/validation"
import { discussionAccessibleMembre, ErreurEncyclopedie, reponseErreurEncyclopedie } from "@/lib/encyclopedie/service"
import { lireFilForum } from "@/lib/encyclopedie/forum"
export const dynamic = "force-dynamic"
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await membreEncyclopedie(request)
  if (error) return error
  try { const { id } = await params
    const query = new URL(request.url).searchParams
    const page = query.get("pageReponses") ?? query.get("reponsesPage")
    return NextResponse.json({ sujet: await lireFilForum(id, getActeurId(session), session.user.role === "ADMIN", page === null ? undefined : Number(page)) }, { headers: ENTETES_PRIVES })
  } catch (e) { return reponseErreurEncyclopedie(e) }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await membreEncyclopedie(request, "moderation-forum")
  if (error) return error
  const body = modifierSujetForumSchema.safeParse(await request.json().catch(() => null))
  if (!body.success) return corpsInvalide()
  try { const { id } = await params
    const sujet = await discussionAccessibleMembre(id)
    const admin = session.user.role === "ADMIN", acteur = getActeurId(session)
    if (!admin && (sujet.userId !== acteur || body.data.epingle !== undefined)) throw new ErreurEncyclopedie(403, "Cette modification ne vous est pas autorisée.")
    await prisma.discussionEncyclopedie.update({ where: { id }, data: body.data })
    return NextResponse.json({ sujet: await lireFilForum(id, acteur, admin) })
  } catch (e) { return reponseErreurEncyclopedie(e) }
}
