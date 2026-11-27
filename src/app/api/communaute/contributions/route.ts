import { NextResponse } from "next/server"
import { getActeurId } from "@/lib/exploitation/garde-session"
import { membreEncyclopedie, ENTETES_PRIVES } from "@/lib/encyclopedie/http"
import { listerContributions, listerPhotosProposees, reponseErreurEncyclopedie } from "@/lib/encyclopedie/service"
export const dynamic = "force-dynamic"
export async function GET(request: Request) {
  const { error, session } = await membreEncyclopedie(request)
  if (error) return error
  try {
    const acteurId = getActeurId(session)
    return NextResponse.json({ contributions: await listerContributions(acteurId), photos: await listerPhotosProposees(acteurId) }, { headers: ENTETES_PRIVES })
  }
  catch (e) { return reponseErreurEncyclopedie(e) }
}
