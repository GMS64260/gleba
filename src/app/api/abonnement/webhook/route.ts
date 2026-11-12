import { NextResponse } from "next/server"
import { recevoirEvenement, ErreurFacturation } from "@/lib/abonnement/stripe"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export async function POST(request: Request) {
  try {
    if (!request.body) return NextResponse.json({ error: "Corps manquant." }, { status: 400 })
    const lecteur = request.body.getReader()
    const morceaux: Uint8Array[] = []
    let taille = 0
    while (true) {
      const { value, done } = await lecteur.read()
      if (done) break
      taille += value.byteLength
      if (taille > 1048576) { await lecteur.cancel(); return NextResponse.json({ error: "Corps trop volumineux." }, { status: 413 }) }
      morceaux.push(value)
    }
    const corps = Buffer.concat(morceaux).toString("utf8")
    await recevoirEvenement(corps, request.headers.get("stripe-signature"))
    return NextResponse.json({ received: true })
  } catch (e) {
    // Nom seul : ne jamais imprimer le contenu d'un événement de paiement.
    if (!(e instanceof ErreurFacturation) && !(e instanceof SyntaxError)) console.error("POST /api/abonnement/webhook error:", e instanceof Error ? e.name : "inconnue")
    return NextResponse.json({ error: "Événement non traité." }, { status: e instanceof ErreurFacturation ? e.status : e instanceof SyntaxError ? 400 : 503 })
  }
}
