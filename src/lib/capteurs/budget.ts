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

/**
 * Rend des unités prises d'avance (travail finalement non compté). Sans effet
 * si la fenêtre est close : la suivante repart de zéro.
 */
export function rendreBudget(cle: string, quantite: number, maintenant: number = Date.now()) {
  const f = fenetres.get(cle)
  if (f && maintenant < f.finA) f.utilise = Math.max(0, f.utilise - quantite)
}

/** Instant du dernier passage accordé par `consommerOuEspacer`, par clé. */
const derniersPassages = new Map<string, number>()

/**
 * Plafond à débit limité plutôt que blocage dur. Sous `max`, prend une unité
 * D'AVANCE (des requêtes simultanées ne dépassent pas le plafond) ; au
 * plafond, accorde encore un passage si le précédent date d'au moins
 * `intervalleMs`, sans rien consommer. Chaque passage accordé est daté, ceux
 * d'avant le plafond compris : le premier passage au plafond attend donc
 * `intervalleMs` après le dernier. Le délai annoncé est celui du prochain
 * passage possible, ou la fin de la fenêtre si elle vient avant.
 *
 * `unite` dit si une unité a été prise : la rendre (`rendreBudget`) si le
 * travail ne doit finalement pas compter.
 */
export function consommerOuEspacer(
  cle: string,
  max: number,
  fenetreMs: number,
  intervalleMs: number,
  maintenant: number = Date.now(),
): { ok: true; unite: boolean } | { ok: false; reessayerDansS: number } {
  if (derniersPassages.size > NETTOYAGE_AU_DELA) {
    for (const [c, t] of derniersPassages) if (maintenant - t >= intervalleMs) derniersPassages.delete(c)
  }
  const prise = consommerBudgets([{ cle, quantite: 1, max }], fenetreMs, maintenant)
  if (!prise.ok) {
    const dernier = derniersPassages.get(cle)
    if (dernier !== undefined && maintenant - dernier < intervalleMs) {
      const prochainDansS = Math.ceil((dernier + intervalleMs - maintenant) / 1000)
      return { ok: false, reessayerDansS: Math.max(1, Math.min(prochainDansS, prise.reessayerDansS)) }
    }
  }
  derniersPassages.set(cle, maintenant)
  return { ok: true, unite: prise.ok }
}

/** Tests seulement. */
export function viderBudgets() {
  fenetres.clear()
  derniersPassages.clear()
}
