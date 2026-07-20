/**
 * Types et constantes partagés du module Garden (PROMPT 25 LOT B).
 *
 * Extraction des types depuis GardenView.tsx pour préparer le découpage
 * en sous-composants (GardenCanvas, GardenLayer, GardenElement).
 */

export interface SelectionItem {
  type: "planche" | "objet" | "arbre"
  id: string | number
}

export interface PlancheWithCulture {
  id: string
  nom: string
  largeur: number | null
  longueur: number | null
  posX: number | null
  posY: number | null
  rotation2D: number | null
  ilot: string | null
  type?: string | null
  cultures: {
    id: number
    nbRangs: number | null
    espacement: number | null
    croissance?: number | null
    itp: { espacementRangs: number | null; espacement: number | null } | null
    espece: {
      id: string
      couleur: string | null
      etalement: number | null
      famille: { id?: string; couleur: string | null } | null
    }
  }[]
}

export interface ObjetJardin {
  id: number
  nom: string | null
  type: string
  largeur: number
  longueur: number
  posX: number
  posY: number
  rotation2D: number
  couleur: string | null
}

export interface Arbre {
  id: number
  nom: string
  type: string
  espece: string | null
  variete: string | null
  posX: number
  posY: number
  envergure: number
  envergureAdulte?: number | null
  especeEtalement?: number | null
  couleur: string | null
}

export interface BackgroundImageSettings {
  image: string | null
  opacity: number
  scale: number
  offsetX: number
  offsetY: number
  rotation: number
  contour?: number[][][] | null
}

export const OBJET_COLORS: Record<string, string> = {
  allee: "#d4a574",
  passage: "#a8a29e",
  bordure: "#78716c",
  serre: "#93c5fd",
  compost: "#854d0e",
  eau: "#60a5fa",
  autre: "#d1d5db",
}

export const ARBRE_COLORS: Record<string, string> = {
  fruitier: "#22c55e",
  petit_fruit: "#ef4444",
  ornement: "#a855f7",
  haie: "#84cc16",
}

/** Retourne la couleur d'un objet/arbre selon son type. */
export function colorForObjet(type: string, couleur: string | null): string {
  return couleur || OBJET_COLORS[type] || OBJET_COLORS.autre
}
export function colorForArbre(type: string, couleur: string | null): string {
  return couleur || ARBRE_COLORS[type] || ARBRE_COLORS.fruitier
}
