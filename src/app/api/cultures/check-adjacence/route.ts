/**
 * PROMPT DEV 2 Bug #10 — Preview adjacence avant création culture.
 *
 * GET /api/cultures/check-adjacence?especeId=X&plancheId=Y
 *   → { alertes, suggestions, planchesVoisines }
 *
 * Le formulaire NewCulture appelle cet endpoint dès qu'espèce + planche sont
 * sélectionnés pour afficher un encart "Compatibilités voisinage" non bloquant.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import { checkAdjacence } from "@/lib/associations-adjacence"

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

  const result = await checkAdjacence(especeId, plancheId, session.user.id)
  return NextResponse.json(result)
}
