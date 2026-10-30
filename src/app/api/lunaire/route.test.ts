/**
 * `/api/lunaire` au jour et au fuseau du LECTEUR (revue du 2026-10-28, témoin
 * lune-fuseau) : le serveur calculait au sien (Europe/Paris), un lecteur des
 * Antilles ou du Pacifique recevait le jour de Paris.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: async () => ({ error: null, session: { user: { id: 'lecteur-synthetique' } } }) }))
import { GET } from './route'
import { instantPhaseVraie, phaseVraieDuJour } from '@/lib/lunar'

afterEach(() => vi.useRealTimers())

const appel = async (requete: string) => {
  const res = await GET(new NextRequest(`https://exemple.invalid/api/lunaire?${requete}`))
  return { statut: res.status, json: await res.json() }
}

describe('GET /api/lunaire au fuseau du lecteur', () => {
  it('le widget d’un utilisateur en Guadeloupe doit porter sa date locale, pas le lendemain de Paris', async () => {
    vi.useFakeTimers()
    // Paris : 13/08 04:00 ; UTC : 13/08 02:00 ; Guadeloupe : encore le 12/08
    // à 22:00, jour de la nouvelle lune (17:37 UTC, 13:37 à Pointe-à-Pitre).
    vi.setSystemTime(new Date('2026-08-13T02:00:00Z'))
    expect(phaseVraieDuJour(new Date('2026-08-12T16:00:00Z')).phaseIndex).toBe(0)
    const { statut, json } = await appel('today=1&jour=2026-08-12&tz=America%2FGuadeloupe')
    expect(statut).toBe(200)
    expect(json.jour.date).toBe('2026-08-12')
    expect(json.jour.phaseIndex).toBe(0)
    expect(json.jour.phase).toBe('Nouvelle Lune')
  })

  it('sans jour transmis, le jour vient du fuseau du lecteur', async () => {
    vi.useFakeTimers()
    // Pleine lune du 24/11/2026 à 14:53 UTC : 25/11 à 01:53 à Nouméa.
    vi.setSystemTime(new Date('2026-11-24T14:00:00Z'))
    const { json } = await appel('today=1&tz=Pacific%2FNoumea')
    expect(json.jour.date).toBe('2026-11-25')
    expect(json.jour.phaseIndex).toBe(4)
  })

  it('le mois place chaque événement dans les jours du lecteur, au même instant astronomique', async () => {
    const pleineLune = new Date(instantPhaseVraie(332.5)).toISOString()
    const { json: noumea } = await appel('year=2026&month=11&tz=Pacific%2FNoumea')
    const { json: paris } = await appel('year=2026&month=11&tz=Europe%2FParis')
    const jourDe = (cal: { calendrier: { jours: { date: string; phaseIndex: number; instantEvenement: string | null }[] } }, d: string) =>
      cal.calendrier.jours.find((j) => j.date === d)!
    expect(jourDe(paris, '2026-11-24').phaseIndex).toBe(4)
    expect(jourDe(paris, '2026-11-25').phaseIndex).not.toBe(4)
    expect(jourDe(noumea, '2026-11-24').phaseIndex).not.toBe(4)
    expect(jourDe(noumea, '2026-11-25').phaseIndex).toBe(4)
    // Un seul instant, deux jours civils.
    expect(jourDe(noumea, '2026-11-25').instantEvenement).toBe(pleineLune)
    expect(jourDe(paris, '2026-11-24').instantEvenement).toBe(pleineLune)
    expect(noumea.calendrier.jours).toHaveLength(30)
  })

  it('un fuseau ou un jour illisible est refusé', async () => {
    expect((await appel('today=1&tz=Mars%2FOlympus')).statut).toBe(400)
    expect((await appel('today=1&jour=12%2F08%2F2026&tz=Europe%2FParis')).statut).toBe(400)
    expect((await appel('year=2026&month=11&tz=pas-un-fuseau')).statut).toBe(400)
  })
})
