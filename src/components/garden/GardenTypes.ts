/**
 * Types et constantes partagés du module Garden (PROMPT 25 LOT B).
 *
 * Extraction des types depuis GardenView.tsx pour préparer le découpage
 * en sous-composants (GardenCanvas, GardenLayer, GardenElement).
 */

import { OBJET_COLORS, couleurObjet } from "@/lib/jardin/objets-plan"
import { COULEURS_TYPES_ARBRE } from "@/lib/verger/types-arbre"

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

// Réexport, et non copie : le catalogue des types d'objets du plan vit dans
// @/lib/jardin/objets-plan. Une table locale avait déjà divergé une fois — elle
// ignorait mur, clôture, poteau, bâtiment et haie.
export { OBJET_COLORS }

// Couleurs par type d'arbre : liste unique src/lib/verger/types-arbre.ts.
export const ARBRE_COLORS: Record<string, string> = COULEURS_TYPES_ARBRE

/** Retourne la couleur d'un objet/arbre selon son type. */
export function colorForObjet(type: string, couleur: string | null): string {
  return couleurObjet(type, couleur)
}
export function colorForArbre(type: string, couleur: string | null): string {
  return couleur || ARBRE_COLORS[type] || ARBRE_COLORS.fruitier
}
