import { Prisma, type RecolteArbre, type ProductionBois } from '@prisma/client'
import prisma from '@/lib/prisma'
import { verrouillerStockCommercial } from '@/lib/stocks/verrou-commercial'
import { quantiteBois } from '@/lib/commercial/stock-types'
import { dateIsoFacture } from '@/lib/facture-regles'
import { invalidateKpi } from '@/lib/kpi/cache'
import { dateRecolteApi } from './creation-recolte'
import { ErreurVerger } from './erreur'

type Lot = RecolteArbre | ProductionBois
type TypeLot = 'fruit' | 'bois'
type Tx = Prisma.TransactionClient
type Sortie = { id: string; nature: string; quantite: number; unite: string; date: Date }

/** Natures du journal physique saisies et annulées une à une : jamais un BL ni une facture. */
export const NATURES_SORTIE_VERGER: Record<TypeLot, readonly string[]> = { fruit: ['perte', 'consomme'], bois: ['utilise'] }
/** Fruits utilisés par une transformation : annulés avec leur produit transformé. */
export const NATURE_TRANSFORMATION = 'transforme'
/** Tout le journal physique, comme les pertes pour le reliquat, la correction et le gel. */
const NATURES_PHYSIQUES: Record<TypeLot, readonly string[]> = { fruit: [...NATURES_SORTIE_VERGER.fruit, NATURE_TRANSFORMATION], bois: NATURES_SORTIE_VERGER.bois }
const EPSILON = 1e-6
// Le reliquat reste entre zéro et la production (contraintes CHECK de la base).
const borner = (reliquat: number, production: number) => Math.min(production, Math.max(0, Math.round(reliquat * 1e6) / 1e6))
const filtreLot = (type: TypeLot, id: number) => (type === 'fruit' ? { fruitId: id } : { boisId: id })

/** Quantité et unité dans lesquelles les sorties d'un lot sont comptées. */
export function quantiteLotVerger(type: TypeLot, lot: Lot) {
  return type === 'fruit' ? { quantite: (lot as RecolteArbre).quantite, unite: 'kg' } : quantiteBois(lot as ProductionBois)
}

/**
 * Revue du 2026-10-29 : une perte sur un lot jamais livré rendait le reliquat
 * non nul et figeait le lot pour toujours (ni correction, ni suppression, ni
 * annulation). Seul un BL ou une facture fige désormais un lot, ou un reliquat
 * que ses sorties physiques n'expliquent pas (lot transféré, saisie ancienne) :
 * dans le doute, on conserve.
 */
export function lotVergerFige(
  production: { quantite: number; unite: string },
  stockDisponibleCommercial: number | null | undefined,
  sorties: { quantite: number; unite: string }[],
  livraisons: number,
) {
  if (stockDisponibleCommercial == null) return false
  if (livraisons > 0 || sorties.length === 0 || sorties.some(s => s.unite !== production.unite)) return true
  const total = sorties.reduce((n, s) => n + s.quantite, 0)
  return Math.abs(production.quantite - total - stockDisponibleCommercial) > EPSILON
}

/** Sorties physiques et verdict de gel, à lire sous le verrou du stock de la ferme. */
export async function etatSortiesLotVerger(tx: Tx, userId: string, type: TypeLot, lot: Lot) {
  const production = quantiteLotVerger(type, lot)
  if (lot.stockDisponibleCommercial == null) return { fige: false, sorties: [] as Sortie[], total: 0, production }
  const mouvements: Sortie[] = await tx.mouvementStockCommercial.findMany({ where: { userId, ...filtreLot(type, lot.id) },
    select: { id: true, nature: true, quantite: true, unite: true, date: true } })
  const sorties = mouvements.filter(m => NATURES_PHYSIQUES[type].includes(m.nature))
  return {
    fige: lotVergerFige(production, lot.stockDisponibleCommercial, sorties, mouvements.length - sorties.length),
    sorties, total: sorties.reduce((n, s) => n + s.quantite, 0), production,
  }
}

/**
 * Reliquat d'un lot sans document après correction de sa production. La
 * nouvelle quantité doit couvrir les sorties enregistrées, dans leur unité,
 * et la production ne peut pas suivre la première d'entre elles.
 */
