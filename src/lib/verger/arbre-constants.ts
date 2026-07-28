// Référentiels partagés entre la fiche arbre (/verger/[id]), l'onglet Arbres
// du verger et le panneau arbre du plan 2D du jardin.

export const CONDUITES_ARBRE = ["Gobelet", "Axe central", "Palmette", "Espalier", "Libre"] as const

export const ETATS_ARBRE = [
  { value: "excellent", label: "Excellent" },
  { value: "bon", label: "Bon" },
  { value: "moyen", label: "Moyen" },
  { value: "mauvais", label: "Mauvais" },
  { value: "mort", label: "Mort" },
] as const
