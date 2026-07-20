/**
 * API image de fond du plan 2D — persistance serveur (synchro multi-appareils).
 *
 * GET    /api/jardin/fond?parcelle=<id|global> — réglages du fond effectif
 *        (fond de la parcelle, sinon repli sur le fond global)
 * POST   /api/jardin/fond (multipart) — créer/remplacer l'image + réglages
 * PATCH  /api/jardin/fond (JSON) — mettre à jour les réglages seuls
 *        (opacité, échelle m/px, décalage, rotation — ex. calibration 2 points)
 * DELETE /api/jardin/fond?parcelle= — supprimer le fond (ligne + fichier)
 *
 * Le binaire est servi par /api/jardin/fond/image (route authentifiée
 * propriétaire), jamais depuis la racine publique.
 */

import { NextRequest, NextResponse } from "next/server"
import { mkdir, writeFile, unlink } from "node:fs/promises"
import path from "node:path"
import { z } from "zod"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import {
  FOND_ALLOWED_MIME,
  FOND_MAX_BYTES,
  fondStorageDir,
  normaliseParcelleKey,
  resolveFond,
} from "@/lib/fond-plan"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

const reglagesSchema = z.object({
  opacity: z.number().min(0.05).max(1).optional(),
  scale: z.number().min(0.0005).max(10).optional(),
  offsetX: z.number().min(-10000).max(10000).optional(),
  offsetY: z.number().min(-10000).max(10000).optional(),
  rotation: z.number().min(-360).max(360).optional(),
})

// Contours de parcelle en pixels image : anneaux de points [px, py]
const contourSchema = z
  .array(z.array(z.tuple([z.number().finite(), z.number().finite()])).min(3).max(2000))
  .min(1)
  .max(20)

function parseContour(raw: string | null): string | null {
  if (!raw) return null
  try {
    const parsed = contourSchema.parse(JSON.parse(raw))
    return JSON.stringify(parsed)
  } catch {
    return null
  }
}

