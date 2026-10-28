import type { Prisma, RecolteArbre, ProductionBois } from '@prisma/client'
import { quantiteBois } from '@/lib/commercial/stock-types'
import { dateIsoFacture } from '@/lib/facture-regles'
import { dateRecolteApi } from './creation-recolte'
import { ErreurVerger } from './erreur'

type Lot = RecolteArbre | ProductionBois
/** Appelé sous les verrous ferme puis lot. La clé protège les reprises réseau. */
export async function sortirReliquatVerger(tx: Prisma.TransactionClient, userId: string, type: 'fruit' | 'bois',
  lot: Lot, saisie: Record<string, unknown>) {
  const nature = String(saisie.statut)
  if (!(type === 'fruit' ? ['perte','consomme'] : ['utilise']).includes(nature)) throw new ErreurVerger('Sortie invalide.')
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
  const q = type === 'fruit' ? { quantite: (lot as RecolteArbre).quantite, unite: 'kg' } : quantiteBois(lot as ProductionBois)
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
