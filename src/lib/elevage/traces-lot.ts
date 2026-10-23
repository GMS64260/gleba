/**
 * Traces du registre d'élevage qu'un lot porte encore, et qui interdisent de
 * le supprimer (2026-10-23, même règle que `compterTracesAnimal`) : un lot réel
 * qui s'arrête se clôture, la suppression sert à effacer un lot créé par
 * erreur. Voir `DELETE /api/elevage/lots`.
 */

/** Motif du mouvement que la création d'un lot sur une parcelle écrit seule. */
export const MOTIF_MISE_EN_PLACE_LOT = 'Mise en place du lot'

export interface TracesRegistreLot {
  soins: number
  naissances: number
  consommations: number
  statutsSanitairesStructures: number
  /** Mouvements de cheptel, hors mise en place automatique. */
  mouvements: number
}

const pluriel = (n: number, singulier: string, plurielForme: string) => `${n} ${n > 1 ? plurielForme : singulier}`

/**
 * « 3 soins, 1 mouvement de cheptel », ou null si le lot n'en porte aucune.
 * Nomme chaque famille présente pour que l'éleveur sache où regarder.
 */
export function messageTracesRegistreLot(t: TracesRegistreLot): string | null {
  const parties = [
    t.soins > 0 ? pluriel(t.soins, 'soin', 'soins') : null,
    t.naissances > 0 ? pluriel(t.naissances, 'naissance', 'naissances') : null,
    t.consommations > 0 ? pluriel(t.consommations, "consommation d'aliment", "consommations d'aliment") : null,
    t.mouvements > 0 ? pluriel(t.mouvements, 'mouvement de cheptel', 'mouvements de cheptel') : null,
    t.statutsSanitairesStructures > 0
      ? pluriel(t.statutsSanitairesStructures, 'statut sanitaire', 'statuts sanitaires')
      : null,
  ].filter((p): p is string => p !== null)
  if (parties.length === 0) return null
  if (parties.length === 1) return parties[0]
  return `${parties.slice(0, -1).join(', ')} et ${parties[parties.length - 1]}`
}
