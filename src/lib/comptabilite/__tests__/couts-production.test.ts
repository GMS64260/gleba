/**
 * TICKET cmsog2niy — revenus Verger de computeCoutsProduction : la carte
 * atelier doit compter les VenteManuelle module='verger' saisies à la main
 * (ex. vente de bois de chauffage dans Transactions), en excluant les miroirs
 * auto (recolte_arbre, production_bois) déjà sommés via les sources brutes.
 *
 * TICKET cmsoez28o — `totaux.depensesComptables` expose la SSOT dépenses du
 * dashboard (getKpiCompta) pour que l'écran affiche l'écart avec les coûts
 * analytiques au lieu de prétendre à un alignement.
 *
 * La fonction est la SSOT partagée écran + assistant (get_marges_ateliers) :
 * on teste la fonction d'écran elle-même, pas des valeurs de compte démo.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cultureFindMany: vi.fn(),
  recolteFindMany: vi.fn(),
  factureFindMany: vi.fn(),
  interventionFindMany: vi.fn(),
  fertilisationFindMany: vi.fn(),
  depenseManuelleFindMany: vi.fn(),
  recolteArbreFindMany: vi.fn(),
  operationArbreFindMany: vi.fn(),
  productionBoisFindMany: vi.fn(),
  venteProduitFindMany: vi.fn(),
  abattageFindMany: vi.fn(),
  venteManuelleFindMany: vi.fn(),
  venteManuelleAggregate: vi.fn(),
  consommationAlimentFindMany: vi.fn(),
  soinAnimalFindMany: vi.fn(),
  userStockEspeceFindMany: vi.fn(),
  getKpiCompta: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    culture: { findMany: mocks.cultureFindMany },
    recolte: { findMany: mocks.recolteFindMany },
    facture: { findMany: mocks.factureFindMany },
    intervention: { findMany: mocks.interventionFindMany },
    fertilisation: { findMany: mocks.fertilisationFindMany },
    depenseManuelle: { findMany: mocks.depenseManuelleFindMany },
    recolteArbre: { findMany: mocks.recolteArbreFindMany },
    operationArbre: { findMany: mocks.operationArbreFindMany },
    productionBois: { findMany: mocks.productionBoisFindMany },
    venteProduit: { findMany: mocks.venteProduitFindMany },
    abattage: { findMany: mocks.abattageFindMany },
    venteManuelle: { findMany: mocks.venteManuelleFindMany, aggregate: mocks.venteManuelleAggregate },
    consommationAliment: { findMany: mocks.consommationAlimentFindMany },
    soinAnimal: { findMany: mocks.soinAnimalFindMany },
    // Rendements déclarés par la ferme : ils fixent l'unité des quantités et
    // des ratios coût/prix (2026-08-20).
    userStockEspece: { findMany: mocks.userStockEspeceFindMany },
  },
}))
vi.mock('@/lib/kpi', () => ({ getKpiCompta: mocks.getKpiCompta }))

import { computeCoutsProduction } from '../couts-production'
import { formatQuantiteParUnite } from '@/lib/recolte/quantites'

const YEAR = 2026
const arbre = { nom: 'Cerisier A', espece: 'Cerisier', especeId: 'cerisier' }

describe('computeCoutsProduction — revenus Verger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.cultureFindMany.mockResolvedValue([])
    mocks.recolteFindMany.mockResolvedValue([])
    mocks.factureFindMany.mockResolvedValue([])
    mocks.interventionFindMany.mockResolvedValue([])
    mocks.fertilisationFindMany.mockResolvedValue([])
    mocks.depenseManuelleFindMany.mockResolvedValue([])
    mocks.recolteArbreFindMany.mockResolvedValue([])
    mocks.operationArbreFindMany.mockResolvedValue([])
    mocks.productionBoisFindMany.mockResolvedValue([])
    mocks.venteProduitFindMany.mockResolvedValue([])
    mocks.abattageFindMany.mockResolvedValue([])
    mocks.venteManuelleFindMany.mockResolvedValue([])
    // aggregate est appelé pour le verger (module='verger') ET le potager
    // (module='potager') : on route sur le where pour rester explicite.
    mocks.venteManuelleAggregate.mockImplementation(async (args: { where?: { module?: string } }) => {
      if (args?.where?.module === 'verger') return { _sum: { montant: 450 } }
      return { _sum: { montant: 0 } }
    })
    mocks.consommationAlimentFindMany.mockResolvedValue([])
    mocks.soinAnimalFindMany.mockResolvedValue([])
    mocks.userStockEspeceFindMany.mockResolvedValue([])
    mocks.getKpiCompta.mockResolvedValue({ revenusYtd: 1234.56, depensesYtd: 999.99, revenusParModuleYtd: { parModule: { potager: 0 } } })
  })

  it('additionne les VenteManuelle module=verger saisies à la main aux récoltes et au bois', async () => {
    mocks.recolteArbreFindMany.mockResolvedValue([
      { statut: 'vendu', prixTotal: 100, prixKg: null, quantite: 10, arbre },
    ])
    mocks.productionBoisFindMany.mockResolvedValue([{ prixVente: 50 }])

    const res = await computeCoutsProduction('user-1', YEAR)

    // 100 (récolte vendue) + 50 (bois vendu) + 450 (vente manuelle verger)
    expect(res.parModule.verger.revenus).toBe(600)
  })

  it('exclut les miroirs auto recolte_arbre/production_bois de l’agrégat verger (pas de double comptage)', async () => {
    await computeCoutsProduction('user-1', YEAR)

    const callVerger = mocks.venteManuelleAggregate.mock.calls
      .map((c) => c[0])
      .find((args) => args?.where?.module === 'verger')
    expect(callVerger).toBeDefined()
    expect(callVerger.where.NOT).toEqual({
      auto: true,
      sourceType: { in: ['recolte_arbre', 'production_bois'] },
    })
    expect(callVerger.where.userId).toBe('user-1')
  })

  it('compte une vente manuelle verger même sans récolte ni bois', async () => {
    const res = await computeCoutsProduction('user-1', YEAR)

    expect(res.parModule.verger.revenus).toBe(450)
    expect(res.parModule.verger.marge).toBe(450)
  })

  it('expose les dépenses comptables SSOT du dashboard dans les totaux (cmsoez28o)', async () => {
    const res = await computeCoutsProduction('user-1', YEAR)

    expect(res.totaux.revenus).toBe(1234.56)
    expect(res.totaux.depensesComptables).toBe(999.99)
  })
})

/**
 * Une culture de fleurs coupées se compte en TIGES : le coût et le prix moyen
 * étaient nommés et affichés « par kilo » (2026-08-20).
 */
