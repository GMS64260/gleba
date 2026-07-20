/**
 * Types de la vue 3D. Volontairement dépourvus d'import three pour rester
 * importables partout (page cliente) sans tirer le moteur 3D dans le graphe.
 * Ils reprennent la forme des données déjà servies par /api/jardin,
 * /api/objets-jardin et /api/arbres.
 */

export interface Culture3D {
  id: number
  nbRangs: number | null
  espacement: number | null
  /** Fraction de croissance [0..1] à la date affichée (plan vivant). */
  croissance: number
  itp: { espacementRangs: number | null; espacement: number | null } | null
  espece: {
    nom: string | null
    couleur: string | null
    etalement: number | null
    famille: { id?: string | null; couleur: string | null } | null
  }
}

export interface Planche3D {
  id: string
  nom: string
  largeur: number | null
  longueur: number | null
  posX: number | null
  posY: number | null
  rotation2D: number | null
  type?: string | null
  cultures: Culture3D[]
}

export interface Objet3D {
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

export interface Arbre3D {
  id: number
  nom: string
  type: string
  posX: number
  posY: number
  /** Envergure (diamètre, m) à la date affichée. */
  envergure: number
  couleur: string | null
}

export interface Garden3DData {
  planches: Planche3D[]
  objets: Objet3D[]
  arbres: Arbre3D[]
}

/** Image et calibration métrique partagées avec le plan 2D. */
export interface Garden3DFond {
  image: string
  imageWidth: number
  imageHeight: number
  opacity: number
  scale: number
  offsetX: number
  offsetY: number
  rotation: number
}
