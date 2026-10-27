import { beforeEach, expect, it, vi } from 'vitest'
import type { Ligne } from '@/lib/__tests__/fixtures/referentiel-memoire'

const etat = vi.hoisted(() => ({ recoltes: [] as Ligne[], factures: [] as Ligne[] }))
vi.mock('@/lib/prisma', async () => {
  const { delegueMemoire } = await import('@/lib/__tests__/fixtures/referentiel-memoire')
  return { default: {
    recolte: { findMany: (args: never) => delegueMemoire(etat.recoltes).findMany(args) },
    facture: { findMany: (args: never) => delegueMemoire(etat.factures).findMany(args) },
  } }
})
import { chargerRevenusCultures } from '../revenus-cultures'

const debut = new Date('2026-01-01'), fin = new Date('2026-12-31')
const date = new Date('2026-06-01')
const lot = (extra: Ligne = {}) => ({ id: 1, userId: 'moi', cultureId: 7, factureId: null,
  quantite: 10, unite: 'kg', prixKg: 2, prixTotal: null, statut: 'en_stock', dateVente: date, ...extra })
const ligne = (extra: Ligne = {}) => ({ articleStockType: 'recolte', articleStockId: '1',
  quantite: 4, unite: 'kg', montantTTC: 12, ...extra })
const facture = (extra: Ligne = {}) => ({ id: 10, userId: 'moi', type: 'facture', date,
  statut: 'envoyee', totalTTC: 12, factureOrigineId: null, lignes: [ligne()], ...extra })
const calcul = () => chargerRevenusCultures('moi', debut, fin)
beforeEach(() => { etat.recoltes = []; etat.factures = [] })

it('vente directe au PU seul : 10 kg × 2 € = 20 €', async () => {
  etat.recoltes = [lot({ statut: 'vendu' })]
  expect((await calcul()).get(7)).toEqual({ revenus: 20, quantiteVendueParUnite: { kg: 10 } })
})
it('une facture de BL retrouve sa culture par le lot technique, sans sortie native', async () => {
  etat.recoltes = [lot()]; etat.factures = [facture()]
  expect((await calcul()).get(7)).toEqual({ revenus: 12, quantiteVendueParUnite: { kg: 4 } })
})
it('la vente native facturée ne compte pas une deuxième fois', async () => {
  etat.recoltes = [lot({ statut: 'vendu', factureId: 10, prixTotal: 20 })]
  etat.factures = [facture({ totalTTC: 20, lignes: [ligne({ articleStockType: null, articleStockId: null, montantTTC: 20 })] })]
  expect((await calcul()).get(7)).toEqual({ revenus: 20, quantiteVendueParUnite: { kg: 10 } })
})
it('un avoir avec lot déduit seulement ses lignes affectées', async () => {
  etat.recoltes = [lot()]
  etat.factures = [facture(), facture({ id: 11, type: 'avoir', factureOrigineId: 10,
    totalTTC: 3, lignes: [ligne({ quantite: 1, montantTTC: 3 })] })]
  expect((await calcul()).get(7)).toEqual({ revenus: 9, quantiteVendueParUnite: { kg: 3 } })
})
it('un avoir legacy corrige le revenu sans inventer une quantité retournée', async () => {
  etat.recoltes = [lot({ statut: 'vendu', factureId: 10, prixTotal: 20 })]
  etat.factures = [facture({ totalTTC: 20, lignes: [] }),
    facture({ id: 11, type: 'avoir', factureOrigineId: 10, totalTTC: 5, lignes: [] })]
  expect((await calcul()).get(7)).toEqual({ revenus: 15, quantiteVendueParUnite: { kg: 10 } })
})
it('un avoir de l’année retrouve une facture d’une année précédente', async () => {
  etat.recoltes = [lot({ factureId: 10 })]
  etat.factures = [facture({ date: new Date('2025-12-31'), lignes: [] }),
    facture({ id: 11, type: 'avoir', factureOrigineId: 10, totalTTC: 5, lignes: [] })]
  expect((await calcul()).get(7)).toEqual({ revenus: -5, quantiteVendueParUnite: {} })
})
it.each(['brouillon', 'annulee'])('ignore la facture %s', async statut => {
  etat.recoltes = [lot()]; etat.factures = [facture({ statut })]
  expect((await calcul()).size).toBe(0)
})
it('ignore un lot privé d’un autre compte, même cité par une facture', async () => {
  etat.recoltes = [lot({ userId: 'autre' })]; etat.factures = [facture()]
  expect((await calcul()).size).toBe(0)
})
it('ignore ventes et factures hors du compte ou de la période', async () => {
  etat.recoltes = [lot({ userId: 'autre', statut: 'vendu' }),
    lot({ id: 2, statut: 'vendu', dateVente: new Date('2027-01-01') })]
  etat.factures = [facture({ userId: 'autre' }), facture({ id: 11, date: new Date('2027-01-01') })]
  expect((await calcul()).size).toBe(0)
})
it('une description libre semblable au nom d’une culture reste non affectée', async () => {
  etat.recoltes = [lot()]; etat.factures = [facture({ lignes: [ligne({ articleStockType: null, articleStockId: null })] })]
  expect((await calcul()).size).toBe(0)
})
it('préserve les tiges sans les additionner aux kilos', async () => {
  etat.recoltes = [lot({ unite: 'tige' })]; etat.factures = [facture({ lignes: [ligne({ unite: 'tige' })] })]
  expect((await calcul()).get(7)).toEqual({ revenus: 12, quantiteVendueParUnite: { tige: 4 } })
})
it('une unité libre différente ne crée pas une fausse quantité vendue', async () => {
  etat.recoltes = [lot({ unite: 'tige' })]; etat.factures = [facture()]
  expect((await calcul()).get(7)).toEqual({ revenus: 12, quantiteVendueParUnite: {} })
})