describe('computeCoutsProduction — unité des quantités et des ratios', () => {
  const planche = { id: 'p1', nom: 'P1', surface: 10, largeur: null, longueur: null }

  beforeEach(() => {
    vi.clearAllMocks()
    for (const mock of [
      mocks.cultureFindMany,
      mocks.recolteFindMany,
      mocks.factureFindMany,
      mocks.interventionFindMany,
      mocks.fertilisationFindMany,
      mocks.depenseManuelleFindMany,
      mocks.recolteArbreFindMany,
      mocks.operationArbreFindMany,
      mocks.productionBoisFindMany,
      mocks.venteProduitFindMany,
      mocks.abattageFindMany,
      mocks.venteManuelleFindMany,
      mocks.consommationAlimentFindMany,
      mocks.soinAnimalFindMany,
      mocks.userStockEspeceFindMany,
    ]) {
      mock.mockResolvedValue([])
    }
    mocks.venteManuelleAggregate.mockResolvedValue({ _sum: { montant: 0 } })
    mocks.getKpiCompta.mockResolvedValue({ revenusYtd: 0, depensesYtd: 0, revenusParModuleYtd: { parModule: { potager: 0 } } })
  })

  it('rend le coût et le prix moyen PAR TIGE quand la ferme compte en tiges', async () => {
    mocks.recolteFindMany.mockResolvedValue([{ cultureId: 1, quantite: 200, unite: 'tige', prixKg: 1.5, prixTotal: 300 }])
    mocks.cultureFindMany.mockResolvedValue([
      {
        id: 1,
        especeId: 'Dahlia',
        plancheId: 'p1',
        longueur: null,
        espece: { id: 'Dahlia', nom: 'Dahlia', rendement: 4, uniteRendement: 'kg_m2' },
        variete: null,
        planche,
        recoltes: [
          { quantite: 200, unite: 'tige', statut: 'vendu', prixKg: 1.5, prixTotal: 300 },
        ],
      },
    ])
    // L'espèce est OFFICIELLE (kg/m² au catalogue) : c'est la surcharge de la
    // ferme qui la fait compter en tiges.
    mocks.userStockEspeceFindMany.mockResolvedValue([
      { especeId: 'Dahlia', rendement: 40, uniteRendement: 'tiges_m2' },
    ])

    const res = await computeCoutsProduction('user-1', YEAR)
    const dahlia = res.parEspece.find((e) => e.especeId === 'Dahlia')

    expect(dahlia?.unite).toBe('tige')
    expect(dahlia?.production).toBe(200)
    expect(dahlia?.prixMoyenUnitaire).toBe(1.5) // 300 € / 200 tiges
    expect(res.totauxEspeces.productionParUnite).toEqual({ tige: 200 })
    // La part en kilos reste à zéro : aucune tige n'y entre.
    expect(res.totauxEspeces.production).toBe(0)
  })

  it('une récolte dans une AUTRE unité que celle de l’espèce n’est pas additionnée', async () => {
    mocks.cultureFindMany.mockResolvedValue([
      {
        id: 2,
        especeId: 'Dahlia',
        plancheId: 'p1',
        longueur: null,
        espece: { id: 'Dahlia', nom: 'Dahlia', rendement: 40, uniteRendement: 'tiges_m2' },
        variete: null,
        planche,
        recoltes: [
          { quantite: 100, unite: 'tige', statut: 'en_stock', prixKg: null, prixTotal: null },
          // Ligne héritée en kilos (l'espèce comptait autrement à l'époque).
          { quantite: 3, unite: null, statut: 'en_stock', prixKg: null, prixTotal: null },
        ],
      },
    ])

    const res = await computeCoutsProduction('user-1', YEAR)
    const dahlia = res.parEspece.find((e) => e.especeId === 'Dahlia')

    expect(dahlia?.unite).toBe('tige')
    expect(dahlia?.production).toBe(100) // et non 103
  })

  // QA cmvge3bqj — KPI « 14 241,5 kg » = 11 696,49 kg + 2 485 kg + 60 tiges
  // comptées comme 60 kg. Le total ferme ventile comme la carte Maraîchage.
  it('le total ferme somme les masses seules et présente les tiges à part', async () => {
    mocks.cultureFindMany.mockResolvedValue([
      {
        id: 10,
        especeId: 'Tomate',
        plancheId: 'p1',
        longueur: null,
        espece: { id: 'Tomate', nom: 'Tomate', rendement: 4, uniteRendement: 'kg_m2' },
        variete: null,
        planche,
        recoltes: [{ quantite: 11696.49, unite: 'kg', statut: 'en_stock', prixKg: null, prixTotal: null }],
      },
      {
        id: 1220,
        especeId: 'Dahlia',
        plancheId: 'p1',
        longueur: null,
        espece: { id: 'Dahlia', nom: 'Dahlia', rendement: 20, uniteRendement: 'tiges_m2' },
        variete: null,
        planche,
        recoltes: [{ quantite: 60, unite: 'tige', statut: 'en_stock', prixKg: null, prixTotal: null }],
      },
    ])
    mocks.recolteArbreFindMany.mockResolvedValue([
      { statut: 'en_stock', prixTotal: null, prixKg: null, quantite: 2485, arbre },
    ])

    const res = await computeCoutsProduction('user-1', YEAR)

    // Carte Maraîchage (inchangée) : 11 696,49 kg + 60 tiges.
    expect(res.parModule.potager.productionParUnite).toEqual({ kg: 11696.49, tige: 60 })
    // KPI et pied de tableau : 14 181,49 kg, et 60 tiges à part.
    expect(res.totaux.production).toBe(14181.49)
    expect(res.totaux.productionParUnite).toEqual({ kg: 14181.49, tige: 60 })
    expect(formatQuantiteParUnite(res.totaux.productionParUnite)).toBe('14\u202f181,49 kg + 60 tiges')
    // Ligne « Non affecté aux espèces » : le verger seul.
    expect(res.totaux.productionHorsEspecesParUnite).toEqual({ kg: 2485 })
  })
})