export function reliquatApresCorrection(etat: Awaited<ReturnType<typeof etatSortiesLotVerger>>,
  nouvelle: { quantite: number; unite: string; date: Date }) {
  if (nouvelle.unite !== etat.production.unite) {
    throw new ErreurVerger(`Les sorties de ce lot sont comptées en ${etat.production.unite}. Conservez cette mesure ou annulez d’abord ses sorties.`, 409)
  }
  if (nouvelle.quantite + EPSILON < etat.total) {
    throw new ErreurVerger(`La quantité doit couvrir les sorties déjà enregistrées (${Math.round(etat.total * 1000) / 1000} ${etat.production.unite}). Annulez d’abord une sortie depuis l’historique.`, 409, 'quantite')
  }
  const premiere = etat.sorties.reduce<Date | null>((min, s) => (!min || s.date < min ? s.date : min), null)
  if (premiere && dateIsoFacture(nouvelle.date) > dateIsoFacture(premiere)) {
    throw new ErreurVerger('Une sortie de ce lot est antérieure à cette date. Annulez-la d’abord ou choisissez une date plus ancienne.', 409, 'date')
  }
  return borner(nouvelle.quantite - etat.total, nouvelle.quantite)
}

/** Appelé sous les verrous ferme puis lot. La clé protège les reprises réseau. */
export async function sortirReliquatVerger(tx: Prisma.TransactionClient, userId: string, type: 'fruit' | 'bois',
  lot: Lot, saisie: Record<string, unknown>) {
  const nature = String(saisie.statut)
  if (!NATURES_SORTIE_VERGER[type].includes(nature)) throw new ErreurVerger('Sortie invalide.')
  const cleIdempotence = saisie.cleIdempotence
  if (typeof cleIdempotence !== 'string' || cleIdempotence.length < 8 || cleIdempotence.length > 120) {
    throw new ErreurVerger('Actualisez la page avant d’enregistrer cette sortie.', 400)
  }
  const precedente = await tx.mouvementStockCommercial.findUnique({ where: { userId_cleIdempotence: { userId, cleIdempotence } } })
  if (precedente) {
    if (precedente.articleStockType !== type || precedente.articleStockId !== String(lot.id) || precedente.nature !== nature
      || (saisie.quantite !== undefined && saisie.quantite !== precedente.quantite)
      || ((saisie.notes !== undefined || saisie.destination !== undefined) && (saisie.notes ?? saisie.destination ?? null) !== precedente.notes)
      || (saisie.date !== undefined && dateRecolteApi(saisie.date, 'date')?.getTime() !== precedente.date.getTime())) throw new ErreurVerger('Cette référence désigne une autre sortie.', 409)
    return { ...lot, sortieStock: precedente }
  }
  if (lot.statut !== 'en_stock' || lot.factureId) throw new ErreurVerger('Seul un reliquat en stock peut sortir pour perte ou usage interne.', 409)
  const q = quantiteLotVerger(type, lot)
  const disponible = lot.stockDisponibleCommercial ?? q.quantite
  const quantite = saisie.quantite === undefined ? disponible : saisie.quantite
  if (typeof quantite !== 'number' || !Number.isFinite(quantite) || quantite <= 0 || quantite > disponible) {
    throw new ErreurVerger('Indiquez une quantité positive inférieure ou égale au reliquat disponible.', 409, 'quantite')
  }
  const date = dateRecolteApi(saisie.date, 'date', new Date())!
  if (dateIsoFacture(date) < dateIsoFacture(lot.date) || dateIsoFacture(date) > dateIsoFacture(new Date())) {
    throw new ErreurVerger('La sortie doit être datée entre la production et aujourd’hui.', 400, 'date')
  }
  const notes = saisie.notes ?? saisie.destination ?? null
  if (notes !== null && (typeof notes !== 'string' || notes.length > 2000)) throw new ErreurVerger('Notes invalides.', 400, 'notes')
  const updated = type === 'fruit'
    ? await tx.recolteArbre.update({ where: { id: lot.id, userId }, data: { stockDisponibleCommercial: disponible - quantite } })
    : await tx.productionBois.update({ where: { id: lot.id, userId }, data: { stockDisponibleCommercial: disponible - quantite } })
  const sortieStock = await tx.mouvementStockCommercial.create({ data: {
    userId, nature, cleIdempotence, notes, articleStockType: type, articleStockId: String(lot.id),
    sourceNom: lot.numLot ?? `${type === 'fruit' ? 'Récolte' : 'Bois'} #${lot.id}`, unite: q.unite, quantite, date,
    ...(type === 'fruit' ? { fruitId: lot.id } : { boisId: lot.id }),
  } })
  return { ...updated, sortieStock }
}

