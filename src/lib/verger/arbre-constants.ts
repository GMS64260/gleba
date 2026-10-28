// Référentiels partagés entre la fiche arbre (/verger/[id]), l'onglet Arbres
// du verger et le panneau arbre du plan 2D du jardin.

export const CONDUITES_ARBRE = ["Gobelet", "Axe central", "Palmette", "Espalier", "Libre"] as const

export const AVERTISSEMENT_SUPPRESSION_ARBRE =
  "Un arbre portant des récoltes, des opérations réalisées ou abandonnées, ou des écritures comptables doit être conservé. " +
  "Si la suppression est autorisée, les opérations encore planifiées sans coût et les observations sans traitement seront supprimées. " +
  "Les traitements phytosanitaires et les lots de bois sont conservés. L’archivage est accessible depuis la liste des arbres."

export const ETATS_ARBRE = [
  { value: "excellent", label: "Excellent" },
  { value: "bon", label: "Bon" },
  { value: "moyen", label: "Moyen" },
  { value: "mauvais", label: "Mauvais" },
  { value: "mort", label: "Mort" },
] as const
