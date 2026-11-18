import { formatMontantDevise } from '@/lib/format-utils'
import type { Devise } from '@/lib/territoires'

/** Un sous-total d'une seule devise ; `null` : devise historique inconnue. */
export interface SousTotalDevise {
  monnaie: Devise | null
  montant: number
}

export const TOTAL_DEVISE_INCONNUE = 'Total indisponible : devise historique inconnue'

/**
 * Libellés d'un total ventilé par devise : un libellé par devise non nulle,
 * chacun dans SA devise ; jamais de somme EUR + XPF ni de réétiquetage dans
 * la devise courante. Tout à zéro : un seul zéro dans la première devise
 * connue (sinon `deviseCourante`, sinon « — » tant qu'elle charge).
 */
export function libellesTotauxParDevise(sousTotaux: readonly SousTotalDevise[], deviseCourante: Devise | null): string[] {
  const nonNuls = sousTotaux.filter(s => Math.round(s.montant * 100) !== 0)
  if (nonNuls.length === 0) {
    if (sousTotaux.some(s => s.monnaie === null)) return [TOTAL_DEVISE_INCONNUE]
    const devise = sousTotaux.find(s => s.monnaie !== null)?.monnaie ?? deviseCourante
    return [devise ? formatMontantDevise(0, devise) : '—']
  }
  return nonNuls.map(s => (s.monnaie ? formatMontantDevise(s.montant, s.monnaie) : TOTAL_DEVISE_INCONNUE))
}

/*
 * Contrat des API (lot devise-totaux-api, 16/11/2026) : chaque total monétaire
 * agrégé d'une réponse (GET /api/comptabilite/stats, revenus, accueil) a un
 * voisin `<nom>ParDevise` ; le total historique reste rempli quand une seule
 * devise est présente et vaut `null` dès que deux coexistent. Règle : un
 * montant sans devise figée suit la devise courante de l'exploitation ; deux
 * devises figées ne s'additionnent jamais.
 */

/** Un total d'une seule devise ; `monnaie: null` : devise historique inconnue. */
export interface TotalDevise {
  monnaie: Devise | null
  total: number
  count?: number
}

const rangDevise = (m: Devise | null) => (m === 'EUR' ? 0 : m === 'XPF' ? 1 : 2)
const auCentime = (n: number) => Math.round(n * 100) / 100

/**
 * Additionne des montants devise par devise. Ordre stable : EUR, XPF, inconnue.
 * Aucun élément : un seul total à zéro dans `deviseVide` (devise courante).
 */
export function sommerParDevise<T>(
  elements: readonly T[],
  monnaie: (e: T) => Devise | null,
  montant: (e: T) => number,
  deviseVide: Devise | null,
): Array<Required<TotalDevise>> {
  const totaux = new Map<Devise | null, { total: number; count: number }>()
  for (const e of elements) {
    const m = monnaie(e)
    const t = totaux.get(m) ?? { total: 0, count: 0 }
    t.total += montant(e)
    t.count += 1
    totaux.set(m, t)
  }
  if (totaux.size === 0) totaux.set(deviseVide, { total: 0, count: 0 })
  return [...totaux]
    .sort(([a], [b]) => rangDevise(a) - rangDevise(b))
    .map(([monnaie, t]) => ({ monnaie, total: auCentime(t.total), count: t.count }))
}

/** Un groupe compte s'il a un montant ou au moins une écriture (pièce à zéro comprise). */
export function estPresent(t: Pick<TotalDevise, 'total' | 'count'>): boolean {
  return t.total !== 0 || (t.count ?? 0) > 0
}

/** Le total historique : rempli pour une seule devise, `null` dès que deux coexistent. */
export function totalSiUneDevise(parDevise: readonly Pick<TotalDevise, 'total'>[]): number | null {
  if (parDevise.length > 1) return null
  return parDevise[0]?.total ?? 0
}

/**
 * `a − b` devise par devise (bénéfice = revenus − dépenses) : une devise
 * absente d'un côté y vaut zéro, jamais une conversion. Un groupe à zéro
 * sans écriture comptée (`count` absent ou nul) ne crée pas de devise.
 */
export function soustraireParDevise(a: readonly TotalDevise[], b: readonly TotalDevise[]): TotalDevise[] {
  const presents = (l: readonly TotalDevise[]) => l.filter(estPresent)
  const pa = presents(a)
  const pb = presents(b)
  const devises = [...new Set([...pa, ...pb].map(t => t.monnaie))]
  if (devises.length === 0) return [{ monnaie: a[0]?.monnaie ?? b[0]?.monnaie ?? null, total: 0 }]
  return devises
    .sort((x, y) => rangDevise(x) - rangDevise(y))
    .map(monnaie => ({
      monnaie,
      total: auCentime(
        pa.filter(t => t.monnaie === monnaie).reduce((s, t) => s + t.total, 0)
        - pb.filter(t => t.monnaie === monnaie).reduce((s, t) => s + t.total, 0),
      ),
    }))
}

/**
 * Devise commune de toutes les séries d'un graphique (barres, aires) : un
 * graphique ne trace ensemble que des montants d'une même devise. Chaque
 * série mono-devise ne suffit pas (recettes XPF seules et charges EUR seules
 * sont deux nombres d'unités différentes).
 * - `{ monnaie }` : une seule devise présente (ou aucune : `monnaie` = `vide`) ;
 * - `null` : deux devises présentes, ou une série sans ventilation alors
 *   qu'elle porte un montant (devise inconnue) — graphique indisponible.
 */
export function deviseCommuneDesSeries(
  series: ReadonlyArray<{ valeur: number | null; parDevise?: readonly Pick<TotalDevise, 'monnaie' | 'total' | 'count'>[] }>,
  vide: Devise | null,
): { monnaie: Devise | null } | null {
  const devises = new Set<Devise | null>()
  for (const s of series) {
    if (!s.parDevise) {
      if (s.valeur === null || s.valeur !== 0) return null
      continue
    }
    for (const t of s.parDevise) if (estPresent(t)) devises.add(t.monnaie)
  }
  if (devises.size > 1 || devises.has(null)) return null
  return { monnaie: devises.size === 1 ? [...devises][0] : vide }
}

/** Une marge exige des montants dans une seule devise connue. */
export function margeParDevise(revenus: readonly TotalDevise[], depenses: readonly TotalDevise[]): number | null {
  const presentes = [...revenus, ...depenses].filter(estPresent)
  const devises = new Set(presentes.map(t => t.monnaie))
  if (devises.size > 1 || devises.has(null)) return null
  const recettes = revenus.reduce((s, t) => s + t.total, 0)
  const charges = depenses.reduce((s, t) => s + t.total, 0)
  return recettes > 0 ? auCentime((recettes - charges) / recettes * 100) : 0
}

export class ErreurDevisesIncompatibles extends Error {
  readonly status = 422
  constructor() {
    super('Calcul indisponible : des écritures sont dans une autre devise ou dans une devise inconnue. Consultez les totaux par devise du compte de résultat.')
    this.name = 'ErreurDevisesIncompatibles'
  }
}

/** Les calculs sans ventilation ne peuvent utiliser que la devise courante. */
export function verifierDeviseCalcul(devise: Devise | null, ...groupes: ReadonlyArray<readonly TotalDevise[]>): void {
  if (groupes.some(liste => liste.some(t => estPresent(t) && (t.monnaie === null || t.monnaie !== devise)))) {
    throw new ErreurDevisesIncompatibles()
  }
}
