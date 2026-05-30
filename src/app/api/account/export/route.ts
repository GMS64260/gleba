/**
 * Export complet du compte utilisateur.
 * GET /api/account/export
 *
 * Télécharge un fichier JSON contenant TOUTES les données de l'utilisateur
 * connecté (maraîchage, verger, élevage, compta, stocks, météo, préférences…)
 * + les référentiels nécessaires. Destiné à la migration vers une instance
 * auto-hébergée (Raspberry Pi…).
 */

import { NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import { exportAccount } from "@/lib/account-transfer"

const APP_VERSION = process.env.npm_package_version || "1.0.0"

export async function GET(request: Request) {
  const { error, session } = await requireAuthApi(request)
  if (error) return error

  try {
    const result = await exportAccount(session!.user.id, APP_VERSION)
    const date = result.exportDate.split("T")[0]
    const filename = `gleba_sauvegarde_complete_${date}.json`

    return new NextResponse(JSON.stringify(result, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    console.error("GET /api/account/export error:", e)
    return NextResponse.json(
      { error: "Erreur lors de l'export complet du compte" },
      { status: 500 },
    )
  }
}
