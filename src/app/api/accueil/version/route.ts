/**
 * GET /api/accueil/version — version d'accueil EFFECTIVE de la personne
 * connectée (`v1` ou `v2`), telle que le serveur la décide pour `/dashboard`
 * (`lireVersionAccueil` : préférence de l'acteur, ou `ACCUEIL_DEMO` pour le
 * compte démo dont les préférences sont figées).
 *
 * Le shell (rail, en-tête, bulle) lisait la préférence brute par
 * `/api/user/preferences` : le compte démo forcé en v2 par l'environnement
 * voyait l'accueil v2 mais perdait le rail sur les modules (2026-10-10).
 */

import { NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import { getActeurId } from "@/lib/exploitation/garde-session"
import { lireVersionAccueil } from "@/lib/accueil/preference.server"

export const dynamic = "force-dynamic"
export const revalidate = 0

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

export async function GET() {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const version = await lireVersionAccueil(getActeurId(session))
  return NextResponse.json({ version }, { headers: NO_STORE })
}
