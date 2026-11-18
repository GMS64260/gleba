/**
 * GET /api/session-etat
 *
 * Les pages de l'application sont des composants client : le middleware (Edge,
 * sans base) les sert sur la foi du seul jeton. Une session devenue caduque
 * (mot de passe changé ailleurs — MC3 —, compte désactivé ou supprimé,
 * administrateur de la consultation rétrogradé) affichait donc la page, puis
 * chaque appel d'API répondait 401. `GardeSession` interroge cette route à
 * chaque page et au retour sur l'onglet ; `valide: false` le renvoie vers
 * /api/session-terminee, qui efface le jeton et mène à la connexion.
 *
 * Même point de décision que les gardes d'API : `lireEtatCompte`. Une panne
 * de lecture répond 500 : le client ne déconnecte pas sur une erreur.
 */
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { lireEtatSession } from "@/lib/compte-actif"

export const dynamic = "force-dynamic"

const repondre = (valide: boolean) =>
  NextResponse.json({ valide }, { headers: { "Cache-Control": "no-store" } })

export async function GET() {
  const session = await auth()
  if (!session?.user) return repondre(false)
  const etat = await lireEtatSession(session.user)
  return repondre(etat.actif)
}
