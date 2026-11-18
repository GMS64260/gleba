import { getISOWeek, getISOWeekYear } from 'date-fns'
import { describe, expect, it } from 'vitest'

import {
  dateDepuisSemaineAbsolue,
  dateSemaineChrono,
  referenceRecolte,
  semaineAbsolue,
} from '../assistant-helpers'

/**
 * Revue 2026-11-11. `semaineAbsolue` reporte une étape en ajoutant 52 semaines ;
 * convertie telle quelle en date (« S5 + 52 = S57 de 2026 »), elle tombait une
 * semaine trop tôt après une année ISO à 53 semaines (2020, 2026, 2032, 2037).
 */
describe('report d’une étape après une année ISO à 53 semaines', () => {
  it('garde la semaine demandée, l’année suivante', () => {
    for (const annee of [2020, 2026, 2032, 2037]) {
      const plantation = dateSemaineChrono(annee, 5, 40)
      expect(getISOWeekYear(plantation), `${annee}`).toBe(annee + 1)
      expect(getISOWeek(plantation), `${annee}`).toBe(5)
      expect(plantation.getDay()).toBe(1)
    }
  })

  it('S1 reportée : première semaine de l’année suivante, pas la S53', () => {
    const recolte = dateSemaineChrono(2026, 1, 36)
    expect(getISOWeekYear(recolte)).toBe(2027)
    expect(getISOWeek(recolte)).toBe(1)
  })

  it('cascade semis → plantation → récolte sur deux reports', () => {
    // Semis S45/2026, plantation S5/2027, récolte S2/2028.
    const recolte = dateSemaineChrono(2026, 2, referenceRecolte(5, 45))
    expect(getISOWeekYear(recolte)).toBe(2028)
    expect(getISOWeek(recolte)).toBe(2)
  })

  it('ne change rien sans report ni pour une année à 52 semaines', () => {
    expect(dateSemaineChrono(2026, 30, 10)).toEqual(dateSemaineChrono(2026, 30))
    const recolte = dateSemaineChrono(2027, 2, 40)
    expect(getISOWeekYear(recolte)).toBe(2028)
    expect(getISOWeek(recolte)).toBe(2)
  })

  it('dateDepuisSemaineAbsolue décode « n × 52 + semaine »', () => {
    expect(semaineAbsolue(5, 40)).toBe(57)
    expect(dateDepuisSemaineAbsolue(2026, 57)).toEqual(dateDepuisSemaineAbsolue(2027, 5))
    expect(dateDepuisSemaineAbsolue(2026, 52)).toEqual(dateSemaineChrono(2026, 52))
    expect(getISOWeek(dateDepuisSemaineAbsolue(2026, 104))).toBe(52)
    expect(getISOWeekYear(dateDepuisSemaineAbsolue(2026, 104))).toBe(2027)
  })
})
