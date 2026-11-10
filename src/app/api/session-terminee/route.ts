/**
 * GET /api/session-terminee
 *
 * Point de chute d'une session dont le compte a été désactivé ou supprimé
 * (`requireAuth`, cf. `src/lib/compte-actif.ts`). Renvoyer directement vers
 * /login bouclait : le jeton reste valide pour le middleware, qui renvoie un
 * connecté de /login vers l'accueil. Cette route efface le jeton, puis mène à
 * la page de connexion avec le motif.
 *
 * La déconnexion n'a lieu que si le compte est réellement inactif : un lien
 * piégé vers cette adresse ne déconnecte personne.
 */
import { NextResponse } from "next/server"
import { auth, signOut } from "@/lib/auth"
import { lireEtatCompte } from "@/lib/compte-actif"

export const dynamic = "force-dynamic"

// Adresse relative : derrière le reverse proxy, l'URL de la requête porte
// l'hôte interne du conteneur.
const vers = (chemin: string) => new NextResponse(null, { status: 307, headers: { Location: chemin } })

export async function GET() {
  const session = await auth()
  if (!session?.user) return vers("/login")
  const etat = await lireEtatCompte(session.user.id, session.user.impersonatedBy)
  if (etat.actif) return vers("/")
  // `signOut` efface le cookie de session puis redirige (il lève NEXT_REDIRECT).
  await signOut({ redirectTo: "/login?error=inactive" })
  return vers("/login?error=inactive")
}
