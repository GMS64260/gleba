/**
 * API Tâches Verger - Tâches de la semaine pour le dashboard verger
 * GET /api/arbres/taches?start=ISO&end=ISO
 * Miroir du pattern /api/taches du potager.
 * Le calcul vit dans src/lib/taches-verger.ts (SSOT partagée avec l'outil
 * assistant `get_taches_verger`) — lot assistant 2026-08-11.
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import { getTachesVerger } from "@/lib/taches-verger"

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const searchParams = request.nextUrl.searchParams
    const start = searchParams.get("start")
    const end = searchParams.get("end")

    if (!start || !end) {
      return NextResponse.json({ error: "Les paramètres start et end sont requis" }, { status: 400 })
    }

    const taches = await getTachesVerger(session!.user.id, {
      start: new Date(start),
      end: new Date(end),
    })
    return NextResponse.json(taches)
  } catch (err) {
    console.error("GET /api/arbres/taches error:", err)
    return NextResponse.json({ error: "Erreur lors de la récupération des tâches" }, { status: 500 })
  }
}
