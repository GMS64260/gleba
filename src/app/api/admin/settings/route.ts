import { NextRequest, NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth-utils"
import {
  getSettingsWithProvenance,
  setSetting,
  SettingValidationError,
} from "@/lib/settings"

// GET /api/admin/settings
export async function GET() {
  const { error, session } = await requireAdminApi()
  if (error) return error
  void session

  try {
    return NextResponse.json(await getSettingsWithProvenance())
  } catch (error) {
    console.error("GET /api/admin/settings error:", error)
    return NextResponse.json(
      { error: "Erreur lors de la récupération des réglages" },
      { status: 500 }
    )
  }
}

// POST /api/admin/settings
export async function POST(request: NextRequest) {
  const { error, session } = await requireAdminApi()
  if (error) return error
  void session

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 })
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Le corps doit contenir une clé et une valeur" }, { status: 400 })
  }

  const { cle, valeur } = body as { cle?: unknown; valeur?: unknown }
  if (typeof cle !== "string") {
    return NextResponse.json({ error: "Clé de réglage inconnue" }, { status: 400 })
  }

  try {
    const valeurEffective = await setSetting(cle, valeur)
    return NextResponse.json({ cle, valeur: valeurEffective })
  } catch (error) {
    if (error instanceof SettingValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error("POST /api/admin/settings error:", error)
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement du réglage" },
      { status: 500 }
    )
  }
}
