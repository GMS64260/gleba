/**
 * Sortie de stock saisie dans Consommations, par l'assistant ou le MCP : une
 * seule règle pour les trois (modèle de stock unique, lot 2, 2026-11-24).
 *
 * La consommation est l'en-tête de la sortie (espèce, quantité, jour,
 * destination, prix, note) ; les lots qu'elle a pris lui restent rattachés
 * (`sortirParLots`) et reviennent en stock si elle est annulée.
 *
 * Modèle de stock unique, L4.1 (2026-11-24) : une sortie que les lots libres
 * ne couvrent pas entièrement est REFUSÉE (409). Le stock d'une espèce va
 * devenir la somme de ses lots : une part « hors lots » le ferait mentir.
 * `quantiteHorsLots` reste à 0 ; les lignes antérieures gardent la leur.
 *
 * Une vente ne passe pas par ici : elle crée une recette et, au besoin, une
 * facture, depuis le lot vendu (Récoltes > Stock) ou un bon de livraison.
 */
import prisma from '@/lib/prisma'
import { dateIsoFacture } from '@/lib/facture-regles'
import { instantSortie, jourSortie, lendemain } from '@/lib/recolte/sortie-lot'
import { estAuMillieme } from '@/lib/stocks/milliemes'
import { preparerSortieStock } from '@/lib/stocks/sortie-stock'
import { rendreLotsConsommation, sortirParLots, type LotSorti } from '@/lib/stocks/sortie-lots'
import { verrouillerStockCommercial, verrouillerStockNetRecolte } from '@/lib/stocks/verrou-commercial'
import type { StatutSortieRecolte } from '@/lib/validations/recolte'
import { libelleUniteQuantite, type UniteQuantite } from '@/lib/recolte/projection'
import { invalidateKpi } from '@/lib/kpi/cache'

/** Destination « Vente » du référentiel : refusée ici, voir `MESSAGE_VENTE_PAR_LOT`. */
export const DESTINATION_VENTE = 'Vente'

/** Une sortie dépasse ce que les lots libres de l'espèce peuvent céder. */
class StockLotsInsuffisant extends Error {
  constructor(readonly disponible: number) {
    super('STOCK_LOTS_INSUFFISANT')
  }
}

export function messageStockLotsInsuffisant(disponible: number, unite: UniteQuantite): string {
  const q = `${disponible.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} ${libelleUniteQuantite(unite, disponible)}`
  return `Stock insuffisant dans les lots de récolte : ${q} peuvent sortir d'ici (lots en stock, récoltés au plus tard ce jour). `
    + 'Un lot lié à un bon ou à une facture, publié en boutique ou emporté au marché se sort par son document. '
    + 'Si le stock réel est plus grand, enregistrez la récolte manquante ou recomptez le stock.'
}

export const MESSAGE_VENTE_PAR_LOT =
  'Une vente se saisit depuis Récoltes > Stock (bouton Vendre) ou par un bon de livraison : elle y crée la recette et, au besoin, la facture. Consommations enregistre les pertes, les dons et la consommation personnelle.'

/** Statut que prennent les lots sortis, selon la destination choisie. */
const STATUT_PAR_DESTINATION: Record<string, StatutSortieRecolte> = {
  Consommation: 'consomme',
  Conservation: 'consomme',
  Don: 'don',
  Pertes: 'perte',
}

export function statutSortieDestination(destinationId: string | null | undefined): StatutSortieRecolte {
  return (destinationId && STATUT_PAR_DESTINATION[destinationId]) || 'consomme'
}

export type SaisieSortieConsommation = {
  especeId: string
  quantite: number
  /** Unité affichée à la saisie : confrontée à celle du stock. */
  unite?: UniteQuantite | null
  /** Jour de la sortie ; absent = aujourd'hui. */
  date?: Date | null
  destinationId?: string | null
  prix?: number | null
  notes?: string | null
}

export type ResultatSortieConsommation =
  | {
      ok: true
      consommationId: number
      especeId: string
      nom: string
      unite: UniteQuantite
      quantite: number
      couvert: number
      horsLots: number
      lots: LotSorti[]
    }
  | { ok: false; status: 400 | 404 | 409; error: string; champ?: string }

