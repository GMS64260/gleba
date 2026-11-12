/**
 * GET /api/public/referentiel/medias/[id] — photo validée d'un végétal public.
 *
 * UI-01 (revue Codex du 2026-11-12) : la galerie publique ne s'affichait pas
 * pour un visiteur anonyme (`/uploads` exige une session). Cette route sert
 * uniquement un média VALIDÉ dont le végétal est visible publiquement, depuis
 * le dossier du référentiel ; tout autre cas répond 404.
 */
import { readFile } from "node:fs/promises"
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { visibiliteReferentielPublic } from "@/lib/referentiel-public"
import { fichierImageReferentiel } from "@/lib/referentiel-medias-public"

const introuvable = () => NextResponse.json({ error: "Image introuvable" }, { status: 404 })

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id || id.length > 100) return introuvable()

  const media = await prisma.mediaReferentiel.findFirst({
    where: { id, statut: "VALIDE", espece: visibiliteReferentielPublic },
    select: { url: true },
  })
  if (!media) return introuvable()

  const fichier = fichierImageReferentiel(media.url)
  if (!fichier) return introuvable()

  try {
    const contenu = await readFile(fichier)
    return new NextResponse(new Uint8Array(contenu), {
      headers: {
        "Content-Type": "image/jpeg",
        // Une heure : une photo retirée de la galerie cesse vite d'être servie.
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return introuvable()
  }
}
