import { describe, expect, it, vi } from 'vitest'
import { avertissementsDarLot, chargerAvertissementsDarLegumes, type TraitementDar } from '../dar'

const j = (jour: string) => new Date(`${jour}T00:00:00Z`)
const lot = { id: 1, cultureId: 10, plancheId: 'p1', date: j('2026-06-10') }
const traitement = (t: Partial<TraitementDar>): TraitementDar => ({
  cultureId: 10, plancheId: 'p1', date: j('2026-06-05'), dar: 7, produitPhyto: 'Bouillie', produitPhytoRef: null, ...t,
})

describe('délai avant récolte des légumes', () => {
  it('avertit quand la récolte tombe avant la fin du délai', () => {
    const messages = avertissementsDarLot(lot, [traitement({})])
    expect(messages).toHaveLength(1)
    expect(messages[0]).toContain('Bouillie')
    expect(messages[0]).toContain('7 jours')
    expect(messages[0]).toContain('12/06/2026')
  })

  it('laisse libre la récolte du jour « traitement + DAR » et celle d’avant le traitement', () => {
    expect(avertissementsDarLot({ ...lot, date: j('2026-06-12') }, [traitement({})])).toEqual([])
    expect(avertissementsDarLot({ ...lot, date: j('2026-06-04') }, [traitement({})])).toEqual([])
  })

  it('compte un traitement posé sur la planche sans culture, pas celui d’une autre culture de la planche', () => {
    expect(avertissementsDarLot(lot, [traitement({ cultureId: null })])).toHaveLength(1)
    expect(avertissementsDarLot(lot, [traitement({ cultureId: 11 })])).toEqual([])
    expect(avertissementsDarLot(lot, [traitement({ cultureId: null, plancheId: 'p2' })])).toEqual([])
    expect(avertissementsDarLot({ ...lot, plancheId: null }, [traitement({ cultureId: null, plancheId: null })])).toEqual([])
  })

  it('le délai saisi prime sur celui du référentiel, qui sert à défaut', () => {
    const ref = { darJours: 21, nomCommercial: 'Produit X' }
    expect(avertissementsDarLot(lot, [traitement({ dar: 3, produitPhytoRef: ref })])).toEqual([])
    const messages = avertissementsDarLot(lot, [traitement({ dar: null, produitPhytoRef: ref })])
    expect(messages[0]).toContain('Produit X')
    expect(messages[0]).toContain('21 jours')
  })

  it('un traitement horodaté se lit au jour civil', () => {
    // 5 juin à 23:30 heure locale : traitement du 5, libre le 12.
    const soir = new Date(2026, 5, 5, 23, 30)
    expect(avertissementsDarLot({ ...lot, date: j('2026-06-11') }, [traitement({ date: soir })])).toHaveLength(1)
    expect(avertissementsDarLot({ ...lot, date: j('2026-06-12') }, [traitement({ date: soir })])).toEqual([])
  })

  it('lit les traitements du seul compte, par culture ou par planche', async () => {
    const findMany = vi.fn().mockResolvedValue([traitement({})])
    const resultat = await chargerAvertissementsDarLegumes({ intervention: { findMany } } as never, 'user-1', [lot, { ...lot, id: 2, cultureId: 11, plancheId: null }])
    const where = findMany.mock.calls[0][0].where
    expect(where.userId).toBe('user-1')
    expect(where.fait).toBe(true)
    expect(where.AND[0].OR).toEqual([{ cultureId: { in: [10, 11] } }, { cultureId: null, plancheId: { in: ['p1'] } }])
    expect(resultat.get(1)).toHaveLength(1)
    expect(resultat.get(2)).toEqual([])
  })
})
