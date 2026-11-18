/**
 * GET /api/session-terminee
 *
 * Point de chute d'une session dont le compte a été désactivé ou supprimé, ou
 * dont le mot de passe a changé depuis la connexion (MC3) (`requireAuth`, cf.
 * `src/lib/compte-actif.ts`). Renvoyer directement vers
 * /login bouclait : le jeton reste valide pour le middleware, qui renvoie un
 * connecté de /login vers l'accueil. Cette route efface le jeton, puis mène à
 * la page de connexion avec le motif.
 *
 * La déconnexion n'a lieu que si la session est réellement caduque : un lien
 * piégé vers cette adresse ne déconnecte personne.
 */
import { NextResponse } from "next/server"
import { auth, signOut } from "@/lib/auth"
import { lireEtatSession } from "@/lib/compte-actif"

export const dynamic = "force-dynamic"

// Adresse relative : derrière le reverse proxy, l'URL de la requête porte
// l'hôte interne du conteneur.
const vers = (chemin: string) => new NextResponse(null, { status: 307, headers: { Location: chemin } })

export async function GET() {
  const session = await auth()
  if (!session?.user) return vers("/login")
  const etat = await lireEtatSession(session.user)
  if (etat.actif) return vers("/")
  const cible = etat.motif === "session_revoquee" ? "/login?error=session_revoquee" : "/login?error=inactive"
  // `signOut` efface le cookie de session puis redirige (il lève NEXT_REDIRECT).
  await signOut({ redirectTo: cible })
  return vers(cible)
}
