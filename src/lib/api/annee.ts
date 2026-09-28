/**
 * Lecture du paramètre `annee` d'une route de liste.
 *
 * Motif « fenêtre calée sur aujourd'hui » (registre des motifs, 2026-09-28) :
 * une liste qui ne connaît que l'année civile courante rend invisible — donc
 * non modifiable — tout ce qu'un utilisateur ressaisit pour les années
 * passées. Une route de liste accepte donc :
 *   - `annee=<AAAA>` : l'exercice demandé ;
 *   - `annee=all`    : toutes les années (liste de gestion d'un historique) ;
 *   - rien           : l'année civile courante, comme avant.
 */
export interface AnneeDemandee {
  annee: number
  toutesAnnees: boolean
  /** Bornes de l'exercice, ou `null` quand toutes les années sont demandées. */
  bornes: { gte: Date; lte: Date } | null
}

export function lireAnnee(searchParams: URLSearchParams, parametre = 'annee'): AnneeDemandee {
  const brut = searchParams.get(parametre)
  const toutesAnnees = brut === 'all'
  const lu = brut && !toutesAnnees ? parseInt(brut, 10) : NaN
  const annee = Number.isInteger(lu) && lu >= 2000 && lu <= 2200 ? lu : new Date().getFullYear()
  const bornes = toutesAnnees ? null : { gte: new Date(annee, 0, 1), lte: new Date(annee, 11, 31, 23, 59, 59) }
  return { annee, toutesAnnees, bornes }
}