function fondJson(fond: NonNullable<Awaited<ReturnType<typeof resolveFond>>>) {
  return {
    exists: true,
    parcelleKey: fond.parcelleKey,
    // "global" = fond commun à toutes les parcelles ; "parcelle" = fond propre
    source: fond.parcelleKey === "global" ? ("global" as const) : ("parcelle" as const),
    opacity: fond.opacity,
    scale: fond.scale,
    offsetX: fond.offsetX,
    offsetY: fond.offsetY,
    rotation: fond.rotation,
    contour: fond.contour ? (JSON.parse(fond.contour) as number[][][]) : null,
    mimeType: fond.mimeType,
    imageUrl: `/api/jardin/fond/image?parcelle=${encodeURIComponent(fond.parcelleKey)}&v=${fond.updatedAt.getTime()}`,
  }
}

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  const key = normaliseParcelleKey(request.nextUrl.searchParams.get("parcelle"))
  if (!key) return NextResponse.json({ error: "Parcelle invalide" }, { status: 400 })

  const fond = await resolveFond(session!.user.id, key)
  if (!fond) return NextResponse.json({ exists: false }, { headers: NO_STORE })
  return NextResponse.json(fondJson(fond), { headers: NO_STORE })
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Corps multipart invalide" }, { status: 400 })
  }

  const key = normaliseParcelleKey(
    typeof formData.get("parcelle") === "string" ? (formData.get("parcelle") as string) : null
  )
  if (!key) return NextResponse.json({ error: "Parcelle invalide" }, { status: 400 })

  const file = formData.get("file")
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Champ 'file' manquant" }, { status: 400 })
  }
  const ext = FOND_ALLOWED_MIME[(file as Blob).type]
  if (!ext) {
    return NextResponse.json(
      { error: `Format non supporté (${(file as Blob).type}). Formats acceptés : JPEG, PNG, WebP.` },
      { status: 400 }
    )
  }
  if ((file as Blob).size > FOND_MAX_BYTES) {
    return NextResponse.json(
      { error: `Image trop volumineuse : ${((file as Blob).size / 1024 / 1024).toFixed(1)} Mo (max 10 Mo).` },
      { status: 400 }
    )
  }

  // Réglages optionnels transmis avec l'image (chaînes numériques du FormData)
  const rawReglages: Record<string, number> = {}
  for (const champ of ["opacity", "scale", "offsetX", "offsetY", "rotation"] as const) {
    const v = formData.get(champ)
    if (typeof v === "string" && v !== "") {
      const n = Number(v)
      if (Number.isFinite(n)) rawReglages[champ] = n
    }
  }
  const parsed = reglagesSchema.safeParse(rawReglages)
  if (!parsed.success) {
    return NextResponse.json({ error: "Réglages invalides", details: parsed.error.flatten() }, { status: 400 })
  }

  const dir = fondStorageDir(userId)
  await mkdir(dir, { recursive: true })
  const fichier = `${key}.${ext}`
  const buffer = Buffer.from(await (file as Blob).arrayBuffer())
  await writeFile(path.join(dir, fichier), buffer)

  const existing = await prisma.fondPlan.findUnique({
    where: { userId_parcelleKey: { userId, parcelleKey: key } },
  })
  // L'extension a pu changer (png → jpg) : purger l'ancien binaire orphelin
  if (existing && existing.fichier !== fichier) {
    await unlink(path.join(dir, path.basename(existing.fichier))).catch(() => {})
  }

  // Contour de parcelle (px image) : lié à l'image, il est remplacé — ou
  // effacé — à chaque nouvel envoi (une photo importée à la main n'a pas
  // de contour connu).
  const contour = parseContour(
    typeof formData.get("contour") === "string" ? (formData.get("contour") as string) : null
  )

  const fond = await prisma.fondPlan.upsert({
    where: { userId_parcelleKey: { userId, parcelleKey: key } },
    update: { fichier, mimeType: (file as Blob).type, contour, ...parsed.data },
    create: { userId, parcelleKey: key, fichier, mimeType: (file as Blob).type, contour, ...parsed.data },
  })

  return NextResponse.json(fondJson(fond), { status: 201, headers: NO_STORE })
}

export async function PATCH(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 })
  }
  const parcelle = (body as { parcelle?: unknown })?.parcelle
  const key = normaliseParcelleKey(typeof parcelle === "string" ? parcelle : null)
  if (!key) return NextResponse.json({ error: "Parcelle invalide" }, { status: 400 })

  const parsed = reglagesSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Réglages invalides", details: parsed.error.flatten() }, { status: 400 })
  }

  // La calibration s'applique au fond EFFECTIF : si la parcelle affiche le
  // fond global, c'est bien la ligne globale qu'il faut mettre à jour.
  const fond = await resolveFond(userId, key)
  if (!fond) return NextResponse.json({ error: "Aucun fond à mettre à jour" }, { status: 404 })

  const updated = await prisma.fondPlan.update({
    where: { id: fond.id },
    data: parsed.data,
  })
  return NextResponse.json(fondJson(updated), { headers: NO_STORE })
}

export async function DELETE(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id

  const key = normaliseParcelleKey(request.nextUrl.searchParams.get("parcelle"))
  if (!key) return NextResponse.json({ error: "Parcelle invalide" }, { status: 400 })

  const fond = await prisma.fondPlan.findUnique({
    where: { userId_parcelleKey: { userId, parcelleKey: key } },
  })
  if (!fond) return NextResponse.json({ exists: false }, { headers: NO_STORE })

  await prisma.fondPlan.delete({ where: { id: fond.id } })
  await unlink(path.join(fondStorageDir(userId), path.basename(fond.fichier))).catch(() => {})

  return NextResponse.json({ exists: false }, { headers: NO_STORE })
}
