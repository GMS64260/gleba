/**
 * Mention de date limite d'une étiquette de fromage, PURE.
 * DLC (« à consommer jusqu'au ») pour un lot frais, sinon DLUO/DDM
 * (« à consommer de préférence avant le »). `null` si le lot n'en porte aucune.
 */
export function mentionDateLimite(lot: { dlc?: Date | null; dluo?: Date | null }): { libelle: string; date: Date } | null {
  if (lot.dlc) return { libelle: "À consommer jusqu'au", date: lot.dlc }
  if (lot.dluo) return { libelle: 'À consommer de préférence avant le', date: lot.dluo }
  return null
}
