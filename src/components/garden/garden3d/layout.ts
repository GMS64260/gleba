import type { Garden3DData, Garden3DFond } from "./types"

export type FondCorner = readonly [x: number, z: number]

/** Coins du fond dans le repère métrique commun aux vues 2D et 3D. */
export function computeFondCorners(fond: Garden3DFond): FondCorner[] {
  const width = fond.imageWidth * fond.scale
  const height = fond.imageHeight * fond.scale
  const cx = fond.offsetX + width / 2
  const cz = fond.offsetY + height / 2
  const theta = fond.rotation * Math.PI / 180
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)

  return [
    [-width / 2, -height / 2],
    [width / 2, -height / 2],
    [width / 2, height / 2],
    [-width / 2, height / 2],
  ].map(([dx, dz]) => [cx + dx * cos - dz * sin, cz + dx * sin + dz * cos] as const)
}

export function computeLayout(data: Garden3DData, fond?: Garden3DFond | null) {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity
  const acc = (x: number, z: number) => { minX = Math.min(minX, x); minZ = Math.min(minZ, z); maxX = Math.max(maxX, x); maxZ = Math.max(maxZ, z) }
  data.planches.forEach(p => { const x = p.posX ?? 0, z = p.posY ?? 0; acc(x, z); acc(x + (p.largeur ?? 1), z + (p.longueur ?? 1)) })
  data.objets.forEach(o => { acc(o.posX, o.posY); acc(o.posX + o.largeur, o.posY + o.longueur) })
  data.arbres.forEach(a => { const r = Math.max(0.5, a.envergure / 2); acc(a.posX - r, a.posY - r); acc(a.posX + r, a.posY + r) })
  if (fond) {
    for (const [x, z] of computeFondCorners(fond)) acc(x, z)
  }
  if (!Number.isFinite(minX)) { minX = 0; minZ = 0; maxX = 10; maxZ = 8 }
  return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, size: Math.max(6, maxX - minX, maxZ - minZ) }
}