export async function enregistrerSortieConsommation(
  userId: string,
  saisie: SaisieSortieConsommation,
  maintenant: Date = new Date(),
): Promise<ResultatSortieConsommation> {
  if (saisie.destinationId === DESTINATION_VENTE) {
    return { ok: false, status: 409, error: MESSAGE_VENTE_PAR_LOT, champ: 'destinationId' }
  }
  if (saisie.destinationId) {
    const destination = await prisma.destination.findUnique({ where: { id: saisie.destinationId }, select: { id: true } })
    if (!destination) return { ok: false, status: 400, error: 'Destination inconnue.', champ: 'destinationId' }
  }
  const preparation = await preparerSortieStock(userId, saisie)
  if (!preparation.ok) return { ok: false, status: preparation.status, error: preparation.error }
  if (preparation.unite === 'kg' && !estAuMillieme(saisie.quantite)) {
    return { ok: false, status: 400, error: 'Données invalides — quantite : trois décimales au plus.', champ: 'quantite' }
  }
  // Jour de la sortie au jour civil ; un jour de marge pour l'Outre-mer de l'Est.
  const aujourdhui = dateIsoFacture(maintenant)
  const jour = saisie.date ? jourSortie(saisie.date) : aujourdhui
  if (jour > lendemain(aujourdhui)) {
    return { ok: false, status: 400, error: 'Une sortie réelle ne peut pas être datée dans le futur.', champ: 'date' }
  }
  const date = instantSortie(jour, maintenant)
  const statut = statutSortieDestination(saisie.destinationId)

  const resultat = await prisma.$transaction(async (tx) => {
    await verrouillerStockCommercial(tx, userId)
    await verrouillerStockNetRecolte(tx, userId, preparation.especeId)
    // En-tête d'abord, sans part hors lots : le stock de l'espèce ne descend
    // jamais, pendant l'écriture, sous ce qu'il vaudra une fois la sortie faite.
    const consommation = await tx.consommation.create({
      data: {
        userId,
        especeId: preparation.especeId,
        unite: preparation.unite,
        quantite: saisie.quantite,
        quantiteHorsLots: 0,
        date,
        destinationId: saisie.destinationId || null,
        prix: saisie.prix ?? null,
        notes: saisie.notes || null,
      },
      select: { id: true },
    })
    const parLots = await sortirParLots(tx, userId, {
      especeId: preparation.especeId,
      unite: preparation.unite,
      quantite: saisie.quantite,
      date,
      statut,
      consommationId: consommation.id,
    })
    // Tout ou rien : la transaction annule la consommation et les lots déjà pris.
    if (parLots.horsLots > 0) throw new StockLotsInsuffisant(parLots.couvert)
    return { consommationId: consommation.id, ...parLots }
  }).catch((erreur: unknown) => {
    if (erreur instanceof StockLotsInsuffisant) return erreur
    throw erreur
  })
  if (resultat instanceof StockLotsInsuffisant) {
    return { ok: false, status: 409, error: messageStockLotsInsuffisant(resultat.disponible, preparation.unite), champ: 'quantite' }
  }
  invalidateKpi(userId)
  return {
    ok: true,
    especeId: preparation.especeId,
    nom: preparation.nom,
    unite: preparation.unite,
    quantite: saisie.quantite,
    ...resultat,
  }
}

/** Annule une sortie : ses lots reviennent en stock, puis l'en-tête est supprimé. */
export async function annulerSortieConsommation(
  userId: string,
  consommationId: number,
): Promise<{ ok: true; lotsRendus: number } | { ok: false; status: 404; error: string }> {
  const resultat = await prisma.$transaction(async (tx) => {
    await verrouillerStockCommercial(tx, userId)
    const consommation = await tx.consommation.findFirst({ where: { id: consommationId, userId }, select: { id: true, especeId: true } })
    if (!consommation) return null
    await verrouillerStockNetRecolte(tx, userId, consommation.especeId)
    const lotsRendus = await rendreLotsConsommation(tx, userId, consommation.id)
    await tx.consommation.delete({ where: { id: consommation.id } })
    return lotsRendus
  })
  if (resultat === null) return { ok: false, status: 404, error: `Consommation #${consommationId} non trouvée` }
  invalidateKpi(userId)
  return { ok: true, lotsRendus: resultat }
}
