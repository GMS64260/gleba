/**
 * QA cmswu3260 (campagne du 2026-08-17) — « 12 annulés pluie » sous 0 mm de
 * prévision : la règle forfaitaire « 5 mm sur 3 jours couvrent 3 jours »
 * annulait des arrosages par 35 °C, et l'écran affichait la mauvaise cause.
 * Un test par comportement observé, avec les chiffres du signalement.
 */

import { describe, expect, it } from 'vitest'

import {
  decideIrrigationMeteo,
  joursCouvertsParPluie,
  jourCivilLocalISO,
  joursCivilsAvant,
  libelleIrrigationInutile,
} from '@/lib/irrigation-meteo-decision'

describe('decideIrrigationMeteo', () => {
  it("n'annule pas les 12 passages du ticket : 5,8 mm récents, ET0 ~5 mm/j, 0 mm prévu", () => {
    // Données réelles du compte démo au 17/08 : archive 0.2+4.1+1.5 mm,
    // prévision 0 mm, ET0 4-6 mm/j. L'ancienne règle annulait (5,8 >= 5).
    for (const joursAvant of [0, 1, 2, 3]) {
      const decision = decideIrrigationMeteo({
        pluiePrevueJour: 0,
        pluieRecente: 5.8,
        et0MoyenneJournaliere: 4.9,
        joursAvant,
      })
      expect(decision.probablementInutile).toBe(false)
      expect(decision.raisonInutile).toBeNull()
    }
  })

  it('annule sur pluie récente abondante, dans la limite des jours réellement couverts', () => {
    // 15 mm récents, ET0 4 mm/j → 15×0,8 / 4×0,8 = 3 jours couverts.
    const base = { pluiePrevueJour: 0, pluieRecente: 15, et0MoyenneJournaliere: 4 }
    expect(decideIrrigationMeteo({ ...base, joursAvant: 3 })).toMatchObject({
      probablementInutile: true,
      raisonInutile: 'pluie-recente',
    })
    expect(decideIrrigationMeteo({ ...base, joursAvant: 4 }).probablementInutile).toBe(false)
  })

  it("un cumul récent sous 8 mm n'annule jamais, quelle que soit l'ET0", () => {
    const decision = decideIrrigationMeteo({
      pluiePrevueJour: null,
      pluieRecente: 7.9,
      et0MoyenneJournaliere: 0.1,
      joursAvant: 0,
    })
    expect(decision.probablementInutile).toBe(false)
  })

  it('annule sur prévision du jour >= 5 mm, cause « pluie-prevue »', () => {
    const decision = decideIrrigationMeteo({
      pluiePrevueJour: 6.2,
      pluieRecente: 0,
      et0MoyenneJournaliere: 5,
      joursAvant: 2,
    })
    expect(decision.probablementInutile).toBe(true)
    expect(decision.raisonInutile).toBe('pluie-prevue')
  })

  it('sans ET0 (panne archive), repli prudent : 2 jours couverts au maximum', () => {
    expect(joursCouvertsParPluie(20, null)).toBe(2)
    expect(joursCouvertsParPluie(20, 0)).toBe(2)
    // Et jamais plus de 6 jours même sous ET0 très faible.
    expect(joursCouvertsParPluie(50, 1)).toBe(6)
  })
})

describe('libelleIrrigationInutile', () => {
  it("nomme la pluie récente quand c'est elle qui motive la décision (jamais « 0mm prévus »)", () => {
    const libelle = libelleIrrigationInutile({
      raisonInutile: 'pluie-recente',
      pluiePrevue: 0,
      pluieRecente: 5.8,
    })
    expect(libelle).toBe('5,8mm tombés ces 3 derniers jours — sol encore humide')
  })

  it("n'arrondit pas une prévision non nulle à « 0mm »", () => {
    const libelle = libelleIrrigationInutile({
      raisonInutile: 'pluie-prevue',
      pluiePrevue: 0.3,
      pluieRecente: 0,
    })
    expect(libelle).toBe('0,3mm de pluie prévue — irrigation probablement inutile')
  })

  it('reste explicite quand les grandeurs manquent (garde null du dashboard)', () => {
    expect(libelleIrrigationInutile({})).toBe(
      'Pluie récente ou prévue — irrigation probablement inutile'
    )
  })
})

describe('jours civils locaux', () => {
  it('formate le jour civil local (clé Open-Meteo en timezone=auto)', () => {
    expect(jourCivilLocalISO(new Date(2026, 7, 17, 23, 59))).toBe('2026-08-17')
    expect(jourCivilLocalISO(new Date(2026, 7, 18, 0, 0))).toBe('2026-08-18')
  })

  it("compte les jours d'écart en journées civiles, pas en tranches de 24 h", () => {
    const reference = new Date(2026, 7, 17, 23, 0)
    expect(joursCivilsAvant(new Date(2026, 7, 18, 1, 0), reference)).toBe(1)
    expect(joursCivilsAvant(new Date(2026, 7, 17, 1, 0), reference)).toBe(0)
    expect(joursCivilsAvant(new Date(2026, 7, 15, 12, 0), reference)).toBe(-2)
  })
})
