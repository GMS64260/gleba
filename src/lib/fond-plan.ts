/**
 * Helpers serveur pour l'image de fond du plan 2D (FondPlan).
 *
 * Le binaire vit dans storage/plan-fonds/<userId>/<parcelleKey>.<ext>
 * (volume Docker, hors racine publique) ; la table fonds_plan porte le
 * chemin et les réglages d'affichage. Une ligne par user × parcelle,
 * parcelleKey = id de ParcelleGeo ou "global" (fond commun).
 */

import path from "node:path"
import prisma from "@/lib/prisma"

// cuid de ParcelleGeo, "global" ou "none" (éléments sans parcelle)
export const FOND_PARCELLE_KEY_RE = /^[A-Za-z0-9_-]{1,64}$/

export const FOND_MAX_BYTES = 10 * 1024 * 1024

export const FOND_ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

export function fondStorageDir(userId: string): string {
  return path.join(process.cwd(), "storage", "plan-fonds", userId)
}

/**
 * Normalise le paramètre ?parcelle= : absent ou "all" → "global".
 * Retourne null si la clé ne ressemble ni à un id ni à une clé connue.
 */
export function normaliseParcelleKey(raw: string | null): string | null {
  const key = raw && raw !== "all" ? raw : "global"
  return FOND_PARCELLE_KEY_RE.test(key) ? key : null
}

/**
 * Fond effectif pour une parcelle : celui de la parcelle s'il existe,
 * sinon repli sur le fond global de l'utilisateur.
 */
export async function resolveFond(userId: string, parcelleKey: string) {
  const fond = await prisma.fondPlan.findUnique({
    where: { userId_parcelleKey: { userId, parcelleKey } },
  })
  if (fond || parcelleKey === "global") return fond
  return prisma.fondPlan.findUnique({
    where: { userId_parcelleKey: { userId, parcelleKey: "global" } },
  })
}
