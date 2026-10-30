// Référentiels partagés entre la fiche arbre (/verger/[id]), l'onglet Arbres
// du verger et le panneau arbre du plan 2D du jardin.

export const CONDUITES_ARBRE = ["Gobelet", "Axe central", "Palmette", "Espalier", "Libre"] as const

export const AVERTISSEMENT_SUPPRESSION_ARBRE =
  "Un arbre portant des récoltes, des opérations réalisées ou abandonnées, des écritures comptables ou un achat réglé par des versements doit être conservé : archivez-le. " +
  "Si la suppression est autorisée, sa dépense d’achat sans versement, les opérations encore planifiées sans coût et les observations sans traitement seront supprimées. " +
  "Les traitements phytosanitaires et les lots de bois sont conservés. L’archivage est accessible depuis la liste des arbres."

/**
 * Confirmation de suppression d'un arbre précis. Revue du 2026-10-29 : la
 * suppression emporte désormais la dépense d'achat sans versement ; on le dit
 * en tête quand l'arbre porte un prix d'achat.
 */
export function avertissementSuppressionArbre(arbre?: { prixAchat?: number | null } | null) {
  return (arbre?.prixAchat ?? 0) > 0
    ? `Sa dépense d’achat sera supprimée aussi. ${AVERTISSEMENT_SUPPRESSION_ARBRE}`
    : AVERTISSEMENT_SUPPRESSION_ARBRE
}

export const ETATS_ARBRE = [
  { value: "excellent", label: "Excellent" },
  { value: "bon", label: "Bon" },
  { value: "moyen", label: "Moyen" },
  { value: "mauvais", label: "Mauvais" },
  { value: "mort", label: "Mort" },
] as const
