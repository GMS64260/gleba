/**
 * Budgets d'ingestion, comptés en TRAMES par connecteur et en MESURES par
 * compte, pas en requêtes : une requête peut porter 20 trames de 18 grandeurs.
 * Relecture du 2026-10-23 : avec un plafond par requête seul, un compte
 * gratuit pouvait écrire des millions de lignes par quart d'heure sur un
 * disque partagé déjà rempli à 81 %.
 *
 * En mémoire, comme `rate-limit.ts` : l'application tourne dans un seul
 * conteneur. Une bascule remet les compteurs à zéro, sans conséquence.
 */

interface Fenetre {
  utilise: number
  finA: number
}

const fenetres = new Map<string, Fenetre>()
const NETTOYAGE_AU_DELA = 5000

export interface Demande {
  cle: string
  quantite: number
  max: number
}

/**
 * Accorde TOUTES les demandes ou aucune : un refus ne consomme rien, pour
 * qu'un envoi refusé au niveau du compte n'entame pas le budget du connecteur.
 */
export function consommerBudgets(
  demandes: Demande[],
  fenetreMs: number,
  maintenant: number = Date.now(),
): { ok: true } | { ok: false; reessayerDansS: number } {
  if (fenetres.size > NETTOYAGE_AU_DELA) {
    for (const [cle, f] of fenetres) if (maintenant >= f.finA) fenetres.delete(cle)
  }
  const courantes = demandes.map((d) => {
    let f = fenetres.get(d.cle)
    if (!f || maintenant >= f.finA) f = { utilise: 0, finA: maintenant + fenetreMs }
    return { d, f }
  })
  const depassee = courantes.find(({ d, f }) => f.utilise + d.quantite > d.max)
  if (depassee) return { ok: false, reessayerDansS: Math.max(1, Math.ceil((depassee.f.finA - maintenant) / 1000)) }
  for (const { d, f } of courantes) {
    f.utilise += d.quantite
    fenetres.set(d.cle, f)
  }
  return { ok: true }
}

/**
 * Lecture seule : secondes avant la fin de la fenêtre si la clé a atteint son
 * plafond, sinon null. Permet de refuser avant un travail coûteux sans rien consommer.
 */
export function budgetEpuise(cle: string, max: number, maintenant: number = Date.now()): number | null {
  const f = fenetres.get(cle)
  if (!f || maintenant >= f.finA || f.utilise < max) return null
  return Math.max(1, Math.ceil((f.finA - maintenant) / 1000))
}

/** Tests seulement. */
export function viderBudgets() {
  fenetres.clear()
}
