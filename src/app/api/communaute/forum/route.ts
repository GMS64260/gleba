import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getActeurId } from "@/lib/exploitation/garde-session"
import { membreEncyclopedie, corpsInvalide, ENTETES_PRIVES } from "@/lib/encyclopedie/http"
import { sujetForumSchema } from "@/lib/encyclopedie/validation"
import { especePublique, reponseErreurEncyclopedie } from "@/lib/encyclopedie/service"
import { listerForum, lireFilForum } from "@/lib/encyclopedie/forum"
export const dynamic = "force-dynamic"
export async function GET(request: Request) {
  const { error, session } = await membreEncyclopedie(request)
  if (error) return error
  try { return NextResponse.json(await listerForum(new URL(request.url).searchParams, getActeurId(session), session.user.role === "ADMIN"), { headers: ENTETES_PRIVES }) }
  catch (e) { return reponseErreurEncyclopedie(e) }
}
export async function POST(request: Request) {
  const { error, session } = await membreEncyclopedie(request, "discussion")
  if (error) return error
  const body = sujetForumSchema.safeParse(await request.json().catch(() => null))
  if (!body.success) return corpsInvalide()
  try {
    const sujet = await prisma.$transaction(async tx => {
      if (body.data.especeId) await especePublique(body.data.especeId, tx)
      return tx.discussionEncyclopedie.create({ data: { ...body.data, especeId: body.data.especeId ?? null, userId: getActeurId(session) }, select: { id: true } })
    })
    return NextResponse.json({ sujet: await lireFilForum(sujet.id, getActeurId(session), session.user.role === "ADMIN") }, { status: 201 })
  } catch (e) { return reponseErreurEncyclopedie(e) }
}
