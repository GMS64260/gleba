/**
 * GET /api/admin/referentiel/medias/[id]/image — photo d'un média du
 * référentiel, quel que soit son statut, pour l'administrateur qui la modère.
 *
 * Équipe debug, D56 et D64 : la file de modération affichait les photos
 * proposées par leur URL de stockage `/uploads/referentiel/membre/...`. Ce
 * chemin n'est servi par aucune route (le middleware ne réécrit que les
 * justificatifs et les photos à deux segments), et l'optimiseur d'images de
 * Next l'appelle sans cookie : l'administrateur validait des photos qu'il ne
 * voyait pas. La route publique voisine ne sert, elle, que les médias validés.
 */
import { readFile } from "node:fs/promises"
import { NextRequest, NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import { fichierImageReferentiel } from "@/lib/referentiel-medias-public"

const introuvable = () => NextResponse.json({ error: "Image introuvable" }, { status: 404 })

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Sans `request` : pas de quota par adresse, une file de modération charge
  // toutes ses photos d'un coup.
  const { error } = await requireAdminApi()
  if (error) return error

  const { id } = await params
  if (!id || id.length > 100) return introuvable()

  const media = await prisma.mediaReferentiel.findUnique({ where: { id }, select: { url: true } })
  if (!media) return introuvable()

  const fichier = fichierImageReferentiel(media.url)
  if (!fichier) return introuvable()

  try {
    const contenu = await readFile(fichier)
    return new NextResponse(new Uint8Array(contenu), {
      headers: {
        "Content-Type": "image/jpeg",
        // Photo non publiée : jamais dans un cache partagé.
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return introuvable()
  }
}
