import { NextResponse } from "next/server"
import { getActeurId } from "@/lib/exploitation/garde-session"
import { membreEncyclopedie, corpsInvalide } from "@/lib/encyclopedie/http"
import { correctionCibleeSchema } from "@/lib/encyclopedie/validation"
import { proposerCorrectionCiblee, reponseErreurEncyclopedie } from "@/lib/encyclopedie/service"
export async function POST(request: Request) {
  const { error, session } = await membreEncyclopedie(request, "proposition")
  if (error) return error
  const body = correctionCibleeSchema.safeParse(await request.json().catch(() => null))
  if (!body.success) return corpsInvalide()
  try { return NextResponse.json({ contribution: await proposerCorrectionCiblee(getActeurId(session), body.data) }, { status: 201 }) }
  catch (e) { return reponseErreurEncyclopedie(e) }
}
