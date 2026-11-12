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

/**
 * Revue du 2026-11-11 — deux cultures qui se partagent la planche dans sa
 * longueur (une moitié chacune) ne sont pas côte à côte : leurs largeurs ne
 * s'additionnent pas. Avant, la longueur des cultures en place était ignorée et
 * la seconde demi-planche était refusée pour « largeur insuffisante ».
 */
describe('evaluerOccupationPlanche : cultures bout à bout', () => {
  const planche20 = { largeur: 0.8, longueur: 20 }
  const cycle = { dateSemis: d('2027-04-01'), dateRecolte: d('2027-06-01'), finRecolte: d('2027-06-20') }
  const enPlace = (longueur: number | null, nbRangs = 3) => ({
    nbRangs,
    longueur,
    itp: { espacementRangs: 30 },
    ...cycle,
  })
  const nouvelle = { espacementRangs: 30, nbRangs: 3, debut: d('2027-04-10'), fin: d('2027-06-10') }

  it("accepte la seconde moitié d'une planche dont la première est occupée", () => {
    const verdict = evaluerOccupationPlanche({
      planche: planche20,
      culturesEnPlace: [enPlace(10)],
      ...nouvelle,
      longueur: 10,
    })
    expect(verdict).toMatchObject({ verifie: true, possible: true, largeurOccupee: 0 })
  })

  it('garde le refus quand les longueurs cumulées dépassent la planche', () => {
    const verdict = evaluerOccupationPlanche({
      planche: planche20,
      culturesEnPlace: [enPlace(10)],
      ...nouvelle,
      longueur: 12,
    })
    expect(verdict).toMatchObject({ verifie: true, possible: false })
    if (verdict.verifie) expect(verdict.largeurOccupee).toBeCloseTo(0.6)
  })

  it('garde le refus face à une culture sur toute la longueur, ou de longueur inconnue', () => {
    for (const longueur of [20, null]) {
      const verdict = evaluerOccupationPlanche({
        planche: planche20,
        culturesEnPlace: [enPlace(longueur)],
        ...nouvelle,
        longueur: 10,
      })
      expect(verdict).toMatchObject({ verifie: true, possible: false })
    }
  })

  it("garde le refus quand la nouvelle culture n'a pas de longueur (toute la planche)", () => {
    const verdict = evaluerOccupationPlanche({
      planche: planche20,
      culturesEnPlace: [enPlace(10)],
      ...nouvelle,
      longueur: null,
    })
    expect(verdict).toMatchObject({ verifie: true, possible: false })
  })

  it('compte toujours la culture en place sur toute la longueur, à côté des bouts à bout', () => {
    // Un rang de poireaux sur 20 m (10 cm), puis deux demi-planches de 2 rangs
    // (30 cm) : 0,8 − 0,1 − 0,2 de marge = 0,5 m pour la bande partagée.
    const base = {
      planche: planche20,
      culturesEnPlace: [enPlace(20, 1), enPlace(10, 2)],
      espacementRangs: 30,
      longueur: 10,
      debut: nouvelle.debut,
      fin: nouvelle.fin,
    }
    const deuxRangs = evaluerOccupationPlanche({ ...base, nbRangs: 2 })
    expect(deuxRangs).toMatchObject({ verifie: true, possible: true })
    if (deuxRangs.verifie) expect(deuxRangs.largeurOccupee).toBeCloseTo(0.1)
    const troisRangs = evaluerOccupationPlanche({ ...base, nbRangs: 3 })
    expect(troisRangs).toMatchObject({ verifie: true, possible: false })
  })

  it("une culture sur toute la longueur compte chaque partielle en place", () => {
    // Relecture du 2026-11-12 — deux demi-planches de 2 rangs (30 cm chacune)
    // peuvent être côte à côte sur les mêmes 10 m : leur position n'est pas
    // enregistrée. Face à une culture pleine longueur, elles s'additionnent.
    const verdict = evaluerOccupationPlanche({
      planche: planche20,
      culturesEnPlace: [enPlace(10, 2), enPlace(10, 2)],
      espacementRangs: 30,
      nbRangs: 2,
      longueur: 20,
      debut: nouvelle.debut,
      fin: nouvelle.fin,
    })
    expect(verdict).toMatchObject({ verifie: true, possible: false })
    if (verdict.verifie) expect(verdict.largeurOccupee).toBeCloseTo(0.6)
  })

  it("n'assouplit rien quand la longueur de la planche n'est pas renseignée", () => {
    const verdict = evaluerOccupationPlanche({
      planche: { largeur: 0.8, longueur: null },
      culturesEnPlace: [enPlace(1)],
      ...nouvelle,
      longueur: 1,
    })
    expect(verdict).toMatchObject({ verifie: true, possible: false })
  })

  it('ne propose que des ajustements que le même verdict accepte', () => {
    const base = {
      planche: planche20,
      culturesEnPlace: [enPlace(20, 1), enPlace(10, 2)],
      espacementRangs: 30,
      longueur: 10,
      debut: nouvelle.debut,
      fin: nouvelle.fin,
    }
    const refus = evaluerOccupationPlanche({ ...base, nbRangs: 4 })
    expect(refus).toMatchObject({ verifie: true, possible: false })
    if (!refus.verifie) return
    const rangs = refus.ajustements.find((a) => a.reduireRangs)?.reduireRangs
    expect(rangs).toBe(2)
    expect(evaluerOccupationPlanche({ ...base, nbRangs: rangs })).toMatchObject({ possible: true })
  })
})
