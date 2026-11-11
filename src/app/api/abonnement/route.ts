import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import prisma from "@/lib/prisma"
import { requireAuthApi, refusSiPasProprietaire } from "@/lib/auth-utils"
import { refusSiCompteDemo } from "@/lib/demo-garde"
import { abonnementsActifs, chargerAccesService, demarrerEssai } from "@/lib/abonnement/serveur"
import { creerCheckout, creerPortail, paiementsDisponibles, resilier, ErreurFacturation } from "@/lib/abonnement/stripe"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("essai") }),
  z.object({ action: z.literal("checkout"), formule: z.literal("complet"), conditionsAcceptees: z.literal(true) }),
  z.object({ action: z.enum(["portail", "resilier"]) }),
])
export async function GET() {
  // Sans la requête : `requireAuthApi(request)` applique un quota de 100 appels
  // par quart d'heure et par adresse IP, partagé avec d'autres routes. Cette
  // lecture conditionne l'affichage de TOUTES les pages protégées et repart à
  // chaque chargement de page : un utilisateur actif (ou plusieurs membres
  // derrière la même connexion) épuisait le quota et se retrouvait devant
  // « Votre accès n'est pas disponible », l'actualisation aggravant le blocage
  // (incident du 2026-11-11). Le contexte de la garde d'abonnement vient alors
  // des en-têtes posés par le middleware.
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session.user.id
  const acces = await chargerAccesService(userId)
  const ligne = abonnementsActifs() ? await prisma.abonnementGleba.findUnique({ where: { userId }, select: { annulationAuTerme: true, clientStripeId: true, abonnementStripeId: true } }) : null
  return NextResponse.json({ acces, actif: abonnementsActifs(), paiementDisponible: paiementsDisponibles(), peutGerer: session.user.estProprietaireExploitation && !session.user.impersonatedBy, compteFacturation: Boolean(ligne?.clientStripeId), contratEnCours: Boolean(ligne?.abonnementStripeId), annulationAuTerme: ligne?.annulationAuTerme ?? false }, { headers: NO_STORE })
}
export async function POST(request: NextRequest) {
  const origine = request.headers.get("origin")
  const attendue = new URL(process.env.GLEBA_PUBLIC_URL || request.url).origin
  if (origine && origine !== attendue) return NextResponse.json({ error: "Origine de la demande invalide." }, { status: 403 })
  const { error, session } = await requireAuthApi(request)
  if (error) return error
  const refus = refusSiPasProprietaire(session)
  if (refus) return refus
  if (session.user.impersonatedBy) return NextResponse.json({ error: "La consultation admin ne permet pas de modifier un abonnement." }, { status: 403 })
  const demo = await refusSiCompteDemo(session.user.id, "La démonstration ne permet pas de souscrire ou de modifier un abonnement.")
  if (demo) return demo
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 4096) return NextResponse.json({ error: "Requête trop volumineuse." }, { status: 413 })
    const input = schema.safeParse(await request.json())
    if (!input.success) return NextResponse.json({ error: "Confirmez les conditions de l’offre Complet." }, { status: 400 })
    const d = input.data
    const userId = session.user.id
    if (d.action === "essai") return NextResponse.json({ acces: await demarrerEssai(userId) }, { headers: NO_STORE })
    if (d.action === "checkout") return NextResponse.json({ url: await creerCheckout(userId) }, { headers: NO_STORE })
    if (d.action === "portail") return NextResponse.json({ url: await creerPortail(userId) }, { headers: NO_STORE })
    if (d.action === "resilier") await resilier(userId)
    return NextResponse.json({ success: true }, { headers: NO_STORE })
  } catch (e) {
    return NextResponse.json({ error: e instanceof ErreurFacturation ? e.message : "L’opération n’a pas été confirmée. Réessayez dans un instant." }, { status: e instanceof ErreurFacturation ? e.status : 503, headers: NO_STORE })
  }
}
