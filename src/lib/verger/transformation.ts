import { z } from 'zod'
import type { RecolteArbre } from '@prisma/client'
import prisma from '@/lib/prisma'
import { verrouillerStockCommercial } from '@/lib/stocks/verrou-commercial'
import { stockEstDenombrable } from '@/lib/commercial/stock-types'
import { dateIsoFacture } from '@/lib/facture-regles'
import { invalidateKpi } from '@/lib/kpi/cache'
import { STATUTS_BIO, type StatutBio } from '@/lib/statut-bio'
import { dateRecolteApi } from './creation-recolte'
import { ErreurVerger } from './erreur'
import { prochainNumeroLotVerger } from './numero-lot'
import { NATURE_TRANSFORMATION, restituerSortieVerger, verrouillerLotVerger } from './sortie-stock'
import { TAUX_TVA_PRODUIT_TRANSFORME, UNITES_PRODUIT_TRANSFORME } from './transformation-options'

/**
 * Produits transformés du verger (2026-10-30, retour FB-8CXUUN) : la sortie
 * « usage interne » retirait bien les fruits, mais rien ne recevait le jus ou
 * la compote obtenus. Une transformation sort les kilos utilisés de un ou
 * plusieurs lots de fruits (nature « transforme ») et crée un lot transformé
 * en stock commercial, vendable par BL ou facture comme un fromage prêt.
 */


const date = z.string({ error: 'Date invalide.' }).nullable().optional()
const saisieSchema = z.object({
  produit: z.string({ error: 'Indiquez le produit obtenu.' }).trim().min(1, 'Indiquez le produit obtenu.').max(120, 'Nom de produit trop long.'),
  quantite: z.number({ error: 'Indiquez la quantité obtenue.' }).finite().positive('Indiquez la quantité obtenue.').max(1e7),
  unite: z.enum(UNITES_PRODUIT_TRANSFORME, { error: 'Unité invalide.' }),
  date,
  datePeremption: date,
  prixUnitaire: z.number({ error: 'Prix invalide.' }).finite().min(0, 'Le prix doit être positif ou nul.').max(1e6).nullable().optional(),
  tauxTVA: z.number({ error: 'Taux de TVA invalide.' }).refine(t => (TAUX_TVA_PRODUIT_TRANSFORME as readonly number[]).includes(t), 'Taux de TVA invalide.').default(5.5),
  numLot: z.string().trim().max(60, 'Numéro de lot trop long.').nullable().optional(),
  notes: z.string().trim().max(2000, 'Notes trop longues.').nullable().optional(),
  cleIdempotence: z.string({ error: 'Actualisez la page avant d’enregistrer cette transformation.' }).min(8, 'Actualisez la page avant d’enregistrer cette transformation.').max(100),
  sources: z.array(z.object({
    fruitId: z.number({ error: 'Lot de fruits invalide.' }).int().positive(),
    quantite: z.number({ error: 'Indiquez les kilos de fruits utilisés.' }).finite().positive('Indiquez les kilos de fruits utilisés.'),
  }), { error: 'Choisissez au moins un lot de fruits.' }).min(1, 'Choisissez au moins un lot de fruits.').max(20),
})
export type SaisieTransformation = z.input<typeof saisieSchema>

const arrondi = (n: number) => Math.round(n * 1e6) / 1e6

/** Le plus bas statut de ses fruits : un mélange AB et conventionnel n'est pas bio. Inconnu si une source l'est. */
export function statutBioDesSources(statuts: (string | null | undefined)[]): StatutBio | null {
  if (!statuts.length || statuts.some(s => !s || !STATUTS_BIO.includes(s as StatutBio))) return null
  return (statuts as StatutBio[]).reduce((min, s) => (STATUTS_BIO.indexOf(s) < STATUTS_BIO.indexOf(min) ? s : min))
}

function analyser(brut: unknown) {
  const r = saisieSchema.safeParse(brut)
  if (!r.success) {
    const probleme = r.error.issues[0]
    throw new ErreurVerger(probleme.message, 400, String(probleme.path[0] ?? ''))
  }
  const saisie = r.data
  if (stockEstDenombrable(saisie.unite) && !Number.isInteger(saisie.quantite)) {
    throw new ErreurVerger(`Un produit en ${saisie.unite} se compte en quantité entière.`, 400, 'quantite')
  }
  const ids = saisie.sources.map(s => s.fruitId)
  if (new Set(ids).size !== ids.length) throw new ErreurVerger('Chaque lot de fruits ne figure qu’une fois.', 400, 'sources')
  return saisie
}

