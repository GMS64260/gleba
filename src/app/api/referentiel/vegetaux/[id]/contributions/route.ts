import { NextResponse } from "next/server"
import { getActeurId } from "@/lib/exploitation/garde-session"
import { membreEncyclopedie, corpsInvalide } from "@/lib/encyclopedie/http"
import { contributionEncyclopedieSchema } from "@/lib/encyclopedie/validation"
import { proposerContribution, reponseErreurEncyclopedie } from "@/lib/encyclopedie/service"
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await membreEncyclopedie(request, "proposition")
  if (error) return error
  const body = contributionEncyclopedieSchema.safeParse(await request.json().catch(() => null))
  if (!body.success) return corpsInvalide()
  try { const { id } = await params
    const contribution = await proposerContribution(id, getActeurId(session), body.data)
    return NextResponse.json({ contribution }, { status: 201 })
  } catch (e) { return reponseErreurEncyclopedie(e) }
}
