/**
 * Ticket cmvnvaal2 (QA 2026-10-25) — après une vente de 40 tiges de dahlia à
 * 48 € (1,20 €/tige), Récoltes > Stock valorisait les 4 lots restants
 * (1 + 1 + 10 + 9 = 21 tiges) à 630 € (quantité × `Espece.prixKg`, 30 €/kg du
 * catalogue lu comme 30 €/tige) et Comptabilité > Stocks unifiés à 30,87 €
 * (moyenne simple des ventes de l'espèce, toutes unités confondues).
 *
 * Une seule règle (`valoriserLot`, ordre arbitré en revue) : lot, fiche d'une
 * espèce personnelle dans son unité, vente moyenne pondérée dans l'unité du
 * lot, catalogue puis barème pour des kilos du catalogue, sinon aucune. Les
 * deux écrans donnent la même valeur et disent la même méthode.
 */

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { delegueMemoire, jeuReferentiel, sessionDe, MOI, AUTRE, type Ligne } from '@/lib/__tests__/fixtures/referentiel-memoire'

const etat = vi.hoisted(() => ({
  recolte: null as unknown,
  culture: null as unknown,
  requireAuthApi: vi.fn(),
}))

vi.mock('@/lib/prisma', () => {
  // Tout modèle autre que `recolte` et `culture` est vide : seule la
  // valorisation des lots et des cultures en cours est en jeu ici.
  const vide = new Proxy({}, { get: () => vi.fn(async () => []) })
  return {
    default: new Proxy({}, {
      get: (_cible, modele) => (modele === 'recolte' ? etat.recolte : modele === 'culture' ? etat.culture : vide),
    }),
  }
})
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: etat.requireAuthApi }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/elevage/stock-cheptel', () => ({ chargerCheptelEnStock: vi.fn(async () => ({ individuels: [], lots: [] })) }))
vi.mock('@/lib/stocks-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/stocks-helpers')>()),
  calculerStockOeufs: vi.fn(async () => ({ stockNet: 0, detail: { produits: 0 } })),
}))

import { GET as LISTE_RECOLTES } from '@/app/api/recoltes/route'
import { computeStocksUnifies } from '@/lib/comptabilite/stocks-unifies'
import {
  libelleCourtValorisation,
  libelleMethodesValorisation,
  prixDeValorisation,
  prixProposeDeVente,
  prixVentesMoyens,
  valoriserLot,
  type EspecePrix,
} from '@/lib/recolte/valorisation'

const MAINTENANT = new Date()
const HIER = new Date(MAINTENANT.getTime() - 24 * 3600 * 1000)

// Espèces : catalogue (userId null, prix écrit en €/kg) et personnelles.
const dahlia = { id: 'Dahlia', nom: 'Dahlia', userId: null, prixKg: 30, uniteRendement: 'tiges_m2', rendement: 20, famille: null }
const carotte = { id: 'Carotte', nom: 'Carotte', userId: null, prixKg: 2, uniteRendement: 'kg_m2', rendement: 4, famille: null }
const radis = { id: 'Radis', nom: 'Radis', userId: null, prixKg: null, uniteRendement: 'kg_m2', rendement: 2, famille: null }
const pivoinePerso = { id: 'cm-pivoine', nom: 'Pivoine du jardin', userId: MOI, prixKg: 1.5, uniteRendement: 'tiges_m2', rendement: 10, famille: null }
const tomatePerso = { id: 'cm-tomate', nom: 'Tomate de Marmande maison', userId: MOI, prixKg: 8, uniteRendement: 'kg_m2', rendement: 5, famille: null }
const cosmosPerso = { id: 'cm-cosmos', nom: 'Cosmos maison', userId: MOI, prixKg: null, uniteRendement: 'tiges_m2', rendement: 15, famille: null }
// Entrée partagée par un AUTRE compte (revue du 2026-10-25) : son prix a été
// saisi par son auteur, ce n'est pas « votre fiche ». Prix 5, unité tiges.
const { partagee } = jeuReferentiel((id, nom) => ({ id, nom, prixKg: 5, uniteRendement: 'tiges_m2', rendement: 10, famille: null }))

