import { NextResponse } from "next/server"
import { moderateurEncyclopedie, ENTETES_PRIVES } from "@/lib/encyclopedie/http"
import { listerContributions, reponseErreurEncyclopedie } from "@/lib/encyclopedie/service"
export const dynamic = "force-dynamic"
export async function GET(request: Request) {
  const { error } = await moderateurEncyclopedie(request)
  if (error) return error
  try { return NextResponse.json({ contributions: await listerContributions(null) }, { headers: ENTETES_PRIVES }) }
  catch (e) { return reponseErreurEncyclopedie(e) }
}
