/**
 * Photo envoyée d'une exploitation, servie à ses seuls membres.
 *
 * GET /api/upload/photo/<exploitation>/<uuid>-<taille>.jpg
 *
 * Les photos vivent sous `public/uploads/<exploitation>/`. Le middleware
 * laisse passer le propriétaire du dossier ; pour toute autre personne
 * connectée, il réécrit `/uploads/…` vers cette route, qui connaît
 * l'exploitation en cours (adhésion lue en base par `requireAuthApi`) : un
 * membre voit les photos de l'exploitation où il travaille, personne ne voit
 * celles d'une autre, même en connaissant l'adresse. Le refus est un 404, qui
 * ne confirme pas l'existence du fichier.
 *
 * La vitrine publique de la boutique a sa propre route de médias.
 */
import { NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { requireAuthApi } from "@/lib/auth-utils"
import { dossierEnvoi, FICHIER_IMAGE_ENVOYEE } from "@/lib/upload-garde"

export const dynamic = "force-dynamic"

const introuvable = () => new NextResponse(null, { status: 404 })

export async function GET(_request: Request, { params }: { params: Promise<{ proprietaire: string; fichier: string }> }) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const { proprietaire, fichier } = await params
  if (proprietaire !== session!.user.id || !FICHIER_IMAGE_ENVOYEE.test(fichier)) return introuvable()
  try {
    const contenu = await readFile(path.join(dossierEnvoi("image", proprietaire), fichier))
    return new NextResponse(new Uint8Array(contenu), {
      status: 200,
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
    })
  } catch {
    return introuvable()
  }
}
