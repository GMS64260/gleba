import { describe, expect, it } from 'vitest'
import { CHAMP_DATE_ETAPE, dateExecutionARecaler } from '../execution'

/**
 * Ticket cmsp66tdm : une étape marquée faite ne doit pas rester datée dans le
 * futur. Les dates de culture sont stockées avec une heure, donc la comparaison
 * doit se faire en journées civiles locales — sinon une date du jour stockée à
 * 00:00 se ferait recaler à tort.
 */
describe('dateExecutionARecaler', () => {
  const maintenant = new Date(2026, 7, 11, 14, 30) // 11/08/2026 14:30 local

  it('recale une date planifiée dans le futur sur le jour courant', () => {
    const recalage = dateExecutionARecaler(new Date(2026, 7, 15, 8, 0), maintenant)
    expect(recalage).toEqual(maintenant)
  })

  it('ne touche pas une date passée (le retard reste tracé tel quel)', () => {
    expect(dateExecutionARecaler(new Date(2026, 6, 31, 8, 0), maintenant)).toBeNull()
  })

  it('ne touche pas une date du jour, quelle que soit son heure', () => {
    expect(dateExecutionARecaler(new Date(2026, 7, 11, 0, 0), maintenant)).toBeNull()
    expect(dateExecutionARecaler(new Date(2026, 7, 11, 23, 59), maintenant)).toBeNull()
  })

  it('recale dès le lendemain civil, même à une heure antérieure', () => {
    expect(dateExecutionARecaler(new Date(2026, 7, 12, 0, 1), maintenant)).toEqual(maintenant)
  })

  it('date absente : la date d’exécution est le jour courant', () => {
    expect(dateExecutionARecaler(null, maintenant)).toEqual(maintenant)
    expect(dateExecutionARecaler(undefined, maintenant)).toEqual(maintenant)
  })

  it('chaque jalon porte son champ de date', () => {
    expect(CHAMP_DATE_ETAPE).toEqual({
      semisFait: 'dateSemis',
      plantationFaite: 'datePlantation',
      recolteFaite: 'dateRecolte',
    })
  })
})
