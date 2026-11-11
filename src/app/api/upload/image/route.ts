/**
 * POST /api/upload/image
 *
 * PROMPT 16 LOT A — Upload d'image avec resize Sharp.
 *
 * Validation :
 *   - Auth requise
 *   - Formats acceptés : JPEG, PNG, WebP
 *   - Taille max : 5 MB
 *
 * Traitement Sharp :
 *   - EXIF supprimé (vie privée GPS, métadonnées)
 *   - Auto-rotate selon EXIF orientation
 *   - Génère 2 tailles : 300×300 (thumbnail) + 1200×1200 (display)
 *   - Format de sortie : JPEG qualité 82 (compromis taille/qualité)
 *
 * Stockage :
 *   - public/uploads/<userId>/<uuid>-<size>.jpg
 *   - URLs publiques : /uploads/<userId>/<uuid>-<size>.jpg
 *
 * Réponse :
 *   { url: "/uploads/…1200.jpg", thumbnailUrl: "/uploads/…300.jpg" }
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { formatsPhotoSansMetadonnees } from "@/lib/upload-image"
import { dossierEnvoi, refusEnvoiFichier } from "@/lib/upload-garde"

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"])

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

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Image trop volumineuse (${(file.size / 1024 / 1024).toFixed(1)} MB > 5 MB)` },
      { status: 413 }
    )
  }

  // Détection MIME via Blob.type. Pour les requêtes propres on a un type ;
  // pour les requêtes douteuses, Sharp validera à l'ouverture.
  if (file.type && !ALLOWED_MIME.has(file.type.toLowerCase())) {
    return NextResponse.json(
      { error: `Format ${file.type} non supporté (JPEG/PNG/WebP attendu)` },
      { status: 415 }
    )
  }

  const userId = session!.user.id
  const refus = await refusEnvoiFichier("image", userId, file.size)
  if (refus) return refus

  const buffer = Buffer.from(await file.arrayBuffer())

  // Dossier user-spécifique sous public/uploads
  const userDir = dossierEnvoi("image", userId)
  await mkdir(userDir, { recursive: true })

  const uuid = randomUUID()
  // Deux formats sans aucune métadonnée de l'original (EXIF, GPS) : règle et
  // piège de Sharp dans `formatsPhotoSansMetadonnees`.
  try {
    const { grand: largeBuf, vignette: thumbBuf } = await formatsPhotoSansMetadonnees(buffer)

    const largeName = `${uuid}-1200.jpg`
    const thumbName = `${uuid}-300.jpg`
    await Promise.all([
      writeFile(path.join(userDir, largeName), largeBuf),
      writeFile(path.join(userDir, thumbName), thumbBuf),
    ])

    return NextResponse.json({
      url: `/uploads/${userId}/${largeName}`,
      thumbnailUrl: `/uploads/${userId}/${thumbName}`,
      width: 1200,
      height: 1200,
      sizeBytes: largeBuf.length,
    })
  } catch (err) {
    console.error("POST /api/upload/image error:", err)
    return NextResponse.json(
      { error: "Image illisible (format ou contenu corrompu)" },
      { status: 422 }
    )
  }
}