let prochainId = 1
const lot = (espece: { id: string }, quantite: number, unite: string, extra: Ligne = {}): Ligne => ({
  id: prochainId++,
  userId: MOI,
  especeId: espece.id,
  cultureId: 7,
  date: new Date('2026-09-15T08:00:00Z'),
  quantite,
  unite,
  statut: 'en_stock',
  dateVente: null,
  prixKg: null,
  prixTotal: null,
  clientId: null,
  clientNom: null,
  factureId: null,
  datePeremption: null,
  notes: null,
  statutBioSnapshot: null,
  espece,
  culture: { id: 7, variete: null, planche: null },
  ...extra,
})
const vente = (espece: { id: string }, quantite: number, unite: string, prixKg: number | null, prixTotal: number) =>
  lot(espece, quantite, unite, { statut: 'vendu', dateVente: HIER, prixKg, prixTotal })

/**
 * Le cas du ticket, durci pour faire échouer l'ancienne règle de Stocks
 * unifiés : une vente de dahlia AU KILO et une seconde vente en tiges d'une
 * autre quantité (moyenne pondérée 1,40 ≠ moyenne simple 1,70 ≠ moyenne de
 * toutes unités 5,13). Plus les cas de la revue : espèce personnelle en tiges
 * à prix de fiche, kilos (fiche personnelle, ventes, barème).
 */
const recoltes = (): Ligne[] => [
  lot(dahlia, 1, 'tige'),
  lot(dahlia, 1, 'tige'),
  lot(dahlia, 10, 'tige'),
  lot(dahlia, 9, 'tige'),
  vente(dahlia, 40, 'tige', 1.2, 48),
  vente(dahlia, 10, 'tige', 2.2, 22),
  vente(dahlia, 2, 'kg', 12, 24),
  lot(pivoinePerso, 6, 'tige'),
  lot(tomatePerso, 5, 'kg'),
  vente(tomatePerso, 3, 'kg', 6, 18),
  lot(carotte, 10, 'kg'),
  vente(carotte, 4, 'kg', 3, 12),
  lot(radis, 2, 'kg'),
]

const culture = (id: number, espece: typeof dahlia | typeof cosmosPerso): Ligne => ({
  id,
  userId: MOI,
  plancheId: `P${id}`,
  quantite: null,
  longueur: 5,
  terminee: null,
  recolteFaite: false,
  semisFait: false,
  plantationFaite: true,
  espece,
  variete: null,
  planche: { surface: 10, largeur: 1, longueur: 10, nom: `Planche ${id}` },
})

const fiche = (e: EspecePrix) => e

