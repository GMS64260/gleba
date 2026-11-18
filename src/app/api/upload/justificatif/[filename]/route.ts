import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { estNomJustificatif } from "@/lib/comptabilite/justificatif"

const MIME_BY_EXT: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", png: "image/png" }

export async function GET(_request: NextRequest, context: { params: Promise<{ filename: string }> }) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  const { filename } = await context.params
  if (!estNomJustificatif(filename)) {
    return NextResponse.json({ error: "Justificatif invalide" }, { status: 400 })
  }

  try {
    const file = await readFile(path.join(process.cwd(), "storage", "justificatifs", session!.user.id, filename))
    const ext = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase()
    return new NextResponse(file, {
      headers: {
        "Content-Type": MIME_BY_EXT[ext],
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return NextResponse.json({ error: "Justificatif introuvable" }, { status: 404 })
  }
}
