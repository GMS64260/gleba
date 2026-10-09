/**
 * Géométrie de la vignette du plan (tuile de l'accueil v2) : cadre englobant
 * des planches, arbres et objets en mètres, pour le `viewBox` du SVG. Même
 * convention que le plan 2D (`GardenView`) : une planche est un rectangle
 * `largeur × longueur` posé en (posX, posY), tourné de `rotation2D` degrés
 * autour de son centre. Fonctions PURES.
 */

import type { PlanVignetteDonnees } from "./types"

export interface CadreVignette {
  x: number
  y: number
  largeur: number
  hauteur: number
}

/** Marge autour des formes, en mètres. */
export const MARGE_CADRE_M = 1.5

/** Cadre par défaut quand rien n'est placé (évite un viewBox nul). */
const CADRE_VIDE: CadreVignette = { x: 0, y: 0, largeur: 20, hauteur: 12 }

/** Rayon englobant d'un rectangle tourné : la demi-diagonale couvre toute rotation. */
function demiDiagonale(largeur: number, longueur: number): number {
  return Math.hypot(largeur, longueur) / 2
}

export function calculerCadre(plan: PlanVignetteDonnees, margeM = MARGE_CADRE_M): CadreVignette {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  const etendre = (cx: number, cy: number, r: number) => {
    minX = Math.min(minX, cx - r)
    minY = Math.min(minY, cy - r)
    maxX = Math.max(maxX, cx + r)
    maxY = Math.max(maxY, cy + r)
  }

  for (const p of plan.planches) {
    const r = p.rotation2D % 180 === 0 ? 0 : demiDiagonale(p.largeur, p.longueur)
    if (r === 0) {
      minX = Math.min(minX, p.posX)
      minY = Math.min(minY, p.posY)
      maxX = Math.max(maxX, p.posX + p.largeur)
      maxY = Math.max(maxY, p.posY + p.longueur)
    } else {
      etendre(p.posX + p.largeur / 2, p.posY + p.longueur / 2, r)
    }
  }
  for (const o of plan.objets) {
    etendre(o.posX + o.largeur / 2, o.posY + o.longueur / 2, demiDiagonale(o.largeur, o.longueur))
  }
  for (const a of plan.arbres) {
    etendre(a.posX, a.posY, Math.max(a.envergure, 0.5) / 2)
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return CADRE_VIDE
  }

  const largeur = Math.max(maxX - minX, 1) + 2 * margeM
  const hauteur = Math.max(maxY - minY, 1) + 2 * margeM
  return { x: minX - margeM, y: minY - margeM, largeur, hauteur }
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
