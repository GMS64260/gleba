import { NextResponse } from "next/server"
import { checkRateLimit, getClientIP } from "@/lib/rate-limit"
import { chargerCibleCorrection, cibleCorrectionVue, correctionsPubliques, typeCibleCorrection } from "@/lib/encyclopedie/corrections"
import { reponseErreurEncyclopedie } from "@/lib/encyclopedie/service"
export const dynamic = "force-dynamic"
export async function GET(request: Request, { params }: { params: Promise<{ type: string; refId: string }> }) {
  const limite = checkRateLimit(`correction-publique:${getClientIP(request)}`, { windowMs: 60000, max: 120 })
  if (limite) return limite
  const { type: typeRecu, refId } = await params
  const type = typeCibleCorrection(typeRecu)
  if (!type || !refId || refId.length > 400) return NextResponse.json({ error: "Cible de correction invalide." }, { status: 400 })
  try {
    const snapshot = await chargerCibleCorrection(type, refId)
    const corrections = await correctionsPubliques(snapshot.espece.id, undefined, { cibleType: type, refId })
    return NextResponse.json({ cible: cibleCorrectionVue(snapshot), corrections }, { headers: { "Cache-Control": "no-store" } })
  } catch (e) { return reponseErreurEncyclopedie(e) }
}
