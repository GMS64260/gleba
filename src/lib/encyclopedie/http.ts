import { NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import { getActeurId } from "@/lib/exploitation/garde-session"
import { estEmailDemo } from "@/lib/demo"
import prisma from "@/lib/prisma"
import { checkRateLimit } from "@/lib/rate-limit"

export const ENTETES_PRIVES = { "Cache-Control": "private, no-store", Vary: "Cookie" }
export async function membreEncyclopedie(request?: Request, action = "lecture") {
  const auth = await requireAuthApi(request)
  if (auth.error) return auth
  const acteurId = getActeurId(auth.session)
  // Le JWT conserve une identité et un rôle tant qu'il n'a pas expiré.
  // L'accès communautaire dépend de l'état courant de la PERSONNE en base.
  const compte = await prisma.user.findUnique({ where: { id: acteurId }, select: { id: true, email: true, active: true, role: true } })
  if (!compte) return { error: NextResponse.json({ error: "Ce compte n'existe plus." }, { status: 401 }), session: null }
  if (!compte.active) return { error: NextResponse.json({ error: "Ce compte est désactivé.", code: "COMPTE_INACTIF" }, { status: 403 }), session: null }
  if (estEmailDemo(compte.email)) return { error: NextResponse.json({
    error: "Les contributions et le forum sont réservés aux comptes personnels. Créez votre compte pour participer.", code: "COMPTE_DEMO",
  }, { status: 403 }), session: null }
  const plafond = checkRateLimit(`encyclopedie-${action}:${acteurId}`, { windowMs: 60000, max: action === "lecture" ? 100 : 15 })
  if (plafond) return { error: plafond, session: null }
  return { error: null, session: { ...auth.session, user: { ...auth.session.user, role: compte.role } } }
}
export async function moderateurEncyclopedie(request: Request) {
  const auth = await membreEncyclopedie(request, "moderation")
  if (auth.error) return auth
  if (auth.session.user.role !== "ADMIN") return { error: NextResponse.json({ error: "Accès interdit." }, { status: 403 }), session: null }
  return auth
}
export function corpsInvalide() { return NextResponse.json({ error: "Les champs sont incomplets ou invalides." }, { status: 400 }) }
