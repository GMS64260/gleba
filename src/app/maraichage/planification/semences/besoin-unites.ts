/**
 * Besoin de semences exprimé en UNITÉS dans les onglets « Graines » et
 * « Plants à produire ».
 *
 * Deux conduites ne se comptent pas en grammes (cf. `calculerBesoin`) :
 *  - semis direct dosé en plants/m² : des plants à acheter ;
 *  - plant repiqué en graines/godet sans graines/gramme connu : des graines.
 * Le calcul rend alors 0 g et un nombre d'unités. Ces onglets n'affichaient que
 * les grammes : « 0 g » nécessaire, « — » à commander, statut « Manquant ».
 */
export interface BesoinEnUnites {
  quantite: number
  aCommander: number
  /** Libellé accordé de l'unité comptée (« graines », « plants »). */
  unite: (nombre: number) => string
}

const accord = (singulier: string) => (nombre: number) => (Math.abs(nombre) < 2 ? singulier : `${singulier}s`)

export function besoinEnUnites(b: {
  mode: string
  grainesNecessaires: number
  besoinCaieux: number
  caieuxACommander: number
}): BesoinEnUnites | null {
  if (b.grainesNecessaires > 0 || b.besoinCaieux <= 0) return null
  if (b.mode !== "graine_directe" && b.mode !== "plant_repique") return null
  return {
    quantite: b.besoinCaieux,
    aCommander: b.caieuxACommander,
    unite: accord(b.mode === "plant_repique" ? "graine" : "plant"),
  }
}

/** « 132 graines », « 1 plant » : texte d'une quantité comptée en unités. */
export function formatUnites(nombre: number, besoin: BesoinEnUnites): string {
  return `${nombre.toLocaleString("fr-FR")} ${besoin.unite(nombre)}`
}
