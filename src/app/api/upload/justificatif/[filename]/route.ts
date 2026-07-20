import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import { readFile } from "node:fs/promises"
import path from "node:path"

const SAFE_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|png)$/i
const MIME_BY_EXT: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", png: "image/png" }

export async function GET(_request: NextRequest, context: { params: Promise<{ filename: string }> }) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  const { filename } = await context.params
  if (!SAFE_FILENAME.test(filename)) {
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
