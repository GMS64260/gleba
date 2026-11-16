/**
 * GET /api/agroclimat/gel?parcelleId=…
 *
 * Gel mesuré sur la parcelle depuis trente ans : dernière gelée de printemps,
 * première gelée d'automne, date de prudence, saison sans gel et tendance.
 * Sans `parcelleId`, la parcelle de référence de l'exploitation.
 *
 * La première demande d'une parcelle lance l'import de son historique
 * (quelques minutes) et répond `en_preparation`.
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getUserId, requireAuthApi } from "@/lib/auth-utils"
import { gelDeLaParcelle } from "@/lib/agroclimat/gel-parcelle"

const rechercheSchema = z.object({ parcelleId: z.string().min(1).max(64).optional() })

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  const recherche = rechercheSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!recherche.success) return NextResponse.json({ error: "Parcelle invalide." }, { status: 400 })

  try {
    const gel = await gelDeLaParcelle(getUserId(session), recherche.data.parcelleId)
    if (gel.etat === "sans_localisation" && recherche.data.parcelleId) {
      return NextResponse.json({ error: "Parcelle non trouvée ou sans coordonnées GPS" }, { status: 404 })
    }
    return NextResponse.json(gel, { headers: { "Cache-Control": "private, no-store" } })
  } catch (err) {
    console.error("GET /api/agroclimat/gel error:", err)
    return NextResponse.json({ error: "Erreur lecture du gel de la parcelle" }, { status: 500 })
  }
}
