/**
 * Ancien justificatif stocké sous `public/uploads/<compte>/justificatifs/`,
 * servi à la seule personne propriétaire du dossier.
 *
 * GET /api/upload/ancien-justificatif/<compte>/<fichier>
 *
 * Les justificatifs récents vivent hors de `public` (`storage/justificatifs`,
 * route `/api/upload/justificatif/<fichier>`). Les plus anciens restent sous
 * `public/uploads` : le middleware ne les sert plus en direct, il réécrit
 * `/uploads/<compte>/justificatifs/<fichier>` vers cette route, qui revalide
 * la session par `requireAuthApi` (compte actif, version de session — MC3 :
 * un cookie révoqué par un changement de mot de passe ne lit plus rien).
 * Comme avant, seul le titulaire du dossier (l'acteur, pas l'exploitation
 * visitée) y accède. Le refus est un 404, qui ne confirme pas l'existence du
 * fichier.
 */
import { NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { requireAuthApi } from "@/lib/auth-utils"

export const dynamic = "force-dynamic"

const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
}

/** Nom de fichier simple : ni séparateur, ni remontée, ni caractère nul, extension connue. */
function typeDuFichier(fichier: string): string | null {
  if (!fichier || fichier.length > 255 || fichier.startsWith(".")) return null
  if (/[/\\\0]/.test(fichier)) return null
  const extension = fichier.slice(fichier.lastIndexOf(".") + 1).toLowerCase()
  return TYPES[extension] ?? null
}

const introuvable = () => new NextResponse(null, { status: 404 })

export async function GET(_request: Request, { params }: { params: Promise<{ proprietaire: string; fichier: string }> }) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const { proprietaire, fichier } = await params
  const type = typeDuFichier(fichier)
  if (proprietaire !== session!.user.acteurId || !type) return introuvable()
  try {
    const contenu = await readFile(path.join(process.cwd(), "public", "uploads", proprietaire, "justificatifs", fichier))
    return new NextResponse(new Uint8Array(contenu), {
      status: 200,
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return introuvable()
  }
}
