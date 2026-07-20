/**
 * Maths de l'image de fond du plan 2D : calibration « 2 points » et mesure.
 *
 * Convention de rendu (GardenView) : le groupe SVG de l'image porte
 * `translate(offsetX, offsetY) rotate(rotation, W·s/2, H·s/2)` et l'image
 * fait W·s × H·s mètres (s = mètres par pixel). Un pixel image P se projette
 * donc dans le monde en :
 *
 *   monde(P) = offset + c + Rot(θ, P·s − c)   avec c = (W·s/2, H·s/2)
 */

export interface Point {
  x: number
  y: number
}

export interface FondReglages {
  scale: number // mètres par pixel image
  offsetX: number // mètres
  offsetY: number // mètres
  rotation: number // degrés
}

const rad = (deg: number) => (deg * Math.PI) / 180

function rot(p: Point, theta: number): Point {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** "82 cm" sous le mètre, sinon "4,25 m" (virgule française, zéros inutiles retirés). */
export function formatDistance(m: number): string {
  if (!Number.isFinite(m) || m < 0) return "–"
  if (m < 1) return `${Math.round(m * 100)} cm`
  return `${(Math.round(m * 100) / 100).toString().replace(".", ",")} m`
}

/** Projette un pixel image dans le monde (mètres) selon les réglages du fond. */
export function fondVersMonde(
  pImg: Point,
  fond: FondReglages,
  imageWidth: number,
  imageHeight: number
): Point {
  const s = fond.scale
  const theta = rad(fond.rotation)
  const c = { x: (imageWidth * s) / 2, y: (imageHeight * s) / 2 }
  const r = rot({ x: pImg.x * s - c.x, y: pImg.y * s - c.y }, theta)
  return { x: fond.offsetX + c.x + r.x, y: fond.offsetY + c.y + r.y }
}

/**
 * Calibration 2 points : l'utilisateur clique deux repères sur le plan et
 * saisit la distance réelle qui les sépare. Retourne les nouveaux réglages
 * (échelle + décalage) tels que :
 *  - la distance entre les deux repères devient `distanceReelle` ;
 *  - le PREMIER point cliqué reste exactement au même endroit du plan
 *    (l'image « grandit/rétrécit » autour de lui), rotation inchangée.
 * Retourne null si les points sont confondus ou la distance invalide.
 */
export function calibrerFond(params: {
  p1: Point
  p2: Point
  distanceReelle: number
  fond: FondReglages
  imageWidth: number
  imageHeight: number
}): { scale: number; offsetX: number; offsetY: number } | null {
  const { p1, p2, distanceReelle, fond, imageWidth, imageHeight } = params
  const dPlan = distance(p1, p2)
  if (!(dPlan > 1e-4) || !(distanceReelle > 0) || !(fond.scale > 0)) return null

  const s = fond.scale
  const theta = rad(fond.rotation)
  const c = { x: (imageWidth * s) / 2, y: (imageHeight * s) / 2 }

  // Pixel image sous p1 : inversion de monde(P) = offset + c + Rot(θ, P·s − c)
  const rel = rot({ x: p1.x - fond.offsetX - c.x, y: p1.y - fond.offsetY - c.y }, -theta)
  const pImg = { x: (c.x + rel.x) / s, y: (c.y + rel.y) / s }

  const s2 = s * (distanceReelle / dPlan)
  const c2 = { x: (imageWidth * s2) / 2, y: (imageHeight * s2) / 2 }
  // Ancrage : offset' tel que monde'(pImg) = p1
  const rel2 = rot({ x: pImg.x * s2 - c2.x, y: pImg.y * s2 - c2.y }, theta)
  return {
    scale: s2,
    offsetX: p1.x - c2.x - rel2.x,
    offsetY: p1.y - c2.y - rel2.y,
  }
}
