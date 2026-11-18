/**
 * Alertes météo, ensoleillement et prochaine pluie du conseiller
 * (revue du 2026-11-11) : une valeur absente ou pas encore publiée n'est ni
 * 0 °C, ni 0 mm, ni un jour gris.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { calculerEnsoleillement, genererAlertesMeteo, genererRecommandationIrrigation } from '@/lib/meteo-agro'
import type { MeteoJournaliere, MeteoPrevision } from '@/lib/meteo'
import type { MeteoBilan } from '@/lib/irrigation/meteo-bilan'

const jour = (date: string, plus: Partial<MeteoPrevision> = {}): MeteoPrevision => ({
  date, tempMin: 12, tempMax: 25, tempMoy: 18, precipitation: 0, precipitationProba: 0, et0: 5,
  radiation: 20, sunshine: 9, humidityMin: 40, humidityMax: 90, windSpeedMax: 8, ...plus,
})

afterEach(() => vi.useRealTimers())

describe('genererAlertesMeteo', () => {
  it('une température prévue absente ne déclenche ni gel ni canicule', () => {
    const sansTemperature = jour('2026-07-20', { tempMin: null as unknown as number, tempMax: undefined as unknown as number })
    expect(genererAlertesMeteo([sansTemperature])).toEqual([])
    // Une vraie gelée reste signalée.
    expect(genererAlertesMeteo([jour('2026-01-10', { tempMin: -4 })])[0]).toMatchObject({ type: 'gel', niveau: 'danger' })
  })

  it('sécheresse : les jours pas encore publiés par l’archive ne comptent pas pour 0 mm', () => {
    const semaineSeche: MeteoJournaliere[] = Array.from({ length: 7 }, (_, i) => jour(`2026-07-1${i + 1}`))
    // Cinq jours mesurés, secs et chauds, puis deux jours non publiés (un
    // orage a pu tomber) : le cumul de la semaine est inconnu, pas « 0 mm ».
    const incomplet: MeteoJournaliere[] = [
      ...semaineSeche.slice(0, 5).map((j) => ({ ...j, et0: 7 })),
      jour('2026-07-16', { precipitation: 0, et0: 0, precipitationInconnue: true }),
      jour('2026-07-17', { precipitation: 0, et0: 0, precipitationInconnue: true }),
    ]
    const previsions = [jour('2026-07-18'), jour('2026-07-19'), jour('2026-07-20')]
    expect(genererAlertesMeteo(previsions, semaineSeche).map((a) => a.type)).toEqual(['secheresse'])
    expect(genererAlertesMeteo(previsions, incomplet)).toEqual([])
  })

  it('sécheresse : l’alerte est datée du jour civil du serveur, pas du jour UTC', () => {
    vi.useFakeTimers()
    // 0 h 30 à Paris le 18 : le jour UTC est encore le 17.
    vi.setSystemTime(new Date('2026-07-17T22:30:00Z'))
    const attendu = new Date().toLocaleDateString('sv-SE')
    const semaineSeche: MeteoJournaliere[] = Array.from({ length: 7 }, (_, i) => jour(`2026-07-1${i + 1}`))
    const [alerte] = genererAlertesMeteo([jour('2026-07-18')], semaineSeche)
    expect(alerte).toMatchObject({ type: 'secheresse', date: attendu })
  })
})

describe('calculerEnsoleillement', () => {
  it('un jour dont l’ensoleillement n’est pas publié n’est pas un jour gris', () => {
    const r = calculerEnsoleillement([
      jour('2026-07-18', { sunshine: 10 }),
      jour('2026-07-19', { sunshine: 0, radiation: 0, ensoleillementInconnu: true }),
    ])
    expect(r).toMatchObject({ joursGris: 0, joursSoleil: 1, totalHeures: 10, moyenneJour: 10 })
  })
})

describe('prochaine pluie du conseiller', () => {
  const meteo = (): MeteoBilan => {
    const date = (offset: number) => new Date(Date.UTC(2026, 6, 29 + offset, 12)).toISOString().slice(0, 10)
    return {
      historique: Array.from({ length: 30 }, (_, i) => ({ date: date(i - 30), pluie: 0, et0: 5 })),
      aujourdhui: { date: date(0), pluie: 0, et0: 5 },
      previsions: Array.from({ length: 7 }, (_, i) => ({ date: date(i + 1), pluie: 0, et0: 5 })),
      decalageUtcS: 7200,
    }
  }
  const culture = {
    id: 1, espece: 'Laitue', besoinEau: 4, vivace: false,
    dateSemis: new Date('2026-05-20T00:00:00.000Z'), datePlantation: new Date('2026-06-20T00:00:00.000Z'),
    semisFait: true, plantationFaite: true, dateRecolte: null, finRecolte: new Date('2026-08-20T00:00:00.000Z'),
    derniereIrrigation: null, arrosages: [],
  }
  const planche = { nom: 'Planche 3', surface: 9.6, retentionEau: null, typeSol: null }

  it('même définition que le conseil d’irrigation : 3 mm, aujourd’hui compris', () => {
    const ceSoir = meteo()
    ceSoir.aujourdhui = { ...ceSoir.aujourdhui, pluie: 12 }
    expect(genererRecommandationIrrigation(ceSoir, culture, planche).prochainePluie).toBe('2026-07-29')

    const dansTroisJours = meteo()
    dansTroisJours.previsions[2] = { ...dansTroisJours.previsions[2], pluie: 3.5 }
    expect(genererRecommandationIrrigation(dansTroisJours, culture, planche).prochainePluie).toBe('2026-08-01')

    expect(genererRecommandationIrrigation(meteo(), culture, planche).prochainePluie).toBeNull()
  })
})
