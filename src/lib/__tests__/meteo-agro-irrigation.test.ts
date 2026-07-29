import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MeteoJournaliere, MeteoPrevision } from '@/lib/meteo'
import {
  adapterConseilSousAbri,
  genererRecommandationIrrigation,
} from '@/lib/meteo-agro'
import {
  cultureIrrigationDemarreeWhere,
  cultureIrrigationEstDemarree,
} from '@/lib/irrigation-eligibility'

function meteoJour(date: string, overrides: Partial<MeteoJournaliere> = {}): MeteoJournaliere {
  return {
    date,
    tempMin: 20,
    tempMax: 36,
    tempMoy: 28,
    precipitation: 0,
    et0: 5,
    radiation: 22,
    sunshine: 11,
    humidityMin: 30,
    humidityMax: 65,
    windSpeedMax: 15,
    ...overrides,
  }
}

function prevision(date: string, overrides: Partial<MeteoPrevision> = {}): MeteoPrevision {
  return {
    ...meteoJour(date, overrides),
    precipitationProba: 0,
    ...overrides,
  }
}

const historiqueSec = [
  '2026-07-21',
  '2026-07-22',
  '2026-07-23',
  '2026-07-24',
  '2026-07-25',
  '2026-07-26',
  '2026-07-27',
  '2026-07-28',
].map((date) => meteoJour(date))

const previsionsSeches = [
  '2026-07-29',
  '2026-07-30',
  '2026-07-31',
  '2026-08-01',
  '2026-08-02',
  '2026-08-03',
].map((date) => prevision(date))

describe('recommandation irrigation', () => {
  afterEach(() => vi.useRealTimers())

  it("retire l'urgence critique après un arrosage enregistré aujourd'hui", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-29T21:00:00.000Z'))

    const baseCulture = {
      id: 852,
      espece: 'Laitue',
      besoinEau: 4,
      dateSemis: new Date('2026-03-07T00:00:00.000Z'),
    }
    const planche = {
      nom: 'Planche 3',
      surface: 9.6,
      retentionEau: null,
      typeSol: null,
    }

    const sansArrosage = genererRecommandationIrrigation(
      historiqueSec,
      previsionsSeches,
      { ...baseCulture, derniereIrrigation: null },
      planche,
    )
    const avecArrosage = genererRecommandationIrrigation(
      historiqueSec,
      previsionsSeches,
      { ...baseCulture, derniereIrrigation: new Date('2026-07-29T20:22:00.000Z') },
      planche,
    )

    expect(sansArrosage.urgence).toBe('critique')
    expect(avecArrosage.urgence).toBe('faible')
    expect(avecArrosage.joursDepuisIrrigation).toBe(0)
    expect(avecArrosage.conseilQuantite).toBe(0)
    expect(avecArrosage.conseilMessage).toContain('Arrosage enregistré aujourd’hui')
  })

  it('nettoie entièrement les fragments hydriques extérieurs sous abri', () => {
    const conseil = adapterConseilSousAbri(
      'Irrigation urgente recommandée : 50.3 L/m². 9 jours sans pluie. Déficit hydrique de 38.7mm sur 7 jours.',
    )

    expect(conseil).toBe(
      'Sous abri — pas de pluie directe. Irrigation urgente recommandée : 50.3 L/m².',
    )
    expect(conseil).not.toContain('7mm sur 7 jours')
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
