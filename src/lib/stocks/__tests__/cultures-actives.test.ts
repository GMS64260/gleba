/**
 * BUG #8 (QA Camille 2026-05-15) — vérifie la logique d'agrégation des
 * cultures Maraîchage actives en items « stock en cours ». La requête
 * Prisma est testée ailleurs, ici on couvre la mise en forme et le calcul
 * de l'estimation kg = surface × rendement.
 */

import { describe, it, expect } from 'vitest'
import { computeStocksTotaux, type StockItem } from '../agregation'

// Reproduit la transformation faite côté route.ts pour pouvoir tester
// l'agrégation sans monter de mock Prisma complet.
interface CultureMockInput {
  especeId: string
  rendement: number | null
  plancheId: string | null
  plancheSurface: number | null
}

function aggregeCulturesActives(cultures: CultureMockInput[]): StockItem[] {
  interface Acc {
    nom: string
    nbCultures: number
    planches: Set<string>
    stockEstime: number
  }
  const map = new Map<string, Acc>()
  for (const c of cultures) {
    if (!c.especeId) continue
    const estime = (c.plancheSurface ?? 0) * (c.rendement ?? 0)
    const cur = map.get(c.especeId)
    if (cur) {
      cur.nbCultures += 1
      if (c.plancheId) cur.planches.add(c.plancheId)
      cur.stockEstime += estime
    } else {
      map.set(c.especeId, {
        nom: c.especeId,
        nbCultures: 1,
        planches: new Set(c.plancheId ? [c.plancheId] : []),
        stockEstime: estime,
      })
    }
  }
  const items: StockItem[] = []
  map.forEach((acc, especeId) => {
    const stockArrondi = Math.round(acc.stockEstime * 10) / 10
    items.push({
      id: `culture-active-${especeId}`,
      module: 'potager',
      categorie: 'Cultures en cours',
      nom: `${acc.nom} (${acc.nbCultures} culture${acc.nbCultures > 1 ? 's' : ''} · ${acc.planches.size} planche${acc.planches.size > 1 ? 's' : ''})`,
      stock: stockArrondi > 0 ? stockArrondi : acc.nbCultures,
      unite: stockArrondi > 0 ? 'kg estimés' : 'cultures',
      stockMin: null,
      alerteBas: false,
      valeur: null,
    })
  })
  return items
}

describe('agrégation cultures actives (BUG #8)', () => {
  it('vide si aucune culture active', () => {
    expect(aggregeCulturesActives([])).toEqual([])
  })

  it('matérialise une culture par espèce avec estimation kg', () => {
    const items = aggregeCulturesActives([
      { especeId: 'tomate', rendement: 5, plancheId: 'p1', plancheSurface: 10 },
    ])
    expect(items).toHaveLength(1)
    expect(items[0].module).toBe('potager')
    expect(items[0].categorie).toBe('Cultures en cours')
    expect(items[0].stock).toBe(50) // 10 m² × 5 kg/m²
    expect(items[0].unite).toBe('kg estimés')
  })

  it('agrège plusieurs cultures même espèce sur planches différentes', () => {
    const items = aggregeCulturesActives([
      { especeId: 'carotte', rendement: 4, plancheId: 'p1', plancheSurface: 10 },
      { especeId: 'carotte', rendement: 4, plancheId: 'p2', plancheSurface: 5 },
    ])
    expect(items).toHaveLength(1)
    expect(items[0].stock).toBe(60) // 40 + 20
    expect(items[0].nom).toContain('2 cultures')
    expect(items[0].nom).toContain('2 planches')
  })

  it('reproduit le scénario Camille (12 planches / 19 cultures Maraîchage)', () => {
    // 19 cultures réparties sur 12 planches (8 planches avec 1 culture, 4 avec ~2.75 cultures).
    const cultures: CultureMockInput[] = []
    const especes = ['tomate', 'courgette', 'salade', 'radis']
    for (let i = 0; i < 19; i++) {
      cultures.push({
        especeId: especes[i % 4],
        rendement: 3,
        plancheId: `p${i % 12}`,
        plancheSurface: 8,
      })
    }
    const items = aggregeCulturesActives(cultures)
    // 4 espèces distinctes → 4 items module='potager'
    expect(items).toHaveLength(4)
    const totaux = computeStocksTotaux(items)
    // M devient > 0 : Camille verrait au moins 4 dans le compteur M
    expect(totaux.itemsParModule.potager).toBe(4)
  })

  it("fallback aux unités 'cultures' si rendement inconnu (estime = 0)", () => {
    const items = aggregeCulturesActives([
      { especeId: 'oignon', rendement: null, plancheId: 'p1', plancheSurface: 10 },
    ])
    expect(items[0].stock).toBe(1) // 1 culture
    expect(items[0].unite).toBe('cultures')
  })

  it('ignore les cultures sans especeId', () => {
    const items = aggregeCulturesActives([
      { especeId: '', rendement: 5, plancheId: 'p1', plancheSurface: 10 },
    ])
    expect(items).toHaveLength(0)
  })
})