describe('prixDeValorisation — ordre des sources', () => {
  const ventes = prixVentesMoyens([
    { especeId: 'Dahlia', unite: 'tige', quantite: 40, prixKg: 1.2 },
    { especeId: 'cm-tomate', unite: 'kg', quantite: 3, prixKg: 6 },
    { especeId: 'Carotte', unite: null, quantite: 4, prixKg: 3 },
  ])

  it('lot, puis fiche personnelle, puis ventes, puis catalogue et barème (kilos du catalogue)', () => {
    expect(prixDeValorisation({ acteurId: MOI, especeId: 'Dahlia', unite: 'tige', prixLot: 2, espece: fiche(dahlia) }, ventes))
      .toEqual({ prixUnitaire: 2, source: 'lot' })
    expect(prixDeValorisation({ acteurId: MOI, especeId: 'cm-tomate', unite: 'kg', espece: fiche(tomatePerso) }, ventes))
      .toEqual({ prixUnitaire: 8, source: 'fiche' })
    expect(prixDeValorisation({ acteurId: MOI, especeId: 'Carotte', unite: 'kg', espece: fiche(carotte) }, ventes))
      .toEqual({ prixUnitaire: 3, source: 'ventes' })
    expect(prixDeValorisation({ acteurId: MOI, especeId: 'Carotte', unite: 'kg', espece: fiche(carotte) }, new Map()))
      .toEqual({ prixUnitaire: 2, source: 'catalogue' })
    expect(prixDeValorisation({ acteurId: MOI, especeId: 'Radis', unite: 'kg', espece: fiche(radis) }, new Map()))
      .toEqual({ prixUnitaire: 4, source: 'reference' })
  })

  it('le prix au kilo du catalogue n’est jamais appliqué à des tiges', () => {
    expect(prixDeValorisation({ acteurId: MOI, especeId: 'Dahlia', unite: 'tige', espece: fiche(dahlia) }, new Map())).toBeNull()
    const auKilo = prixVentesMoyens([{ especeId: 'Dahlia', unite: 'kg', quantite: 2, prixKg: 12 }])
    expect(prixDeValorisation({ acteurId: MOI, especeId: 'Dahlia', unite: 'tige', espece: fiche(dahlia) }, auKilo)).toBeNull()
  })

  it('une entrée partagée par un autre compte n’est pas « votre fiche » : traitée comme le catalogue', () => {
    expect(partagee.userId).toBe(AUTRE)
    // Lot en tiges : ni fiche (pas la vôtre), ni catalogue (prix sans unité, kilos seulement).
    expect(prixDeValorisation({ acteurId: MOI, especeId: partagee.id, unite: 'tige', espece: fiche(partagee) }, new Map())).toBeNull()
    // Lot en kilos : le prix de l'espèce, comme celui du catalogue.
    expect(prixDeValorisation({ acteurId: MOI, especeId: partagee.id, unite: 'kg', espece: fiche(partagee) }, new Map()))
      .toEqual({ prixUnitaire: 5, source: 'catalogue' })
    // Pour son auteur, c'est sa fiche, dans son unité.
    expect(prixDeValorisation({ acteurId: AUTRE, especeId: partagee.id, unite: 'tige', espece: fiche(partagee) }, new Map()))
      .toEqual({ prixUnitaire: 5, source: 'fiche' })
  })

  it('espèce partagée par AUTRE en kilos, 10 kg à 4,50 €, sans vente : 45 € au prix de l’espèce, jamais « votre fiche »', () => {
    const partageeKg = { userId: AUTRE, prixKg: 4.5, uniteRendement: 'kg_m2' }
    const v = valoriserLot({ acteurId: MOI, especeId: 'cm-partagee-kg', unite: 'kg', quantite: 10, espece: partageeKg }, new Map())
    expect(v).toMatchObject({ source: 'catalogue', prixUnitaire: 4.5, valeur: 45 })
    expect(libelleMethodesValorisation([v])).not.toContain('votre fiche')
    // Le même lot en tiges : aucun prix.
    expect(valoriserLot({ acteurId: MOI, especeId: 'cm-partagee-kg', unite: 'tige', quantite: 10, espece: partageeKg }, new Map()).source)
      .toBe('aucune')
  })

  it('la fiche personnelle vaut dans SON unité seulement', () => {
    expect(prixDeValorisation({ acteurId: MOI, especeId: 'cm-pivoine', unite: 'tige', espece: fiche(pivoinePerso) }, new Map()))
      .toEqual({ prixUnitaire: 1.5, source: 'fiche' })
    // Fiche en tiges, lot en kilos : la fiche ne dit rien du kilo, et une
    // espèce personnelle n'a ni catalogue ni barème.
    expect(prixDeValorisation({ acteurId: MOI, especeId: 'cm-pivoine', unite: 'kg', espece: fiche(pivoinePerso) }, new Map())).toBeNull()
  })

  it('moyenne pondérée par les quantités, montant seul compté, nombre de ventes', () => {
    const moyennes = prixVentesMoyens([
      { especeId: 'Dahlia', unite: 'tige', quantite: 40, prixKg: 1.2 },
      { especeId: 'Dahlia', unite: 'tige', quantite: 10, prixKg: null, prixTotal: 22 },
      { especeId: 'Dahlia', unite: 'tige', quantite: 5, prixKg: null, prixTotal: null },
    ])
    // (48 + 22) / 50 = 1,40 ; la moyenne simple dirait 1,70. La vente sans
    // prix ni montant ne compte pas.
    expect(moyennes.get('Dahlia::tige')?.prix).toBeCloseTo(1.4, 10)
    expect(moyennes.get('Dahlia::tige')?.nombreVentes).toBe(2)
  })

  it('dit sa source, avec le nombre de ventes, et ne propose jamais le barème comme prix de vente', () => {
    const v = valoriserLot({ acteurId: MOI, especeId: 'Dahlia', unite: 'tige', quantite: 10, espece: fiche(dahlia) }, ventes)
    expect(v).toMatchObject({ source: 'ventes', valeur: 12, nombreVentes: 1 })
    expect(libelleCourtValorisation(v)).toBe('vente moyenne, 1 vente')
    expect(libelleMethodesValorisation([v, { source: 'aucune', nombreVentes: 0 }]))
      .toBe('au prix de vente moyen (90 jours, 1 vente) ; 1 lot sans prix')
    expect(prixProposeDeVente({ source: 'reference', prixUnitaire: 4 })).toBeNull()
    expect(prixProposeDeVente({ source: 'catalogue', prixUnitaire: 2 })).toBe(2)
    expect(prixProposeDeVente({ source: 'ventes', prixUnitaire: 1.3333 })).toBe(1.33)
    expect(prixProposeDeVente({ source: 'aucune', prixUnitaire: null })).toBeNull()
  })
})

