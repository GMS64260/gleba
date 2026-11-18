/**
 * QA cmv2r1v63 (2026-10-10) — « La correction proposée à 2 rangs reste
 * refusée ». Le verdict d'occupation est une seule règle pour la création et
 * pour l'aperçu de l'assistant : la suggestion qu'il propose doit être acceptée
 * par ce même verdict.
 */
import { describe, expect, it } from 'vitest'

import { AVERTISSEMENT_ESPACEMENT_INCONNU, avertissementsChevauchementPlanche, evaluerModificationOccupation, evaluerOccupationPlanche } from '../planche-validation'

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

describe('avertissementsChevauchementPlanche', () => {
  const culture = { ...radis, id: 42, espece: { id: 'Radis', vivace: false } }

  it('signale la période recouverte même si la largeur disponible suffit', () => {
    expect(avertissementsChevauchementPlanche({ culturesEnPlace: [culture], ...periode })).toEqual([
      'Chevauchement détecté sur la planche : Radis #42 (10/10–26/12) recouvre la période demandée.',
    ])
  })

  it('ne déclare pas de chevauchement sans dates connues ou hors période', () => {
    expect(avertissementsChevauchementPlanche({ culturesEnPlace: [culture], debut: null, fin: periode.fin })).toEqual([])
    expect(avertissementsChevauchementPlanche({ culturesEnPlace: [{ id: 43 }], ...periode })).toEqual([])
    expect(avertissementsChevauchementPlanche({ culturesEnPlace: [culture], debut: d('2027-01-01'), fin: d('2027-02-01') })).toEqual([])
  })

  it('signale une vivace en place après sa fenêtre de récolte', () => {
    expect(avertissementsChevauchementPlanche({
      culturesEnPlace: [{ ...culture, espece: { id: 'Fraisier', vivace: true } }],
      debut: d('2027-01-01'), fin: d('2027-02-01'),
    })).toEqual(['Chevauchement détecté sur la planche : Fraisier #42 (en place depuis le 10/10, vivace) recouvre la période demandée.'])
  })
})


describe('ADV35 — occupation sans fin de la nouvelle vivace', () => {
  const annuelle = { id: 90, espece: { id: 'Tomate', vivace: false }, nbRangs: 3,
    datePlantation: d('2027-06-01'), dateRecolte: d('2027-08-01'), itp: { espacementRangs: 40 } }
  const base = { planche: { largeur: 1.2, longueur: 10 }, culturesEnPlace: [annuelle],
    espacementRangs: 40, nbRangs: 3, longueur: 10, debut: d('2026-01-01'), fin: d('2026-02-01') }

  it.each([d('2026-02-01'), null])('refuse la vivace face à une réservation l’année suivante (fin %s)', (fin) => {
    expect(evaluerOccupationPlanche({ ...base, vivace: true, fin })).toMatchObject({ possible: false, largeurOccupee: 0.8 })
  })

  it('garde le verdict des annuelles quand leur cycle se finit avant la réservation', () => {
    expect(evaluerOccupationPlanche(base)).toMatchObject({ possible: true, largeurOccupee: 0 })
  })

  it('ne compte pas une annuelle libérant la planche avant la mise en place de la vivace', () => {
    expect(evaluerOccupationPlanche({ ...base, vivace: true, debut: d('2027-08-01'), fin: null }))
      .toMatchObject({ possible: true, largeurOccupee: 0 })
  })

  it('compte une autre vivace future et reste prudent sans dates exploitables', () => {
    for (const culture of [
      { ...annuelle, espece: { id: 'Fraisier', vivace: true } },
      { ...annuelle, datePlantation: null, dateRecolte: null },
    ]) {
      expect(evaluerOccupationPlanche({ ...base, culturesEnPlace: [culture], vivace: true }))
        .toMatchObject({ possible: false, largeurOccupee: 0.8 })
    }
    expect(evaluerOccupationPlanche({ ...base, debut: null, vivace: true }))
      .toMatchObject({ possible: false, largeurOccupee: 0.8 })
  })

  it.each([d('2026-02-01'), null])('avertit du chevauchement futur même sans dépassement (fin %s)', (fin) => {
    expect(avertissementsChevauchementPlanche({ ...base, vivace: true, fin })).toEqual([
      'Chevauchement détecté sur la planche : Tomate #90 (01/06–01/08) recouvre la période demandée.',
    ])
    expect(avertissementsChevauchementPlanche({ ...base, fin })).toEqual([])
  })
})


