/**
 * POST /api/upload/justificatif
 *
 * PROMPT DEV 1 #3 — Upload pièce justificative pour transactions
 * (Art. L102 B LPF : conservation 10 ans).
 *
 * Validation :
 *   - Auth requise
 *   - Formats : PDF, JPEG, PNG
 *   - Taille max : 10 MB
 *
 * Stockage :
 *   - storage/justificatifs/<userId>/<uuid>.<ext> (hors racine publique)
 *   - URL authentifiée : /api/upload/justificatif/<uuid>.<ext>
 *
 * Pas de traitement (le PDF / scan doit rester intègre pour valeur probante).
 *
 * Réponse : { url, filename, size }
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Corps multipart invalide" }, { status: 400 })
  }

  const file = formData.get("file")
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Champ 'file' manquant" }, { status: 400 })
  }

  const mime = (file as Blob).type
  const ext = ALLOWED_MIME[mime]
  if (!ext) {
    return NextResponse.json(
      { error: `Format non supporté (${mime}). Formats acceptés : PDF, JPEG, PNG.` },
      { status: 400 }
    )
  }

  const size = (file as Blob).size
  if (size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Fichier trop volumineux : ${(size / 1024 / 1024).toFixed(1)} Mo (max 10 Mo).` },
      { status: 400 }
    )
  }

  const userId = session!.user.id
  const uuid = randomUUID()
  const filename = `${uuid}.${ext}`
  const dir = path.join(process.cwd(), "storage", "justificatifs", userId)
  await mkdir(dir, { recursive: true })

  const buffer = Buffer.from(await (file as Blob).arrayBuffer())
  await writeFile(path.join(dir, filename), buffer)

  const url = `/api/upload/justificatif/${filename}`
  const originalName = (file as File).name || `justificatif.${ext}`

  return NextResponse.json({
    url,
    filename: originalName,
    size,
  })
}
