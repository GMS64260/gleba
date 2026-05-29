/**
 * Libellés français accentués pour les énumérations élevage.
 *
 * Bug feedback testeur 2026-05-26 (cmpmr5uuy) — les valeurs d'enum
 * étaient affichées brutes (« termine », « paye », « unite »...) sans
 * accents, ce qui faisait peu professionnel pour un outil français.
 * Les valeurs stockées en base restent inchangées (non accentuées,
 * stables pour les filtres/API) ; on ne mappe que l'affichage.
 */

const STATUT_ANIMAL: Record<string, string> = {
  actif: "Actif",
  vendu: "Vendu",
  abattu: "Abattu",
  mort: "Mort",
  reforme: "Réformé",
  termine: "Terminé",
}

const STATUT_LOT: Record<string, string> = {
  actif: "Actif",
  termine: "Terminé",
  reforme: "Réformé",
}

const UNITE: Record<string, string> = {
  unite: "unité",
  douzaine: "douzaine",
  kg: "kg",
  L: "L",
  litre: "litre",
  piece: "pièce",
}

export function labelStatutAnimal(statut: string | null | undefined): string {
  if (!statut) return "—"
  return STATUT_ANIMAL[statut] ?? statut
}

export function labelStatutLot(statut: string | null | undefined): string {
  if (!statut) return "—"
  return STATUT_LOT[statut] ?? statut
}

export function labelUnite(unite: string | null | undefined): string {
  if (!unite) return ""
  return UNITE[unite] ?? unite
}
