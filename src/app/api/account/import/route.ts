/**
 * Import complet du compte utilisateur.
 * POST /api/account/import   (multipart/form-data, champ "file")
 *
 * Restaure un fichier produit par GET /api/account/export dans le compte de
 * l'utilisateur connecté. Conçu pour la migration en ligne → auto-hébergé.
 *
 * Recommandation : importer dans un compte vierge (les contraintes d'unicité
 * par utilisateur — nom de planche, numéro de facture… — feraient échouer un
 * import par-dessus des données existantes ; toute la transaction est alors
 * annulée, sans demi-import).
 *
 * Paramètre optionnel `?dryRun=1` : valide le fichier et simule l'import dans
 * une transaction annulée (rien n'est écrit). Utile pour pré-vérifier.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import { importAccount, isValidExportPayload } from "@/lib/account-transfer"

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 Mo

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi(request)
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const dryRun = searchParams.get("dryRun") === "1"

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Fichier trop volumineux (max 50 Mo)" },
        { status: 413 },
      )
    }

    let payload: unknown
    try {
      payload = JSON.parse(await file.text())
    } catch {
      return NextResponse.json({ error: "Format JSON invalide" }, { status: 400 })
    }

    if (!isValidExportPayload(payload)) {
      return NextResponse.json(
        {
          error:
            "Fichier non reconnu. Utilisez une sauvegarde complète générée par Gleba (bouton « Sauvegarde complète »).",
        },
        { status: 400 },
      )
    }

    const result = await importAccount(session!.user.id, payload, {
      dryRun,
      isAdmin: session!.user.role === "ADMIN",
    })

    return NextResponse.json({
      success: true,
      dryRun,
      message: dryRun
        ? `Validation OK : ${result.total} enregistrements prêts à être importés.`
        : `${result.total} enregistrements importés.`,
      imported: result.imported,
      skipped: result.skipped,
      warnings: result.warnings,
    })
  } catch (e) {
    console.error("POST /api/account/import error:", e)
    return NextResponse.json(
      {
        error:
          "Échec de l'import. Vérifiez que vous importez dans un compte vierge (un compte déjà rempli provoque des conflits). Aucune donnée n'a été modifiée.",
      },
      { status: 500 },
    )
  }
}
