import { NextResponse } from "next/server"
import { getActeurId } from "@/lib/exploitation/garde-session"
import { moderateurEncyclopedie, corpsInvalide } from "@/lib/encyclopedie/http"
import { decisionEncyclopedieSchema } from "@/lib/encyclopedie/validation"
import { deciderContribution, reponseErreurEncyclopedie } from "@/lib/encyclopedie/service"
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await moderateurEncyclopedie(request)
  if (error) return error
  const body = decisionEncyclopedieSchema.safeParse(await request.json().catch(() => null))
  if (!body.success) return corpsInvalide()
  try { const { id } = await params
    return NextResponse.json(await deciderContribution(id, getActeurId(session), body.data))
  } catch (e) { return reponseErreurEncyclopedie(e) }
}
