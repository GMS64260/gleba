/**
 * Module Maraîchage — home par défaut (PROMPT 21).
 *
 * Ancien accueil (v1) : la page redirige vers le dashboard global `/`, qui
 * EST le module maraîchage avec son calendrier de la semaine. Les sous-routes
 * dédiées (`/maraichage/cultures`, `/maraichage/recoltes`,
 * `/maraichage/planches`) restent accessibles directement.
 *
 * Accueil v2 (2026-10-10) : `/dashboard` redirige vers `/aujourdhui`, donc
 * rediriger ici vers `/` renvoyait « Cultures » du rail… à l'accueil. Pour
 * une personne en v2, cette page rend directement le module (onglets
 * Calendrier, Cultures, Terrain…) sous le rail ; l'URL reste `/maraichage`.
 *
 * Feedback Marc 2026-05-16 — V2 Bug 7 : `/maraichage?tab=cultures`
 * arrivait sur le calendrier (les query params étaient perdus par
 * `redirect("/")`). On préserve désormais le `searchParams` pour que
 * l'utilisateur arrive sur le bon onglet.
 */

import { redirect } from "next/navigation"
import { MaraichageHome } from "@/components/maraichage/MaraichageHome"
import { getSession } from "@/lib/auth-utils"
import { lireVersionAccueil } from "@/lib/accueil/preference.server"

// La version d'accueil se lit en base à chaque requête : jamais de rendu statique.
export const dynamic = "force-dynamic"

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function MaraichagePage({ searchParams }: PageProps) {
  const session = await getSession()
  const acteurId = session?.user?.id
  if (acteurId && (await lireVersionAccueil(acteurId)) === "v2") {
    return <MaraichageHome />
  }
  const params = await searchParams
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue
    if (Array.isArray(value)) {
      for (const v of value) sp.append(key, v)
    } else {
      sp.set(key, value)
    }
  }
  const query = sp.toString()
  redirect(query ? `/?${query}` : "/")
}
