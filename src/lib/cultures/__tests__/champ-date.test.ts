import { afterEach, describe, expect, it } from 'vitest'

import {
  datesApresChangementItp,
  datesCalculeesEnJoursSeuls,
  jourMoisAnnee,
  jourMoisCourt,
  midiLocalDuJour,
  valeurChampDate,
} from '../champ-date'

const tzInitial = process.env.TZ
const sousFuseau = (tz: string) => {
  process.env.TZ = tz
}
afterEach(() => {
  if (tzInitial === undefined) delete process.env.TZ
  else process.env.TZ = tzInitial
})

const FUSEAUX = ['Europe/Paris', 'UTC', 'America/Martinique', 'Pacific/Tahiti', 'Indian/Reunion', 'Pacific/Noumea']

describe('valeurChampDate', () => {
  it.each(FUSEAUX)('garde le jour saisi sous %s', (tz) => {
    sousFuseau(tz)
    // Jour stocké sans heure (minuit UTC), tel que l'API le renvoie.
    expect(valeurChampDate('2027-04-12T00:00:00.000Z')).toBe('2027-04-12')
    // Jour tapé dans le champ.
    expect(valeurChampDate('2027-04-12')).toBe('2027-04-12')
    // Date calculée à l'écran : minuit local.
    expect(valeurChampDate(new Date(2027, 3, 12))).toBe('2027-04-12')
  })

  it("témoin : la lecture locale d'un minuit UTC recule d'un jour à l'ouest", () => {
    sousFuseau('America/Martinique')
    // Ce que faisait `format(new Date(valeur), 'yyyy-MM-dd')` dans les pages.
    expect(new Date('2027-04-12T00:00:00.000Z').getDate()).toBe(11)
    expect(new Date('2027-04-12').getDate()).toBe(11)
  })

  it("témoin : une date calculée à l'écran part la veille à l'est", () => {
    sousFuseau('Indian/Reunion')
    // Minuit local sérialisé en instant : le 11 avril à 20:00 UTC.
    expect(new Date(2027, 3, 12).toISOString()).toBe('2027-04-11T20:00:00.000Z')
  })

  it('rend un champ vide sans date lisible', () => {
    expect(valeurChampDate(null)).toBe('')
    expect(valeurChampDate(undefined)).toBe('')
    expect(valeurChampDate('')).toBe('')
    expect(valeurChampDate('pas une date')).toBe('')
  })
})

describe('jourMoisCourt et jourMoisAnnee', () => {
  it.each(FUSEAUX)('affichent le jour saisi sous %s', (tz) => {
    sousFuseau(tz)
    expect(jourMoisCourt('2027-04-12T00:00:00.000Z')).toBe('12/04')
    expect(jourMoisAnnee('2027-04-12T00:00:00.000Z')).toBe('12/04/2027')
    expect(jourMoisCourt(new Date(2027, 0, 1))).toBe('01/01')
  })

  it('rendent null sans date', () => {
    expect(jourMoisCourt(null)).toBeNull()
    expect(jourMoisAnnee('')).toBeNull()
  })
})

describe('midiLocalDuJour', () => {
  it.each(FUSEAUX)('rend le jour saisi, lisible en local, sous %s', (tz) => {
    sousFuseau(tz)
    const midi = midiLocalDuJour('2027-04-12T00:00:00.000Z')!
    expect([midi.getFullYear(), midi.getMonth(), midi.getDate(), midi.getHours()]).toEqual([2027, 3, 12, 12])
    expect(midiLocalDuJour(null)).toBeNull()
  })
})

describe('datesCalculeesEnJoursSeuls', () => {
  it.each(FUSEAUX)('envoie le jour local des dates calculées sous %s', (tz) => {
    sousFuseau(tz)
    const corps = datesCalculeesEnJoursSeuls({
      especeId: 'Courge',
      dateSemis: new Date(2027, 3, 12),
      datePlantation: '2027-05-10',
      dateRecolte: '2027-08-01T00:00:00.000Z',
      finRecolte: null,
    })
    expect(corps).toEqual({
      especeId: 'Courge',
      dateSemis: '2027-04-12',
      datePlantation: '2027-05-10',
      dateRecolte: '2027-08-01T00:00:00.000Z',
      finRecolte: null,
    })
  })

  it("ne modifie pas l'objet reçu et laisse une date illisible au serveur", () => {
    const illisible = new Date(Number.NaN)
    const donnees = { dateSemis: new Date(2027, 3, 12), dateRecolte: illisible }
    const corps = datesCalculeesEnJoursSeuls(donnees)
    expect(donnees.dateSemis).toBeInstanceOf(Date)
    expect(corps.dateRecolte).toBe(illisible)
  })
})

describe('datesApresChangementItp', () => {
  const semis = new Date(2027, 2, 1)
  const plantation = new Date(2027, 3, 12)
  const recolte = new Date(2027, 6, 5)

  it("pose les dates du nouvel itinéraire, absentes comprises", () => {
    // Itinéraire en plant : pas de semis, celui de l'ancien itinéraire tombe.
    expect(datesApresChangementItp({ dateSemis: null, datePlantation: plantation, dateRecolte: recolte }, {})).toEqual({
      dateSemis: null,
      datePlantation: plantation,
      dateRecolte: recolte,
    })
  })

  it("garde la date d'une étape déjà faite", () => {
    const dates = datesApresChangementItp(
      { dateSemis: semis, datePlantation: plantation, dateRecolte: recolte },
      { semisFait: true, plantationFaite: false, recolteFaite: null }
    )
    expect(dates).toEqual({ datePlantation: plantation, dateRecolte: recolte })
    expect('dateSemis' in dates).toBe(false)
  })

  it("ne touche à rien quand l'itinéraire ne porte aucune date", () => {
    expect(datesApresChangementItp({ dateSemis: null, datePlantation: null }, {})).toEqual({})
    expect(datesApresChangementItp({}, { semisFait: true })).toEqual({})
  })
})