/** Point d'entrée commun à l'écran Productions et aux outils de l'assistant. */
export async function creerLotTransforme(userId: string, brut: unknown) {
  const saisie = analyser(brut)
  const jour = dateRecolteApi(saisie.date, 'date', new Date())!
  const datePeremption = dateRecolteApi(saisie.datePeremption, 'datePeremption')
  if (dateIsoFacture(jour) > dateIsoFacture(new Date())) throw new ErreurVerger('Une transformation ne se date pas dans le futur.', 400, 'date')
  if (datePeremption && dateIsoFacture(datePeremption) < dateIsoFacture(jour)) {
    throw new ErreurVerger('La date limite précède la transformation.', 400, 'datePeremption')
  }
  const lot = await prisma.$transaction(async tx => {
    await verrouillerStockCommercial(tx, userId)
    const precedent = await tx.lotTransforme.findUnique({ where: { userId_cleIdempotence: { userId, cleIdempotence: saisie.cleIdempotence } } })
    if (precedent) {
      if (precedent.produit !== saisie.produit || precedent.quantite !== saisie.quantite || precedent.unite !== saisie.unite) {
        throw new ErreurVerger('Cette référence désigne une autre transformation.', 409)
      }
      return precedent
    }
    // Verrous des lots dans un ordre stable, comme les ventes de plusieurs lots.
    const fruits = []
    for (const source of [...saisie.sources].sort((a, b) => a.fruitId - b.fruitId)) {
      const fruit = await verrouillerLotVerger(tx, userId, 'fruit', source.fruitId) as RecolteArbre | null
      if (!fruit) throw new ErreurVerger('Lot de fruits introuvable.', 404, 'sources')
      const nom = fruit.numLot ?? `du ${fruit.date.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}`
      if (fruit.statut !== 'en_stock' || fruit.factureId) throw new ErreurVerger(`Le lot ${nom} n’est plus en stock.`, 409, 'sources')
      const disponible = fruit.stockDisponibleCommercial ?? fruit.quantite
      if (source.quantite > disponible + 1e-6) {
        throw new ErreurVerger(`Le lot ${nom} n’a plus que ${arrondi(disponible)} kg en stock.`, 409, 'sources')
      }
      if (dateIsoFacture(jour) < dateIsoFacture(fruit.date)) throw new ErreurVerger(`La transformation ne peut pas précéder la récolte du lot ${nom}.`, 400, 'date')
      fruits.push({ fruit, disponible, quantite: Math.min(source.quantite, disponible) })
    }
    const numLot = saisie.numLot || await prochainNumeroLotVerger(tx, userId, { date: jour, parcelleNom: 'TR', espece: saisie.produit })
    if (await tx.lotTransforme.findUnique({ where: { userId_numLot: { userId, numLot } }, select: { id: true } })) {
      throw new ErreurVerger('Ce numéro de lot existe déjà. Choisissez-en un autre ou laissez le champ vide.', 409, 'numLot')
    }
    const cree = await tx.lotTransforme.create({ data: {
      userId, produit: saisie.produit, numLot, date: jour, quantite: saisie.quantite, unite: saisie.unite,
      stockDisponibleCommercial: saisie.quantite, datePeremption, prixUnitaire: saisie.prixUnitaire ?? null, tauxTVA: saisie.tauxTVA,
      statutBioSnapshot: statutBioDesSources(fruits.map(f => f.fruit.statutBioSnapshot)), notes: saisie.notes || null,
      cleIdempotence: saisie.cleIdempotence,
    } })
    for (const { fruit, disponible, quantite } of fruits) {
      await tx.recolteArbre.update({ where: { id: fruit.id, userId }, data: { stockDisponibleCommercial: Math.max(0, arrondi(disponible - quantite)) } })
      await tx.mouvementStockCommercial.create({ data: {
        userId, nature: NATURE_TRANSFORMATION, cleIdempotence: `${saisie.cleIdempotence}:${fruit.id}`,
        notes: `Transformé en ${saisie.produit} (lot ${numLot})`, articleStockType: 'fruit', articleStockId: String(fruit.id),
        sourceNom: fruit.numLot ?? `Récolte #${fruit.id}`, unite: 'kg', quantite, date: jour, fruitId: fruit.id, transformationId: cree.id,
      } })
    }
    return cree
  })
  invalidateKpi(userId)
  return lot
}

/** Liste de l'écran : sources tracées, part vendue, annulation possible tant que rien n'est sorti. */
export async function listerLotsTransformes(userId: string) {
  const lots = await prisma.lotTransforme.findMany({
    where: { userId },
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    include: {
      sources: { select: { id: true, quantite: true, unite: true, sourceNom: true, fruit: { select: { id: true, numLot: true, date: true, arbre: { select: { nom: true, espece: true } } } } } },
      _count: { select: { mouvements: true } },
    },
  })
  return lots.map(({ _count, ...lot }) => ({ ...lot, annulable: _count.mouvements === 0 }))
}

/**
 * Annule une transformation jamais livrée : les fruits reviennent dans leurs
 * lots, le produit disparaît. Un produit livré ou facturé reste, avec ses
 * documents ; un retour sur le document le remet en stock.
 */
export async function annulerLotTransforme(userId: string, id: number) {
  if (!Number.isInteger(id) || id <= 0) throw new ErreurVerger('ID invalide.')
  const resultat = await prisma.$transaction(async tx => {
    await verrouillerStockCommercial(tx, userId)
    const lot = await tx.lotTransforme.findFirst({ where: { id, userId }, include: { sources: true, _count: { select: { mouvements: true } } } })
    if (!lot) throw new ErreurVerger('Produit transformé introuvable.', 404)
    if (lot._count.mouvements) {
      throw new ErreurVerger('Ce produit a été livré ou facturé : il reste avec ses documents. Enregistrez un retour en stock sur le document si besoin.', 409)
    }
    for (const sortie of [...lot.sources].sort((a, b) => (a.fruitId ?? 0) - (b.fruitId ?? 0))) {
      const fruit = await verrouillerLotVerger(tx, userId, 'fruit', sortie.fruitId!)
      if (!fruit) throw new ErreurVerger('Lot de fruits introuvable.', 404)
      await restituerSortieVerger(tx, userId, 'fruit', fruit, sortie)
    }
    await tx.lotTransforme.delete({ where: { id: lot.id } })
    return { id: lot.id, produit: lot.produit, numLot: lot.numLot, fruitsRestitues: lot.sources.reduce((n, s) => n + s.quantite, 0) }
  })
  invalidateKpi(userId)
  return resultat
}
