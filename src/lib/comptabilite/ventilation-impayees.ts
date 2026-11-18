import type { Devise } from '@/lib/territoires'
import { monnaieFacture } from './devise-reglement'

/**
 * Devise des créances impayées : ventilation unique de l'onglet Impayées
 * (page publique Comptabilité > Factures) et du tableau de bord.
 *
 * Frontière public/privé : ce module est PUBLIC. `impayees.ts` est une
 * surcharge de la zone privée dont la version publique ne porte ni la devise
 * figée des items ni cette ventilation ; il la réexporte d'ici, pour qu'une
 * seule implémentation serve les deux côtés.
 */
export interface ImpayeeEnDevise {
  source: string
  date?: string
  montant: number
  /** Identité figée des factures : la devise courante ne peut pas la remplacer. */
  emetteurSnapshot?: unknown
  /**
   * Devise figée d'une vente manuelle ; `null` : devise historique inconnue.
   * Absente : la devise courante s'applique.
   */
  monnaie?: Devise | null
}

/** Arrondi au centime, comme `construireImpayees`. */
function centimes(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Même ventilation pour Impayées et le tableau de bord, sans conversion implicite.
 * Ordre : devise figée projetée sur l'item (`monnaie`, `null` → groupe inconnu
 * ''), sinon devise figée de la facture, sinon devise courante (VenteProduit).
 */
export function ventilerImpayeesParDevise(items: readonly ImpayeeEnDevise[], devise: Devise | null) {
  const totaux = new Map<string | null, number>()
  for (const item of items) {
    const figee = item.monnaie !== undefined || item.source === 'Facture'
    const monnaie = figee ? monnaieImpayee(item, devise) ?? '' : devise
    totaux.set(monnaie, (totaux.get(monnaie) ?? 0) + item.montant)
  }
  if (items.length === 0) totaux.set(devise, 0)
  return Array.from(totaux, ([monnaie, montant]) => ({ monnaie, montant: centimes(montant) }))
}

/**
 * Devise d'une créance, même ordre que `ventilerImpayeesParDevise` : devise
 * projetée sur l'item, sinon devise figée de la facture, sinon devise
 * courante. `null` : devise inconnue (historique ou courante).
 */
export function monnaieImpayee(item: ImpayeeEnDevise, devise: Devise | null): Devise | null {
  if (item.monnaie !== undefined) return item.monnaie
  if (item.source === 'Facture') return monnaieFacture(item.emetteurSnapshot, item.date)
  return devise
}

/**
 * Porte sur chaque item la devise figée lue dans les pièces sources (instantané
 * de la facture, `monnaie` projetée par GET ventes-manuelles), sans écraser ce
 * que `construireImpayees` y a déjà mis. Une source sans devise figée reste
 * sans `monnaie` (devise courante), jamais une devise supposée.
 */
export function projeterDevisesImpayees<T extends { id: number; source: string; montant: number }>(
  items: readonly T[],
  sources: {
    factures?: ReadonlyArray<{ id: number; emetteurSnapshot?: unknown }>
    ventesManuelles?: ReadonlyArray<{ id: number; monnaie?: Devise | null }>
  },
): Array<T & ImpayeeEnDevise> {
  const factures = new Map((sources.factures ?? []).map((f) => [f.id, f]))
  const manuelles = new Map((sources.ventesManuelles ?? []).map((m) => [m.id, m]))
  return items.map((item) => {
    if (item.source === 'Facture' && !('emetteurSnapshot' in item)) {
      return { ...item, emetteurSnapshot: factures.get(item.id)?.emetteurSnapshot }
    }
    if (item.source === 'VenteManuelle' && !('monnaie' in item)) {
      const monnaie = manuelles.get(item.id)?.monnaie
      return monnaie !== undefined ? { ...item, monnaie } : item
    }
    return item
  })
}
