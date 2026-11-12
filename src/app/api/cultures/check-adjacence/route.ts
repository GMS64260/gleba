/**
 * PROMPT DEV 2 Bug #10 — Preview adjacence avant création culture.
 *
 * GET /api/cultures/check-adjacence?especeId=X&plancheId=Y[&debut=AAAA-MM-JJ&fin=AAAA-MM-JJ]
 *   → { alertes, suggestions, planchesVoisines }
 *
 * Le formulaire NewCulture appelle cet endpoint dès qu'espèce + planche sont
 * sélectionnés pour afficher un encart "Compatibilités voisinage" non bloquant.
 * Avec `debut` et `fin` (occupation prévue de la culture), les cultures de la
 * planche elle-même sont évaluées aussi, et seules celles qui cohabitent avec
 * la candidate comptent.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi, getUserId } from "@/lib/auth-utils"
import { checkAdjacence, type PeriodeCandidate } from "@/lib/associations-adjacence"

/** Jour civil « AAAA-MM-JJ » → minuit UTC, comme les dates stockées ; `null` sinon. */
function lireJour(valeur: string | null): Date | null {
  if (!valeur || !/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return null
  const date = new Date(`${valeur}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const especeId = searchParams.get("especeId")
  const plancheId = searchParams.get("plancheId")
  if (!especeId || !plancheId) {
    return NextResponse.json(
      { error: "especeId et plancheId requis" },
      { status: 400 }
    )
  }

  // Période incomplète ou incohérente : on retombe sur l'analyse du seul voisinage.
  const debut = lireJour(searchParams.get("debut"))
  const fin = lireJour(searchParams.get("fin"))
  const periode: PeriodeCandidate | null = debut && fin && fin >= debut ? { debut, fin } : null

  try {
    // `getUserId` : l'exploitation, pas le compte qui agit (exploitation partagée).
    const result = await checkAdjacence(especeId, plancheId, getUserId(session), undefined, new Date(), periode)
    return NextResponse.json(result)
  } catch (err) {
    console.error("GET /api/cultures/check-adjacence error:", err)
    return NextResponse.json(
      { error: "Erreur lors de l'analyse du voisinage" },
      { status: 500 }
    )
  }
}
