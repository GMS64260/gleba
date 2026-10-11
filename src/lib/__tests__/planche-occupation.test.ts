/**
 * QA cmv2r1v63 (2026-10-10) — « La correction proposée à 2 rangs reste
 * refusée ». Le verdict d'occupation est une seule règle pour la création et
 * pour l'aperçu de l'assistant : la suggestion qu'il propose doit être acceptée
 * par ce même verdict.
 */
import { describe, expect, it } from 'vitest'

import { AVERTISSEMENT_ESPACEMENT_INCONNU, evaluerOccupationPlanche } from '../planche-validation'

const d = (iso: string) => new Date(`${iso}T00:00:00`)

// Planche « Marc-v7-QA2-1010 » : 0,90 m de large, 24 m de long.
const planche = { largeur: 0.9, longueur: 24 }
// En place sur la période : un radis (ITP sans espacement entre rangs) et un
// zinnia d'un rang.
const radis = {
  nbRangs: 4,
  itp: { espacementRangs: null },
  dateSemis: d('2026-10-10'),
  dateRecolte: d('2026-11-20'),
  finRecolte: d('2026-12-26'),
}
const zinnia1Rang = {
  nbRangs: 1,
  itp: { espacementRangs: 35 },
  dateSemis: d('2026-10-10'),
  datePlantation: d('2026-11-21'),
  dateRecolte: d('2027-01-16'),
  finRecolte: d('2027-04-24'),
}
const periode = { debut: d('2026-10-10'), fin: d('2027-04-24') }

describe('evaluerOccupationPlanche', () => {
  it('refuse 3 rangs et propose 2 rangs, que le même verdict accepte', () => {
    const base = {
      planche,
      culturesEnPlace: [radis, zinnia1Rang],
      espacementRangs: 35,
      longueur: 24,
      ...periode,
    }
    const refus = evaluerOccupationPlanche({ ...base, nbRangs: 3 })
    expect(refus.verifie).toBe(true)
    if (!refus.verifie) return
    expect(refus.possible).toBe(false)
    expect(refus.largeurNecessaire).toBeCloseTo(0.7)
    expect(refus.largeurDisponible).toBeCloseTo(0.5)
    expect(refus.ajustements[0]).toMatchObject({ reduireRangs: 2, message: 'Réduire à 2 rangs (au lieu de 3)' })

    const correction = evaluerOccupationPlanche({ ...base, nbRangs: refus.ajustements[0].reduireRangs })
    expect(correction).toMatchObject({ verifie: true, possible: true })
  })

  it("ne compte pas une culture dont le cycle ne chevauche pas la période", () => {
    const tomate2027 = {
      nbRangs: 2,
      itp: { espacementRangs: 94 },
      dateSemis: d('2027-03-01'),
      datePlantation: d('2027-05-10'),
      dateRecolte: d('2027-07-19'),
    }
    const verdict = evaluerOccupationPlanche({
      planche,
      culturesEnPlace: [tomate2027],
      espacementRangs: 35,
      nbRangs: 2,
      longueur: 24,
      debut: d('2026-10-10'),
      fin: d('2027-01-16'),
    })
    expect(verdict).toMatchObject({ verifie: true, possible: true, largeurOccupee: 0 })
  })

  it("compte par prudence une culture sans dates, et sans espacement connu à 10 cm", () => {
    const verdict = evaluerOccupationPlanche({
      planche,
      culturesEnPlace: [{ nbRangs: 4, itp: null }],
      espacementRangs: 35,
      nbRangs: 2,
      longueur: null,
      ...periode,
    })
    expect(verdict.verifie && verdict.largeurOccupee).toBeCloseTo(0.1)
  })

  it("ne vérifie rien sans espacement entre rangs dans l'ITP de la nouvelle culture", () => {
    const verdict = evaluerOccupationPlanche({
      planche,
      culturesEnPlace: [radis, zinnia1Rang],
      espacementRangs: null,
      nbRangs: 12,
      longueur: 24,
      ...periode,
    })
    expect(verdict).toEqual({
      verifie: false,
      possible: true,
      avertissement: AVERTISSEMENT_ESPACEMENT_INCONNU,
      longueurExcedentaire: null,
      largeurPlanche: 0.9,
    })
  })

  it("dit une longueur excédentaire même sans espacement connu", () => {
    const verdict = evaluerOccupationPlanche({
      planche,
      culturesEnPlace: [],
      espacementRangs: null,
      nbRangs: 2,
      longueur: 30,
      ...periode,
    })
    expect(verdict.verifie === false && verdict.longueurExcedentaire).toBe(
      'Longueur de culture (30m) supérieure à la longueur de la planche (24m)'
    )
  })
})
