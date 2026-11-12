/**
 * Statut agronomique d'une ligne de « Cultures prévues par planche ».
 *
 * Bug cmp8sb0at (Marc 2026-05-16) — Le statut OK vert indiquait "ligne créée"
 * pas "plan agronomique valide". On évalue des conflits réels :
 *  - empty : aucune date semis/plantation/récolte (kiwi sans planning)
 *  - overlap : chevauchement temporel avec une autre culture de la même planche
 *  - todo : culture planifiée, pas encore créée
 *  - ok : sinon
 */
export type StatutAgro = "empty" | "overlap" | "ok" | "todo"

export interface CultureAStatuer {
  plancheId: string
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  existante: boolean
}

// Bug feedback testeur 2026-05-26 (cmpm6yi1d) — Avant, toute paire de
// cultures se touchant d'une seule semaine sur la même planche déclenchait
// "Chevauchement" (ex. fève S08-S20 + haricot vert S18-S30 : chevauchement
// de 2 semaines minime). 33/33 cultures étaient marquées → l'alerte
// perdait toute valeur. On exige désormais un chevauchement RÉEL > 2
// semaines pour signaler le conflit (tolérance pour les passations de
// culture en fin/début de saison).
const SEUIL_CHEVAUCHEMENT_SEM = 2

function periode(c: CultureAStatuer): [number, number] | null {
  const debut = c.semaineSemis ?? c.semainePlantation
  const fin = c.semaineRecolte
  if (debut == null || fin == null) return null
  return [debut, Math.max(debut, fin)]
}

/**
 * Statut de chaque culture, dans l'ordre reçu.
 *
 * Revue du 2026-11-11 :
 *  - calculé une fois par jeu de données, planche par planche. La cellule le
 *    recalculait à chaque rendu en comparant chaque ligne à toutes les autres ;
 *  - une culture SANS planche (`plancheId` vide) ne chevauche rien : toutes
 *    partageaient l'identifiant vide et passaient pour voisines d'une même
 *    planche, donc « Chevauchement » à tort.
 */
export function statutsAgro(cultures: readonly CultureAStatuer[]): StatutAgro[] {
  const parPlanche = new Map<string, { index: number; periode: [number, number] }[]>()
  cultures.forEach((c, index) => {
    const p = c.plancheId ? periode(c) : null
    if (!p) return
    const voisines = parPlanche.get(c.plancheId) ?? []
    voisines.push({ index, periode: p })
    parPlanche.set(c.plancheId, voisines)
  })

  const enConflit = new Set<number>()
  for (const voisines of parPlanche.values()) {
    for (let i = 0; i < voisines.length; i++) {
      for (let j = i + 1; j < voisines.length; j++) {
        const [a, b] = [voisines[i].periode, voisines[j].periode]
        // Largeur du chevauchement en semaines
        if (Math.min(a[1], b[1]) - Math.max(a[0], b[0]) >= SEUIL_CHEVAUCHEMENT_SEM) {
          enConflit.add(voisines[i].index)
          enConflit.add(voisines[j].index)
        }
      }
    }
  }

  return cultures.map((c, index) => {
    if (c.semaineSemis == null && c.semainePlantation == null && c.semaineRecolte == null) {
      return c.existante ? "empty" : "todo"
    }
    if (enConflit.has(index)) return "overlap"
    return c.existante ? "ok" : "todo"
  })
}
