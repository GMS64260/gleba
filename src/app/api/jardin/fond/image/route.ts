/**
 * GET /api/jardin/fond/image?parcelle=<id|global>&v=<updatedAt>
 *
 * Sert le binaire de l'image de fond du plan 2D — propriétaire uniquement
 * (même modèle que les justificatifs : stockage hors racine publique, route
 * authentifiée). Le paramètre `v` sert au cache-busting : la réponse est
 * cachable en privé car l'URL change à chaque remplacement de l'image.
 */

import { NextRequest, NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { requireAuthApi } from "@/lib/auth-utils"
import { fondStorageDir, normaliseParcelleKey, resolveFond } from "@/lib/fond-plan"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  const key = normaliseParcelleKey(request.nextUrl.searchParams.get("parcelle"))
  if (!key) return NextResponse.json({ error: "Parcelle invalide" }, { status: 400 })

  const fond = await resolveFond(session!.user.id, key)
  if (!fond) return NextResponse.json({ error: "Aucun fond" }, { status: 404 })

  try {
    const file = await readFile(
      path.join(fondStorageDir(session!.user.id), path.basename(fond.fichier))
    )
    return new NextResponse(file, {
      headers: {
        "Content-Type": fond.mimeType,
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 })
  }
}
