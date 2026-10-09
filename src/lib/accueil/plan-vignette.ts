/**
 * Géométrie de la vignette du plan (tuile de l'accueil v2) : cadre englobant
 * des planches, arbres et objets en mètres, pour le `viewBox` du SVG. Même
 * convention que le plan 2D (`GardenView`) : une planche est un rectangle
 * `largeur × longueur` posé en (posX, posY), tourné de `rotation2D` degrés
 * autour de son centre. Fonctions PURES.
 */

import type { ElementAujourdhui, PlanVignetteDonnees } from "./types"

export interface CadreVignette {
  x: number
  y: number
  largeur: number
  hauteur: number
}

/** Marge autour des formes, en mètres : laisse la place aux pastilles et au nom de la ferme. */
export const MARGE_CADRE_M = 3

/** Cadre par défaut quand rien n'est placé (évite un viewBox nul). */
const CADRE_VIDE: CadreVignette = { x: 0, y: 0, largeur: 20, hauteur: 12 }

/** Rayon englobant d'un rectangle tourné : la demi-diagonale couvre toute rotation. */
function demiDiagonale(largeur: number, longueur: number): number {
  return Math.hypot(largeur, longueur) / 2
}

/**
 * Au-delà de ce facteur (en taille du cadre des planches), un arbre ou un
 * objet isolé est laissé hors cadre : sans cela, une haie ou un bâtiment à
 * 80 m réduisent les planches à des traits (vu sur la ferme de démonstration).
 */
export const TOLERANCE_HORS_PLANCHES = 0.6

interface Boite {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function boiteVide(): Boite {
  return { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY }
}

function etendre(b: Boite, cx: number, cy: number, r: number): void {
  b.minX = Math.min(b.minX, cx - r)
  b.minY = Math.min(b.minY, cy - r)
  b.maxX = Math.max(b.maxX, cx + r)
  b.maxY = Math.max(b.maxY, cy + r)
}

function finie(b: Boite): boolean {
  return [b.minX, b.minY, b.maxX, b.maxY].every(Number.isFinite)
}

/** Centre d'une forme (planche ou objet). */
function centre(f: { posX: number; posY: number; largeur: number; longueur: number }): { cx: number; cy: number } {
  return { cx: f.posX + f.largeur / 2, cy: f.posY + f.longueur / 2 }
}

/** Étend la boîte à une forme : rectangle exact si elle n'est pas tournée, sinon son cercle englobant. */
function etendreForme(b: Boite, f: { posX: number; posY: number; largeur: number; longueur: number; rotation2D: number }): void {
  if (f.rotation2D % 180 === 0) {
    b.minX = Math.min(b.minX, f.posX)
    b.minY = Math.min(b.minY, f.posY)
    b.maxX = Math.max(b.maxX, f.posX + f.largeur)
    b.maxY = Math.max(b.maxY, f.posY + f.longueur)
  } else {
    const { cx, cy } = centre(f)
    etendre(b, cx, cy, demiDiagonale(f.largeur, f.longueur))
  }
}

export function calculerCadre(plan: PlanVignetteDonnees, margeM = MARGE_CADRE_M): CadreVignette {
  // 1. Les planches d'abord : c'est elles que la vignette doit montrer.
  const planches = boiteVide()
  for (const p of plan.planches) etendreForme(planches, p)

  // 2. Arbres et objets : seulement s'ils restent à portée des planches
  //    (ou tout, quand il n'y a aucune planche).
  const cadre = finie(planches) ? { ...planches } : boiteVide()
  const tolerance = finie(planches)
    ? Math.max(planches.maxX - planches.minX, planches.maxY - planches.minY, 10) * TOLERANCE_HORS_PLANCHES
    : Number.POSITIVE_INFINITY
  const aPortee = (cx: number, cy: number) =>
    !finie(planches) ||
    (cx >= planches.minX - tolerance && cx <= planches.maxX + tolerance && cy >= planches.minY - tolerance && cy <= planches.maxY + tolerance)
  for (const o of plan.objets) {
    const { cx, cy } = centre(o)
    if (aPortee(cx, cy)) etendreForme(cadre, o)
  }
  for (const a of plan.arbres) {
    if (aPortee(a.posX, a.posY)) etendre(cadre, a.posX, a.posY, Math.max(a.envergure, 0.5) / 2)
  }

  if (!finie(cadre)) return CADRE_VIDE

  const largeur = Math.max(cadre.maxX - cadre.minX, 1) + 2 * margeM
  const hauteur = Math.max(cadre.maxY - cadre.minY, 1) + 2 * margeM
  return { x: cadre.minX - margeM, y: cadre.minY - margeM, largeur, hauteur }
}

/** Résumé des états pour les pastilles de la vignette (« 3 à arroser », « 2 à récolter »). */
export function compterEtats(plan: PlanVignetteDonnees): { arroser: number; recolter: number; enPlace: number; libre: number } {
  const compte = { arroser: 0, recolter: 0, enPlace: 0, libre: 0 }
  for (const p of plan.planches) {
    if (p.etat === "arroser") compte.arroser += 1
    else if (p.etat === "recolter") compte.recolter += 1
    else if (p.etat === "en-place") compte.enPlace += 1
    else compte.libre += 1
  }
  return compte
}

/**
 * Repeint l'état du jour à partir des lignes encore ouvertes : une planche
 * « à arroser » ou « à récolter » dont plus aucune ligne ne parle passe « en
 * place » (mouvement 4 : après un arrosage noté, le liseré argile se fond).
 * Le plan reçu du serveur n'est jamais modifié.
 */
export function appliquerElementsAuPlan(
  plan: PlanVignetteDonnees,
  elements: readonly Pick<ElementAujourdhui, "plancheIds">[],
): PlanVignetteDonnees {
  const encoreCitees = new Set(elements.flatMap((e) => e.plancheIds))
  return {
    ...plan,
    planches: plan.planches.map((p) =>
      (p.etat === "arroser" || p.etat === "recolter") && !encoreCitees.has(p.id) ? { ...p, etat: "en-place" } : p,
    ),
  }
}
