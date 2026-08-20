/**
 * Catalogue des objets du plan de jardin (`ObjetJardin.type`) et géométrie de
 * leur duplication.
 *
 * Le plan 2D n'offrait aucun élément bâti : ni mur, ni clôture, ni poteau, ni
 * bâtiment, ni haie. Or on ne pose pas des cultures sur un plan vide — on les
 * pose dans un lieu, avec ses limites et ses bâtiments. Faute de ces types,
 * l'outil « planche » était le seul à savoir dessiner une forme, la
 * redimensionner et la dupliquer : il servait donc à tracer du bâti, ce qui
 * polluait la liste des planches, la planification et les rotations.
 *
 * Trois manques à combler ensemble, sinon le détournement continue :
 *
 * 1. les types bâti eux-mêmes, avec un gabarit de départ crédible par type ;
 * 2. la duplication en série, seule façon de tirer un mur d'un geste — la
 *    planche l'avait, l'objet non ;
 * 3. un rendu et une cible de saisie utilisables sur un élément de 10 cm de
 *    large, largeur normale d'un mur sur un plan de ferme.
 *
 * Le type reste une chaîne libre en base : ajouter une entrée ici suffit, sans
 * migration. Ce module est la seule source de vérité — 2D, 3D et écran d'édition
 * l'importent, pour qu'un nouveau type ne puisse plus apparaître à moitié.
 */

/** Regroupement affiché dans le sélecteur de type. */
export type GroupeObjet = "circulation" | "bati" | "vegetal"

export interface TypeObjet {
  value: string
  label: string
  /** Couleur de remplissage 2D (SVG). */
  color: string
  /** Couleur 3D, assombrie pour l'éclairage de la scène. */
  color3D: string
  groupe: GroupeObjet
  /** Gabarit proposé à la création, en mètres. */
  gabarit: { largeur: number; longueur: number }
  /**
   * Élément linéaire : les copies s'enchaînent bout à bout le long de la
   * longueur au lieu d'être posées côte à côte. C'est ce qui permet de tirer un
   * mur ou une clôture d'un seul geste.
   */
  lineaire: boolean
  /** Hauteur bâtie en 3D (m). 0 = rendu au sol, géré par la scène. */
  hauteur3D: number
}

/**
 * Ordre d'affichage volontaire : les groupes évitent d'allonger un menu à plat
 * de douze entrées, contrainte posée en même temps que l'ajout du bâti.
 */
export const TYPES_OBJETS: TypeObjet[] = [
  // — Circulation
  {
    value: "allee",
    label: "Allée",
    color: "#d4a574",
    color3D: "#cbb994",
    groupe: "circulation",
    gabarit: { largeur: 0.5, longueur: 5 },
    lineaire: true,
    hauteur3D: 0,
  },
  {
    value: "passage",
    label: "Passage",
    color: "#a8a29e",
    color3D: "#b7b2aa",
    groupe: "circulation",
    gabarit: { largeur: 0.4, longueur: 5 },
    lineaire: true,
    hauteur3D: 0,
  },
  // — Bâti et clôtures
  {
    value: "mur",
    label: "Mur",
    color: "#9ca3af",
    color3D: "#a9adb2",
    groupe: "bati",
    gabarit: { largeur: 0.2, longueur: 5 },
    lineaire: true,
    hauteur3D: 1.8,
  },
  {
    value: "cloture",
    label: "Clôture",
    color: "#b08968",
    color3D: "#9c7a55",
    groupe: "bati",
    gabarit: { largeur: 0.1, longueur: 10 },
    lineaire: true,
    hauteur3D: 1.2,
  },
  {
    // Poteau, pilier, piquet d'angle : l'ossature d'un abri se dessine par ses
    // appuis, pas par un rectangle plein.
    value: "poteau",
    label: "Poteau",
    color: "#8d6e4a",
    color3D: "#7d6140",
    groupe: "bati",
    gabarit: { largeur: 0.2, longueur: 0.2 },
    lineaire: false,
    hauteur3D: 2,
  },
  {
    value: "batiment",
    label: "Bâtiment",
    color: "#57534e",
    color3D: "#6b6560",
    groupe: "bati",
    gabarit: { largeur: 4, longueur: 6 },
    lineaire: false,
    hauteur3D: 2.6,
  },
  {
    value: "serre",
    label: "Serre",
    color: "#93c5fd",
    color3D: "#bcdcff",
    groupe: "bati",
    gabarit: { largeur: 3, longueur: 8 },
    lineaire: false,
    hauteur3D: 0,
  },
  {
    value: "bordure",
    label: "Bordure",
    color: "#78716c",
    color3D: "#8a6a45",
    groupe: "bati",
    gabarit: { largeur: 0.15, longueur: 3 },
    lineaire: true,
    hauteur3D: 0,
  },
  // — Végétal, eau et divers
  {
    value: "haie",
    label: "Haie",
    color: "#65a30d",
    color3D: "#5f8c1f",
    groupe: "vegetal",
    gabarit: { largeur: 0.6, longueur: 8 },
    lineaire: true,
    hauteur3D: 1.5,
  },
  {
    value: "compost",
    label: "Compost",
    color: "#854d0e",
    color3D: "#5a3d1e",
    groupe: "vegetal",
    gabarit: { largeur: 1, longueur: 1.5 },
    lineaire: false,
    hauteur3D: 0,
  },
  {
    value: "eau",
    label: "Point d'eau",
    color: "#60a5fa",
    color3D: "#4a90d9",
    groupe: "vegetal",
    gabarit: { largeur: 0.8, longueur: 1.2 },
    lineaire: false,
    hauteur3D: 0,
  },
  {
    value: "autre",
    label: "Autre",
    color: "#d1d5db",
    color3D: "#c9c9c9",
    groupe: "vegetal",
    gabarit: { largeur: 1, longueur: 1 },
    lineaire: false,
    hauteur3D: 0,
  },
]