type LotServi = {
  especeId: string
  statut: string
  quantite: number
  unite: string
  valorisation: { source: string; valeur: number | null; prixUnitaire: number | null; nombreVentes: number } | null
}

async function lotsServis(): Promise<LotServi[]> {
  const res = await LISTE_RECOLTES(new NextRequest('http://localhost/api/recoltes?pageSize=500'))
  expect(res.status).toBe(200)
  return ((await res.json()) as { data: LotServi[] }).data.filter((r) => r.statut === 'en_stock')
}

const somme = (lots: LotServi[]) => Math.round(lots.reduce((s, r) => s + (r.valorisation?.valeur ?? 0), 0) * 100) / 100

describe('Récoltes > Stock et Comptabilité > Stocks unifiés donnent la même valeur', () => {
  beforeEach(() => {
    prochainId = 1
    etat.requireAuthApi.mockResolvedValue(sessionDe(MOI))
    etat.recolte = { ...delegueMemoire(recoltes()), groupBy: vi.fn(async () => []) }
    etat.culture = delegueMemoire([culture(1, dahlia), culture(2, cosmosPerso)])
  })

  it('cas du ticket : 21 tiges de dahlia à 1,40 € (vente moyenne pondérée en tiges), 29,40 € des deux côtés', async () => {
    const dahlias = (await lotsServis()).filter((r) => r.especeId === 'Dahlia')
    expect(dahlias.map((r) => r.quantite)).toEqual([1, 1, 10, 9])
    expect(dahlias.every((r) => r.valorisation?.source === 'ventes' && r.valorisation.nombreVentes === 2)).toBe(true)
    expect(dahlias.map((r) => r.valorisation?.valeur)).toEqual([1.4, 1.4, 14, 12.6])

    const stocks = await computeStocksUnifies(MOI)
    const ligne = stocks.data.find((s) => s.id === 'recolte-potager-Dahlia::tige')
    expect(ligne).toMatchObject({ stock: 21, unite: 'tiges' })
    // L'ancienne règle donnait 21 × moyenne simple de 1,20, 2,20 et 12 (kg),
    // arrondie à 5,13 par `moyennePrix` : 107,73 € (constaté en rejouant ce
    // test contre la version 8f69dba de stocks-unifies.ts).
    expect(somme(dahlias)).toBe(29.4)
    expect(ligne?.valeur).toBe(29.4)
    expect(ligne?.valeurMethode).toBe('au prix de vente moyen (90 jours, 2 ventes)')
  })

  it('espèce personnelle en tiges, prix de fiche 1,50 €/tige, aucune vente : 6 tiges = 9,00 €', async () => {
    const pivoines = (await lotsServis()).filter((r) => r.especeId === 'cm-pivoine')
    expect(pivoines[0].valorisation).toMatchObject({ source: 'fiche', prixUnitaire: 1.5, valeur: 9, nombreVentes: 0 })
    const ligne = (await computeStocksUnifies(MOI)).data.find((s) => s.id === 'recolte-potager-cm-pivoine::tige')
    expect(ligne?.valeur).toBe(9)
    expect(ligne?.valeurMethode).toBe('au prix de votre fiche espèce')
  })

  it('kilos : fiche personnelle avant les ventes, ventes avant le catalogue, barème en dernier', async () => {
    const lots = await lotsServis()
    const de = (id: string) => lots.find((r) => r.especeId === id)?.valorisation
    expect(de('cm-tomate')).toMatchObject({ source: 'fiche', prixUnitaire: 8, valeur: 40, nombreVentes: 1 })
    expect(de('Carotte')).toMatchObject({ source: 'ventes', prixUnitaire: 3, valeur: 30 })
    expect(de('Radis')).toMatchObject({ source: 'reference', prixUnitaire: 4, valeur: 8 })

    const stocks = (await computeStocksUnifies(MOI)).data
    const valeur = (id: string) => stocks.find((s) => s.id === `recolte-potager-${id}::kg`)
    expect(valeur('cm-tomate')).toMatchObject({ valeur: 40, valeurMethode: 'au prix de votre fiche espèce' })
    expect(valeur('Carotte')).toMatchObject({ valeur: 30, valeurMethode: 'au prix de vente moyen (90 jours, 1 vente)' })
    expect(valeur('Radis')).toMatchObject({ valeur: 8, valeurMethode: 'au prix indicatif de référence' })
  })

  it('carte « Valeur estimée » : le total des lots de Récoltes plus les cultures en cours', async () => {
    const lots = await lotsServis()
    const stocks = await computeStocksUnifies(MOI)
    // 29,40 + 9 + 40 + 30 + 8 = 116,40 € de lots, + 140 € de dahlias projetés.
    expect(somme(lots)).toBe(116.4)
    expect(stocks.stats.valeurTotale).toBe(256.4)
  })

  it('culture en cours : même règle sur la quantité projetée, et « sans prix » dit comme pour les lots', async () => {
    const stocks = (await computeStocksUnifies(MOI)).data
    // 5 m² × 20 tiges/m² = 100 tiges au prix de vente moyen en tiges (1,40 €).
    expect(stocks.find((s) => s.id === 'culture-active-Dahlia')).toMatchObject({
      stock: 100,
      valeur: 140,
      valeurMethode: 'au prix de vente moyen (90 jours, 2 ventes)',
    })
    expect(stocks.find((s) => s.id === 'culture-active-cm-cosmos')).toMatchObject({
      valeur: null,
      valeurMethode: 'sans prix de vente en tiges',
    })
  })

  it('entrée partagée par un autre compte : lot en tiges sans prix, lot en kilos au prix de l’espèce, des deux côtés', async () => {
    etat.recolte = {
      ...delegueMemoire([lot(partagee, 12, 'tige'), lot(partagee, 3, 'kg')]),
      groupBy: vi.fn(async () => []),
    }
    const lots = await lotsServis()
    expect(lots.find((r) => r.unite === 'tige')?.valorisation).toMatchObject({ source: 'aucune', valeur: null })
    expect(lots.find((r) => r.unite === 'kg')?.valorisation).toMatchObject({ source: 'catalogue', prixUnitaire: 5, valeur: 15 })

    const stocks = (await computeStocksUnifies(MOI)).data
    expect(stocks.find((s) => s.id === 'recolte-potager-cm-partagee::tige')).toMatchObject({
      valeur: null,
      valeurMethode: 'sans prix de vente en tiges',
    })
    expect(stocks.find((s) => s.id === 'recolte-potager-cm-partagee::kg')).toMatchObject({
      valeur: 15,
      valeurMethode: 'au prix du catalogue',
    })
  })

  it('sans vente en tiges, aucun écran n’invente 30 €/tige : les dahlias ne sont pas valorisés', async () => {
    etat.recolte = {
      ...delegueMemoire(recoltes().filter((r) => !(r.especeId === 'Dahlia' && r.statut === 'vendu' && r.unite === 'tige'))),
      groupBy: vi.fn(async () => []),
    }
    const dahlias = (await lotsServis()).filter((r) => r.especeId === 'Dahlia')
    expect(dahlias.every((r) => r.valorisation?.source === 'aucune' && r.valorisation.valeur === null)).toBe(true)

    const ligne = (await computeStocksUnifies(MOI)).data.find((s) => s.id === 'recolte-potager-Dahlia::tige')
    expect(ligne?.valeur).toBeNull()
    expect(ligne?.valeurMethode).toBe('sans prix de vente en tiges')
  })
})
