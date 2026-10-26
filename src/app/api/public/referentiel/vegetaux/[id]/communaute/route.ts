import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth-utils"
import { checkRateLimit, getClientIP } from "@/lib/rate-limit"
import { lireCommunauteVegetal, reponseErreurEncyclopedie } from "@/lib/encyclopedie/service"
import { ENTETES_PRIVES } from "@/lib/encyclopedie/http"
export const dynamic = "force-dynamic"
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const plafond = checkRateLimit(`encyclopedie-publique:${getClientIP(request)}`, { windowMs: 60000, max: 120 })
  if (plafond) return plafond
  try {
    const { id } = await params
    const session = await getSession()
    const acteurId = session?.user && !session.user.impersonatedBy ? session.user.id : null
    const admin = acteurId !== null && session?.user.role === "ADMIN"
    const data = await lireCommunauteVegetal(id, acteurId, admin)
    return NextResponse.json(data, { headers: ENTETES_PRIVES })
  } catch (error) { return reponseErreurEncyclopedie(error) }
}