describe('ADV76 — pic d’occupation des voisines', () => {
  const annuelle = (debut: string, fin: string, nbRangs = 2) => ({
    nbRangs, itp: { espacementRangs: 40 }, datePlantation: d(debut), dateRecolte: d(fin),
  })
  const base = { planche: { largeur: 1.2, longueur: 10 }, espacementRangs: 40, nbRangs: 2,
    longueur: 10, debut: d('2027-01-01'), fin: d('2029-01-01') }

  it.each([false, true])('accepte les annuelles successives, vivace=%s', (vivace) => {
    expect(evaluerOccupationPlanche({ ...base, vivace, culturesEnPlace: [
      annuelle('2027-06-01', '2027-08-01'), annuelle('2028-06-01', '2028-08-01'),
    ] })).toMatchObject({ verifie: true, possible: true, largeurOccupee: 0.4 })
  })

  it('ne cumule pas les cultures dont départ et arrivée coïncident', () => {
    expect(evaluerOccupationPlanche({ ...base, vivace: true, culturesEnPlace: [
      annuelle('2027-06-01', '2027-08-01'), annuelle('2027-08-01', '2027-10-01'),
    ] })).toMatchObject({ possible: true, largeurOccupee: 0.4 })
  })

  it('juge le verdict et les ajustements sur la tranche la plus chargée', () => {
    const args = { ...base, vivace: true, culturesEnPlace: [
      annuelle('2027-06-01', '2027-08-01'),
      annuelle('2028-06-01', '2028-08-01'), annuelle('2028-07-01', '2028-09-01'),
    ] }
    const verdict = evaluerOccupationPlanche(args)
    expect(verdict).toMatchObject({ possible: false, largeurOccupee: 0.8,
      ajustements: expect.arrayContaining([expect.objectContaining({ reduireRangs: 1 })]) })
    expect(evaluerOccupationPlanche({ ...args, nbRangs: 1 })).toMatchObject({ possible: true })
  })

  it('conserve une voisine indatable dans toutes les tranches', () => {
    expect(evaluerOccupationPlanche({ ...base, vivace: true, culturesEnPlace: [
      { nbRangs: 2, itp: { espacementRangs: 40 } },
      annuelle('2028-06-01', '2028-08-01'),
    ] })).toMatchObject({ possible: false, largeurOccupee: 0.8 })
  })

  it('compte la vivace voisine après sa récolte même face aux annuelles successives', () => {
    expect(evaluerOccupationPlanche({ ...base, vivace: true, culturesEnPlace: [
      { ...annuelle('2027-01-01', '2027-02-01'), espece: { vivace: true } },
      annuelle('2028-06-01', '2028-08-01'),
    ] })).toMatchObject({ possible: false, largeurOccupee: 0.8 })
  })

  it('reste prudent pour une nouvelle annuelle sans fin connue', () => {
    expect(evaluerOccupationPlanche({ ...base, fin: null, culturesEnPlace: [
      annuelle('2027-06-01', '2027-08-01'), annuelle('2028-06-01', '2028-08-01'),
    ] })).toMatchObject({ possible: false, largeurOccupee: 0.8 })
  })
})


describe('compatibilité PR73 — modification et tranches en dépassement', () => {
  const planche = { largeur: 1.2, longueur: 10 }
  const etat = (date: string) => ({ espacementRangs: 40, nbRangs: 3, longueur: 10,
    debut: d(date), fin: null, vivace: true })
  const autresCultures = ['2027-03-01', '2027-10-01'].map((date) => ({
    datePlantation: d(date), dateRecolte: d(`${date.slice(0, 8)}28`),
    nbRangs: 2, itp: { espacementRangs: 40 },
  }))

  it('refuse un nouveau dépassement avec une autre voisine, même à pic égal', () => {
    expect(evaluerModificationOccupation({ planche, autresCultures,
      avant: etat('2027-09-01'), apres: etat('2027-01-01') })).toMatchObject({ possible: false })
  })

  it('tolère un dépassement hérité qui n’ajoute aucune voisine', () => {
    expect(evaluerModificationOccupation({ planche, autresCultures,
      avant: etat('2027-09-01'), apres: etat('2027-08-01') })).toBeNull()
  })

  it('refuse le dépassement d’une culture arrivant sur la planche', () => {
    expect(evaluerModificationOccupation({ planche, autresCultures,
      avant: null, apres: etat('2027-09-01') })).toMatchObject({ possible: false })
  })
})
