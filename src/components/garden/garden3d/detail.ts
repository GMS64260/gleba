import type { Culture3D, Planche3D } from "./types"

/** Résout le choix explicite d'une culture sans conserver un id d'une autre planche. */
export function cultureSelectionnee(planche: Planche3D, cultureId: number | null): Culture3D | undefined {
  return planche.cultures.find((culture) => culture.id === cultureId) ?? planche.cultures[0]
}