export const LABELS_GROUPES: Record<GroupeObjet, string> = {
  circulation: "Circulation",
  bati: "Bâti et clôtures",
  vegetal: "Végétal, eau et divers",
}

/** Types par groupe, dans l'ordre du catalogue — pour un sélecteur sectionné. */
export const TYPES_OBJETS_PAR_GROUPE: { groupe: GroupeObjet; label: string; types: TypeObjet[] }[] =
  (["circulation", "bati", "vegetal"] as GroupeObjet[]).map(groupe => ({
    groupe,
    label: LABELS_GROUPES[groupe],
    types: TYPES_OBJETS.filter(t => t.groupe === groupe),
  }))

/** Repli sur « autre » : un type inconnu (import, ancienne saisie) reste affichable. */
export const TYPE_OBJET_PAR_DEFAUT: TypeObjet = TYPES_OBJETS[TYPES_OBJETS.length - 1]

export function typeObjet(value: string | null | undefined): TypeObjet {
  return TYPES_OBJETS.find(t => t.value === value) ?? TYPE_OBJET_PAR_DEFAUT
}

export function labelTypeObjet(value: string | null | undefined): string {
  return typeObjet(value).label
}

/** Gabarit à proposer quand on choisit un type à la création. */
export function gabaritObjet(value: string | null | undefined): { largeur: number; longueur: number } {
  return { ...typeObjet(value).gabarit }
}

/** Couleurs 2D par type, dérivées du catalogue (SVG et panneau d'édition). */
export const OBJET_COLORS: Record<string, string> = Object.fromEntries(
  TYPES_OBJETS.map(t => [t.value, t.color])
)

/** Couleurs 3D par type, dérivées du catalogue. */
export const OBJET_COLORS_3D: Record<string, string> = Object.fromEntries(
  TYPES_OBJETS.map(t => [t.value, t.color3D])
)

/** Couleur effective d'un objet : la personnalisée si elle existe, sinon celle du type. */
export function couleurObjet(type: string, couleur: string | null | undefined): string {
  return couleur || OBJET_COLORS[type] || TYPE_OBJET_PAR_DEFAUT.color
}

/** Types proposés pour reclasser une planche qui n'en est pas une. */
export const TYPES_CONVERSION_PLANCHE = [
  "mur",
  "cloture",
  "poteau",
  "haie",
  "batiment",
  "autre",
] as const

/** Pose d'un objet sur le plan : ce dont la duplication a besoin. */
export interface PoseObjet {
  posX: number
  posY: number
  largeur: number
  longueur: number
  rotation2D: number
}

/** Écart laissé entre deux copies posées côte à côte (m). */
export const ECART_COPIES_M = 0.4

const arrondi = (v: number) => Math.round(v * 100) / 100

/**
 * Position de la copie de rang `rang` (1 = première copie) d'un objet.
 *
 * La direction suit l'orientation propre de l'objet, pas les axes du plan :
 * une copie de mur tourné à 90° continue le mur, elle ne part pas en biais.
 * Repères, avec θ la rotation en degrés (SVG, sens horaire, y vers le bas) :
 * l'axe local de la longueur pointe vers `(-sin θ, cos θ)`, celui de la largeur
 * vers `(cos θ, sin θ)`.
 *
 * - élément linéaire : copies bout à bout le long de la longueur, sans jeu, pour
 *   obtenir un mur ou une clôture continus ;
 * - autre : copies côte à côte le long de la largeur, séparées de
 *   {@link ECART_COPIES_M}, comme les planches.
 */
export function poseCopieObjet(
  source: PoseObjet,
  rang: number,
  lineaire: boolean
): { posX: number; posY: number } {
  const theta = ((source.rotation2D || 0) * Math.PI) / 180
  const pas = lineaire ? source.longueur : source.largeur + ECART_COPIES_M
  const dirX = lineaire ? -Math.sin(theta) : Math.cos(theta)
  const dirY = lineaire ? Math.cos(theta) : Math.sin(theta)

  return {
    posX: arrondi(source.posX + dirX * pas * rang),
    posY: arrondi(source.posY + dirY * pas * rang),
  }
}
