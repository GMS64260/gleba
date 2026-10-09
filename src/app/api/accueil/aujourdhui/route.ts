/**
 * GET /api/accueil/aujourdhui — composition de l'accueil v2 (« La ferme
 * d'abord », bento) : liste du jour classée par urgence, état des planches
 * pour la vignette du plan, repères, agenda élevage. Lecture seule.
 *
 * Toute la logique vit dans `src/lib/accueil/composition.server.ts`, qui
 * appelle les services existants avec la même session (tenant pour les
 * données, acteur pour les préférences). Réponse jamais mise en cache : un
 * arrosage noté doit disparaître de la liste au rechargement suivant.
 */

import { NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import { composerAujourdhui } from "@/lib/accueil/composition.server"

export const dynamic = "force-dynamic"
export const revalidate = 0

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

export async function GET() {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const donnees = await composerAujourdhui(session)
    return NextResponse.json(donnees, { headers: NO_STORE })
  } catch (e) {
    console.error("GET /api/accueil/aujourdhui error:", e)
    return NextResponse.json(
      { error: "Impossible de composer l'accueil du jour. Réessayez dans un instant." },
      { status: 500, headers: NO_STORE },
    )
  }
}
