/**
 * Photos validées du référentiel public, servies sans session.
 *
 * UI-01 (revue Codex du 2026-11-12) : la fiche publique d'un végétal
 * affichait ses photos par leur URL de stockage `/uploads/referentiel/...`.
 * Le middleware exige une session sur `/uploads/*` (justificatifs et fichiers
 * privés y vivent) : un visiteur anonyme, et l'optimiseur d'images de Next
 * qui appelle la source sans cookies, recevaient un 307 vers /login. Les
 * photos passent par une route publique qui ne sert QUE les médias validés
 * d'un végétal public ; `/uploads` reste fermé.
 */
import path from "node:path"

/** Adresse publique de la photo validée `id` (grand format). */
export function srcImageReferentielPublique(id: string): string {
  return `/api/public/referentiel/medias/${encodeURIComponent(id)}`
}

// Seuls les fichiers écrits par `stockerImageReferentiel` (grand format) sont lisibles.
const URL_STOCKEE = /^\/uploads\/referentiel\/(commons|membre)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-1200\.jpg$/

/** Chemin disque du fichier d'une URL stockée, ou `null` si l'URL sort du dossier du référentiel. */
export function fichierImageReferentiel(urlStockee: string, racine = process.cwd()): string | null {
  const m = URL_STOCKEE.exec(urlStockee)
  if (!m) return null
  return path.join(racine, "public", "uploads", "referentiel", m[1], `${m[2]}-1200.jpg`)
}
