import { afterEach, describe, expect, it, vi } from 'vitest'
import { genererRecommandationIrrigation } from '@/lib/meteo-agro'
import type { MeteoBilan } from '@/lib/irrigation/meteo-bilan'
import {
  cultureIrrigationDemarreeWhere,
  cultureIrrigationEstDemarree,
} from '@/lib/irrigation-eligibility'

/** Été sec : 30 jours sans pluie, ET0 5 mm/j, jusqu'au 29/07 inclus. */
function meteoSeche(): MeteoBilan {
  const jour = (offset: number) => new Date(Date.UTC(2026, 6, 29 + offset, 12)).toISOString().slice(0, 10)
  return {
    historique: Array.from({ length: 30 }, (_, i) => ({ date: jour(i - 30), pluie: 0, et0: 5 })),
    aujourdhui: { date: jour(0), pluie: 0, et0: 5 },
    previsions: Array.from({ length: 7 }, (_, i) => ({ date: jour(i + 1), pluie: 0, et0: 5 })),
    decalageUtcS: 7200,
  }
}

describe('recommandation irrigation (moteur de bilan hydrique)', () => {
  afterEach(() => vi.useRealTimers())

  const culture = {
    id: 852,
    espece: 'Laitue',
    besoinEau: 4,
    vivace: false,
    dateSemis: new Date('2026-05-20T00:00:00.000Z'),
    datePlantation: new Date('2026-06-20T00:00:00.000Z'),
    semisFait: true,
    plantationFaite: true,
    dateRecolte: null,
    finRecolte: new Date('2026-08-20T00:00:00.000Z'),
  }
  const planche = { nom: 'Planche 3', surface: 9.6, retentionEau: null, typeSol: null, irrigation: 'Goutte-à-goutte' }

  it("retire l'urgence après un arrosage noté aujourd'hui", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-29T19:00:00.000Z'))

    const sansArrosage = genererRecommandationIrrigation(
      meteoSeche(),
      { ...culture, derniereIrrigation: null, arrosages: [] },
      planche,
    )
    const avecArrosage = genererRecommandationIrrigation(
      meteoSeche(),
      { ...culture, derniereIrrigation: new Date('2026-07-29T18:22:00.000Z'), arrosages: [{ date: new Date('2026-07-29T18:22:00.000Z'), calendaire: false, litresParM2: null }] },
      planche,
    )

    expect(sansArrosage.urgence).toBe('critique')
    expect(sansArrosage.conseilQuantite).toBeGreaterThan(0)
    expect(sansArrosage.conseilMessage).toMatch(/L pour la planche/)
    expect(avecArrosage.urgence).toBe('aucune')
    expect(avecArrosage.joursDepuisIrrigation).toBe(0)
    expect(avecArrosage.conseilQuantite).toBe(0)
  })

  // Revue du 2026-10-28 : la pluie du jour n'est qu'annoncée, comme dans le bilan.
  it("jours sans pluie : un orage annoncé pour ce soir ne remet pas le compteur à zéro", () => {
    const orage = meteoSeche()
    orage.aujourdhui = { ...orage.aujourdhui, pluie: 25 }
    const r = genererRecommandationIrrigation(orage, { ...culture, derniereIrrigation: null, arrosages: [] }, planche)
    expect(r.joursSansPluie).toBe(31)
    expect(genererRecommandationIrrigation(meteoSeche(), { ...culture, derniereIrrigation: null, arrosages: [] }, planche).joursSansPluie).toBe(31)
  })

  it('sous abri : ni pluie ni prochaine pluie, message dit une seule fois « Sous abri »', () => {
    const pluvieux = meteoSeche()
    pluvieux.previsions = pluvieux.previsions.map((j) => ({ ...j, pluie: 12 }))
    const r = genererRecommandationIrrigation(pluvieux, { ...culture, derniereIrrigation: null, arrosages: [] }, planche, true)
    expect(r.prochainePluie).toBeNull()
    expect(r.pluiePrevue48h).toBe(0)
    expect(r.conseilMessage.match(/Sous abri/g)).toHaveLength(1)
  })

  it('un plant encore en pépinière ne dessèche pas sa planche', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-29T10:00:00.000Z'))
    const r = genererRecommandationIrrigation(
      meteoSeche(),
      { ...culture, datePlantation: new Date('2026-08-05T00:00:00.000Z'), plantationFaite: false, derniereIrrigation: null, arrosages: [] },
      planche,
    )
    expect(r.urgence).toBe('aucune')
    expect(r.conseilMessage).toMatch(/Pas encore sur la planche/)
  })

  it("l'efficacité du système d'arrosage majore la dose", () => {
    const base = { ...culture, derniereIrrigation: null, arrosages: [] }
    const goutte = genererRecommandationIrrigation(meteoSeche(), base, planche)
    const aspersion = genererRecommandationIrrigation(meteoSeche(), base, { ...planche, irrigation: 'Aspersion' })
    expect(aspersion.conseilQuantite).toBeGreaterThan(goutte.conseilQuantite)
  })
})

describe('éligibilité aux alertes irrigation', () => {
  it('exclut une culture encore entièrement planifiée', () => {
    expect(cultureIrrigationEstDemarree({ semisFait: false, plantationFaite: false })).toBe(false)
    expect(cultureIrrigationEstDemarree({ semisFait: true, plantationFaite: false })).toBe(true)
    expect(cultureIrrigationEstDemarree({ semisFait: false, plantationFaite: true })).toBe(true)
    expect(cultureIrrigationDemarreeWhere).toEqual({
      OR: [{ semisFait: true }, { plantationFaite: true }],
    })
  })
})
