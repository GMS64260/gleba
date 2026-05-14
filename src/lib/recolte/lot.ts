/**
 * DEV3 audit Marc 2026-05-14 - Bloquant #4
 *
 * Helpers traçabilité Bio/HVE pour les récoltes fruits et bois :
 *   - Génération du numéro de lot YYYYMMDD-PARCELLE-ESPECE-NN
 *   - Conversion m³ plein ↔ stère (1 stère = 1 m³ apparent)
 *
 * Pourquoi 0.6 pour la conversion stère→m³ plein : un stère de bois
 * fendu de 33-50 cm contient environ 0.6 m³ de bois plein (le reste
 * étant du vide). Source : norme NF B53-020.
 */

export const STERE_PER_M3_PLEIN = 1 / 0.6 // ≈ 1.667 stères par m³ plein
export const M3_PLEIN_PER_STERE = 0.6     // 0.6 m³ plein par stère

/** Convertit un volume en m³ plein vers stères. */
export function m3PleinToStere(m3: number | null | undefined): number | null {
  if (m3 == null) return null
  return Math.round(m3 * STERE_PER_M3_PLEIN * 100) / 100
}

/** Convertit un volume en stères vers m³ plein. */
export function stereToM3Plein(stere: number | null | undefined): number | null {
  if (stere == null) return null
  return Math.round(stere * M3_PLEIN_PER_STERE * 100) / 100
}

/**
 * Normalise un fragment de texte (parcelle, espèce) pour numéro de lot :
 * supprime tout sauf alphanumérique, tronque à 8 chars.
 */
function slugFragment(s: string | null | undefined, maxLen = 8): string {
  if (!s) return "NA"
  const cleaned = s.replace(/[^A-Za-z0-9]/g, "")
  return cleaned.slice(0, maxLen) || "NA"
}

/**
 * Génère un numéro de lot YYYYMMDD-PARCELLE-ESPECE-NN.
 * `numeroSequence` est typiquement le rank dans la journée pour la
 * combinaison (parcelle, espèce). Si non fourni, défaut "01".
 */
export function genererNumeroLot(input: {
  date: Date | string
  parcelleNom?: string | null
  espece?: string | null
  numeroSequence?: number
}): string {
  const date = typeof input.date === "string" ? new Date(input.date) : input.date
  const yyyy = date.getFullYear().toString()
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  const seq = String(input.numeroSequence ?? 1).padStart(2, "0")
  return `${yyyy}${mm}${dd}-${slugFragment(input.parcelleNom)}-${slugFragment(input.espece)}-${seq}`
}