/** Verrou du lot après celui de la ferme, puis sa lecture : null s'il n'est pas à ce compte. */
export async function verrouillerLotVerger(tx: Tx, userId: string, type: TypeLot, id: number): Promise<Lot | null> {
  const table = type === 'fruit' ? 'recoltes_arbres' : 'production_bois'
  await tx.$queryRaw(Prisma.sql`SELECT id FROM ${Prisma.raw(table)} WHERE id = ${id} AND user_id = ${userId} FOR UPDATE`)
  return type === 'fruit'
    ? tx.recolteArbre.findUnique({ where: { id, userId } })
    : tx.productionBois.findUnique({ where: { id, userId } })
}

/**
 * Supprime une sortie physique et rend sa quantité au lot verrouillé : un lot
 * sans plus aucun mouvement redevient libre comme avant sa première sortie.
 */
export async function restituerSortieVerger(tx: Tx, userId: string, type: TypeLot, lot: Lot, sortie: { id: string; quantite: number }) {
  await tx.mouvementStockCommercial.delete({ where: { id: sortie.id } })
  const production = quantiteLotVerger(type, lot)
  const reliquat = borner((lot.stockDisponibleCommercial ?? production.quantite) + sortie.quantite, production.quantite)
  const restants = await tx.mouvementStockCommercial.count({ where: { userId, ...filtreLot(type, lot.id) } })
  const stockDisponibleCommercial = restants === 0 && Math.abs(reliquat - production.quantite) <= EPSILON ? null : reliquat
  return type === 'fruit'
    ? tx.recolteArbre.update({ where: { id: lot.id, userId }, data: { stockDisponibleCommercial } })
    : tx.productionBois.update({ where: { id: lot.id, userId }, data: { stockDisponibleCommercial } })
}

/**
 * Annule une perte, une consommation ou un usage interne : la quantité revient
 * au reliquat (`restituerSortieVerger`). Mêmes verrous que la sortie (ferme
 * puis lot). La sortie est désignée par son identifiant : une reprise réseau
 * la trouve déjà retirée et ne restitue rien une seconde fois.
 */
export async function annulerSortieVerger(type: TypeLot, userId: string, id: number, sortieId: string) {
  if (!Number.isInteger(id) || id <= 0) throw new ErreurVerger('ID invalide.')
  if (typeof sortieId !== 'string' || !sortieId || sortieId.length > 120) throw new ErreurVerger('Sortie invalide.')
  const resultat = await prisma.$transaction(async tx => {
    await verrouillerStockCommercial(tx, userId)
    const lot = await verrouillerLotVerger(tx, userId, type, id)
    if (!lot) throw new ErreurVerger('Lot introuvable.', 404)
    const sortie = await tx.mouvementStockCommercial.findFirst({ where: { id: sortieId, userId } })
    if (!sortie) return { ...lot, sortieAnnulee: null, dejaAnnulee: true }
    if ((type === 'fruit' ? sortie.fruitId : sortie.boisId) !== id) throw new ErreurVerger('Cette référence désigne une autre sortie.', 409)
    if (sortie.nature === NATURE_TRANSFORMATION) {
      throw new ErreurVerger('Ces fruits ont servi à un produit transformé. Annulez la transformation depuis Productions > Produits transformés.', 409)
    }
    if (!NATURES_SORTIE_VERGER[type].includes(sortie.nature) || sortie.documentId || sortie.factureId) {
      throw new ErreurVerger('Ce mouvement vient d’un bon de livraison ou d’une facture. Utilisez Retour en stock sur le document.', 409)
    }
    const updated = await restituerSortieVerger(tx, userId, type, lot, sortie)
    return { ...updated, sortieAnnulee: { id: sortie.id, nature: sortie.nature, quantite: sortie.quantite, unite: sortie.unite }, dejaAnnulee: false }
  })
  invalidateKpi(userId)
  return resultat
}
