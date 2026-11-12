import { describe, expect, it, vi } from 'vitest'
import { avertissementsDarLot, chargerAvertissementsDarLegumes, type TraitementDar } from '../dar'

const j = (jour: string) => new Date(`${jour}T00:00:00Z`)
const lot = { id: 1, cultureId: 10, plancheId: 'p1', parcelleId: 'parc1', date: j('2026-06-10') }
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

  it('compte un traitement posé sur la parcelle entière de la planche, pas celui d’un arbre ni d’une autre parcelle', () => {
    const surParcelle = { cultureId: null, plancheId: null, parcelleId: 'parc1', arbreId: null }
    expect(avertissementsDarLot(lot, [traitement(surParcelle)])).toHaveLength(1)
    expect(avertissementsDarLot(lot, [traitement({ ...surParcelle, arbreId: 4 })])).toEqual([])
    expect(avertissementsDarLot(lot, [traitement({ ...surParcelle, parcelleId: 'parc2' })])).toEqual([])
    expect(avertissementsDarLot({ ...lot, parcelleId: null }, [traitement({ ...surParcelle, parcelleId: null })])).toEqual([])
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
    expect(where.AND[0].OR).toEqual([
      { cultureId: { in: [10, 11] } },
      { cultureId: null, plancheId: { in: ['p1'] } },
      { cultureId: null, plancheId: null, arbreId: null, parcelleId: { in: ['parc1'] } },
    ])
    expect(resultat.get(1)).toHaveLength(1)
    expect(resultat.get(2)).toEqual([])
  })

  // Revue réglementaire du 2026-11-12 (C5). Arrêté du 4 mai 2017, art. 3, I :
  // sauf disposition contraire de l'AMM, pas d'utilisation dans les 3 jours
  // précédant la récolte. Avant, un délai absent valait 0 et ne disait rien.
  describe('délai inconnu, nul ou inférieur au défaut légal', () => {
    const veille = (t: Partial<TraitementDar>) => traitement({ date: j('2026-06-09'), produitPhyto: 'Fongicide X', ...t })

    it('DAR inconnu et récolte le lendemain : avertit avec le défaut légal de 3 jours', () => {
      const messages = avertissementsDarLot(lot, [veille({ dar: null })])
      expect(messages).toHaveLength(1)
      expect(messages[0]).toContain('DAR non renseigné pour Fongicide X')
      expect(messages[0]).toContain('arrêté du 4 mai 2017, art. 3, I')
      expect(messages[0]).toContain('avant le 12/06/2026')
    })

    it('DAR inconnu, défaut passé : rappelle de renseigner le délai de l’AMM, sans fausse alerte de délai', () => {
      const messages = avertissementsDarLot(lot, [traitement({ dar: null, date: j('2026-06-01') })])
      expect(messages).toHaveLength(1)
      expect(messages[0]).toContain('le délai par défaut de 3 jours est passé')
    })

    it('DAR inconnu au-delà de l’horizon de rappel : plus d’avertissement', () => {
      expect(avertissementsDarLot(lot, [traitement({ dar: null, date: j('2026-03-01') })])).toEqual([])
    })

    it('zéro saisi et récolte le lendemain : avertit, le zéro ne vaut que si l’AMM le prévoit', () => {
      const messages = avertissementsDarLot(lot, [veille({ dar: 0 })])
      expect(messages).toHaveLength(1)
      expect(messages[0]).toContain('Le délai saisi de 0 jour est inférieur au délai par défaut de 3 jours')
    })

    it('zéro du référentiel : même avertissement, le référentiel n’est pas l’AMM', () => {
      const messages = avertissementsDarLot(lot, [veille({ dar: null, produitPhytoRef: { darJours: 0, nomCommercial: 'Bt', classification: 'Biocontrôle' } })])
      expect(messages[0]).toContain('Le délai du référentiel de 0 jour')
    })

    it('zéro saisi, trois jours passés : rien à signaler', () => {
      expect(avertissementsDarLot(lot, [traitement({ dar: 0, date: j('2026-06-07') })])).toEqual([])
    })

    it('un geste sans produit, une substance de base ou un moyen mécanique sans délai : rien', () => {
      expect(avertissementsDarLot(lot, [veille({ dar: null, produitPhyto: null, geste: 'taille sanitaire' })])).toEqual([])
      expect(avertissementsDarLot(lot, [veille({ dar: null, produitPhytoRef: { darJours: null, nomCommercial: 'Purin d’ortie', classification: 'Substance de base / PNPP' } })])).toEqual([])
      expect(avertissementsDarLot(lot, [veille({ dar: null, produitPhytoRef: { darJours: null, nomCommercial: 'Filet', classification: 'Mécanique' } })])).toEqual([])
    })

    it('un délai saisi pour une substance de base reste appliqué', () => {
      const ref = { darJours: null, nomCommercial: 'Purin d’ortie', classification: 'Substance de base / PNPP' }
      expect(avertissementsDarLot(lot, [veille({ dar: 2, produitPhytoRef: ref })])).toHaveLength(1)
    })

    it('la lecture garde les traitements sans délai récents au lieu de les écarter', async () => {
      const findMany = vi.fn().mockResolvedValue([veille({ dar: null })])
      const resultat = await chargerAvertissementsDarLegumes({ intervention: { findMany } } as never, 'user-1', [lot])
      const or = findMany.mock.calls[0][0].where.OR
      expect(or.slice(0, 2)).toEqual([{ dar: { gt: 0 } }, { dar: null, produitPhytoRef: { darJours: { gt: 0 } } }])
      expect(or[2].date.gte.toISOString().slice(0, 10)).toBe('2026-04-10')
      expect(resultat.get(1)).toHaveLength(1)
    })
  })
})
