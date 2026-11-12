/**
 * Relecture du 2026-11-12 — dates déduites d'un itinéraire : l'assistant rend
 * les dates de la création unitaire et par lot, la récolte se recale depuis la
 * plantation déduite, et la semaine 53 est lue comme telle.
 */
import { getISOWeek, getISOWeekYear } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { calculerDatesCulture, dateSemaineChrono } from '../assistant-helpers'
import { datesDepuisItp, moisDepuisSemaine, recolteRecalee } from '../cultures/dates-itp'

const semaine = (d: Date | null) => (d ? `S${getISOWeek(d)}/${getISOWeekYear(d)}` : null)

describe('calculerDatesCulture — mêmes dates que la création unitaire et par lot', () => {
  it('semis S45/2026 : plantation S5 et récolte S20 de 2027, pas une semaine plus tôt', () => {
    const itp = { semaineSemis: 45, semainePlantation: 5, semaineRecolte: 20 }
    const dates = calculerDatesCulture(itp, 2026)
    expect(semaine(dates.datePlantation)).toBe('S5/2027')
    expect(semaine(dates.dateRecolte)).toBe('S20/2027')
    expect(dates).toEqual(datesDepuisItp(2026, itp))
  })

  it('rend les dates de datesDepuisItp pour toutes les années, 53 semaines comprises', () => {
    for (let annee = 2019; annee <= 2038; annee++) {
      for (const itp of [
        { semaineSemis: 45, semainePlantation: 5, semaineRecolte: 20 },
        { semaineSemis: 6, semainePlantation: 5, semaineRecolte: 1 },
        { semainePlantation: 42, semaineRecolte: 25 },
        { semainePlantation: 25, semaineRecolte: 26, dureeCulture: 1095 },
        { semaineImplantationDebut: 30, semaineRecolte: 38 },
      ]) {
        expect(calculerDatesCulture(itp, annee), `${annee} ${JSON.stringify(itp)}`).toEqual(
          datesDepuisItp(annee, itp)
        )
      }
    }
  })

  it('décalage qui déborde de l’année : chaque étape garde sa semaine', () => {
    // Semis S50 + 4 = S2 de 2027 ; récolte S10 + 4 = S14 de 2027.
    const dates = calculerDatesCulture({ semaineSemis: 50, semaineRecolte: 10 }, 2026, 4)
    expect(semaine(dates.dateSemis)).toBe('S2/2027')
    expect(semaine(dates.dateRecolte)).toBe('S14/2027')
  })

  it('décalage sans débordement : simple glissement de semaines', () => {
    const dates = calculerDatesCulture({ semaineSemis: 10, semainePlantation: 14, semaineRecolte: 28 }, 2027, 2)
    expect([dates.dateSemis, dates.datePlantation, dates.dateRecolte].map(semaine)).toEqual([
      'S12/2027',
      'S16/2027',
      'S30/2027',
    ])
  })
})

describe('recolteRecalee — règle unique des trois formulaires', () => {
  const TOMATE = { semaineSemis: 8, semainePlantation: 18, semaineRecolte: 28 }
  const jour = (d: Date | null) => (d ? `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` : null)

  it('semis seul d’un ITP à plantation : récolte comptée depuis la plantation déduite', () => {
    const recolte = recolteRecalee({
      dateSemis: new Date(2026, 1, 16),
      dateRecolte: new Date(2026, 5, 1),
      itp: TOMATE,
      debutChange: true,
    })
    expect(jour(recolte)).toBe('2026-7-6')
  })

  it('plantation saisie : elle ancre la récolte', () => {
    const recolte = recolteRecalee({
      dateSemis: new Date(2026, 1, 16),
      datePlantation: new Date(2026, 4, 4),
      dateRecolte: new Date(2026, 5, 1),
      itp: TOMATE,
      debutChange: true,
    })
    expect(jour(recolte)).toBe('2026-7-13')
  })

  it('ne touche à rien sans changement de début ni incohérence', () => {
    expect(
      recolteRecalee({ dateSemis: new Date(2026, 1, 16), dateRecolte: new Date(2026, 5, 1), itp: TOMATE, debutChange: false })
    ).toBeNull()
  })

  it('une récolte saisie à la main n’est réécrite que si elle précède le début', () => {
    const base = { dateSemis: new Date(2026, 1, 16), itp: TOMATE, debutChange: true, recolteSaisie: true }
    expect(recolteRecalee({ ...base, dateRecolte: new Date(2026, 5, 1) })).toBeNull()
    expect(jour(recolteRecalee({ ...base, dateRecolte: new Date(2026, 0, 5) }))).toBe('2026-7-6')
  })

  it('rien sans début, ni quand la récolte est déjà la bonne', () => {
    expect(recolteRecalee({ dateRecolte: new Date(2026, 5, 1), itp: TOMATE, debutChange: true })).toBeNull()
    expect(
      recolteRecalee({ dateSemis: new Date(2026, 1, 16), dateRecolte: new Date(2026, 6, 6), itp: TOMATE, debutChange: true })
    ).toBeNull()
  })
})

describe('semaine 53', () => {
  it('moisDepuisSemaine : décembre, même quand l’année n’a que 52 semaines', () => {
    expect(moisDepuisSemaine(2027, 53)).toBe(12)
    expect(moisDepuisSemaine(2026, 53)).toBe(12)
    expect(moisDepuisSemaine(2026, 1)).toBe(1)
  })

  it('dateSemaineChrono : la S53 de 2026 commence le 28/12/2026', () => {
    const d = dateSemaineChrono(2026, 53)
    expect(semaine(d)).toBe('S53/2026')
    expect(d.getDate()).toBe(28)
  })

  it('dateSemaineChrono : une S1 reportée reste la S1 de l’année suivante', () => {
    expect(semaine(dateSemaineChrono(2026, 1, 36))).toBe('S1/2027')
    expect(semaine(dateSemaineChrono(2026, 45, 57))).toBe('S45/2027')
  })
})
