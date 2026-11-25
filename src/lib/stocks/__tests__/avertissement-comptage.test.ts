import { describe, expect, it, vi } from 'vitest'
import {
  avertissementSaisieComptee,
  chargerDatesComptage,
  messageSaisieComptee,
  saisiePeutEtreComptee,
} from '@/lib/stocks/avertissement-comptage'

// Décision B du 2026-11-25 : une saisie datée du jour du dernier comptage de
// l'espèce, ou d'avant, est signalée (le comptage l'a peut-être déjà comptée).
describe('avertissement d’une saisie peut-être déjà comptée', () => {
  const comptage = new Date('2026-11-18T09:00:00.000Z')

  it('signale une saisie d’avant le comptage ou du même jour, jamais d’après', () => {
    expect(saisiePeutEtreComptee(new Date('2026-11-15T00:00:00.000Z'), comptage)).toBe(true)
    expect(saisiePeutEtreComptee(new Date('2026-11-18T00:00:00.000Z'), comptage)).toBe(true)
    expect(saisiePeutEtreComptee(new Date('2026-11-18T16:00:00.000Z'), comptage)).toBe(true)
    expect(saisiePeutEtreComptee(new Date('2026-11-19T00:00:00.000Z'), comptage)).toBe(false)
  })

  it('ne dit rien pour une espèce jamais comptée', () => {
    expect(saisiePeutEtreComptee(new Date('2026-11-15T00:00:00.000Z'), null)).toBe(false)
    expect(avertissementSaisieComptee('recolte', { date: new Date('2026-11-15T00:00:00.000Z'), nomEspece: 'Carotte' }, undefined)).toBeNull()
  })

  it('compare les jours civils de Paris', () => {
    // Comptage le 18/11 à 23 h 30 à Paris (22 h 30 UTC) ; sortie du 19/11 à 0 h 30 à Paris.
    const tardif = new Date('2026-11-18T22:30:00.000Z')
    expect(saisiePeutEtreComptee(new Date('2026-11-18T23:30:00.000Z'), tardif)).toBe(false)
    // Comptage le 19/11 à 0 h 30 à Paris (23 h 30 UTC le 18) : une récolte du 19/11 est du même jour.
    const minuit = new Date('2026-11-18T23:30:00.000Z')
    expect(saisiePeutEtreComptee(new Date('2026-11-19T00:00:00.000Z'), minuit)).toBe(true)
  })

  it('dit quoi faire, pour une récolte comme pour une sortie', () => {
    expect(messageSaisieComptee('recolte', 'Carotte', comptage)).toBe(
      'Le stock de Carotte a été compté le 18/11/2026 : ce comptage a peut-être déjà compté cette récolte. Si elle était déjà en stock à ce moment-là, recomptez le stock de l’espèce.',
    )
    expect(avertissementSaisieComptee('sortie', { date: new Date('2026-11-17T00:00:00.000Z'), nomEspece: 'Carotte' }, comptage)).toBe(
      'Le stock de Carotte a été compté le 18/11/2026 : ce comptage a peut-être déjà tenu compte de cette sortie. Si elle avait déjà eu lieu, recomptez le stock de l’espèce.',
    )
  })

  it('charge les comptages du compte en une requête, et aucune sans espèce', async () => {
    const findMany = vi.fn(async () => [{ especeId: 'Carotte', dateInventaire: comptage }])
    const comptages = await chargerDatesComptage({ userStockEspece: { findMany } } as never, 'u1', ['Carotte', 'Carotte', 'Radis'])
    expect(comptages).toEqual(new Map([['Carotte', comptage]]))
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: 'u1', especeId: { in: ['Carotte', 'Radis'] }, dateInventaire: { not: null } },
      select: { especeId: true, dateInventaire: true },
    })
    findMany.mockClear()
    expect((await chargerDatesComptage({ userStockEspece: { findMany } } as never, 'u1', [])).size).toBe(0)
    expect(findMany).not.toHaveBeenCalled()
  })
})
