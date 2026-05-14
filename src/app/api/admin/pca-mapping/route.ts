/**
 * GET /api/admin/pca-mapping
 *
 * PROMPT DEV 1 #8 — Sert le fichier YAML `data/pca-mapping.yaml`
 * (matrice catégorie → compte PCA) en lecture seule.
 *
 * Le fichier est versionné dans Git (audit-trail réglementaire) : toute
 * modification passe par une PR validée par un expert-comptable agricole.
 */

import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth-utils"
import { readFile } from "node:fs/promises"
import path from "node:path"

export async function GET() {
  const { error } = await requireAdminApi()
  if (error) return error

  try {
    const file = path.join(process.cwd(), "data", "pca-mapping.yaml")
    const yaml = await readFile(file, "utf-8")
    return new NextResponse(yaml, {
      status: 200,
      headers: {
        "Content-Type": "application/yaml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch (err) {
    console.error("GET /api/admin/pca-mapping error:", err)
    return NextResponse.json(
      { error: "Mapping PCA introuvable" },
      { status: 500 }
    )
  }
}
