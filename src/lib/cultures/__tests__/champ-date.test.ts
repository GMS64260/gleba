import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  datesApresChangementItp,
  datesCalculeesEnJoursSeuls,
  jourMoisAnnee,
  jourMoisCourt,
  valeurChampDate,
} from '../champ-date'

// Dans le pool threads, changer process.env.TZ ne reconfigure pas Date.
// Chaque fuseau doit être fixé au démarrage d'un véritable processus Node.
interface ResultatsFuseau {
  valeurs: string[]
  joursUtcLocaux: number[]
  minuitLocalIso: string
  joursCourts: (string | null)[]
  jourComplet: string | null
  midi: number[]
  midiAbsent: null
  corps: Record<string, unknown>
}
const resultats = new Map<string, ResultatsFuseau>()
function sousFuseau(tz: string): ResultatsFuseau {
  const connu = resultats.get(tz)
  if (connu) return connu
  const script = `
    const {
      valeurChampDate, jourMoisCourt, jourMoisAnnee,
      midiLocalDuJour, datesCalculeesEnJoursSeuls,
    } = require(process.argv[1])
    const iso = '2027-04-12T00:00:00.000Z'
    const local = new Date(2027, 3, 12)
    const midi = midiLocalDuJour(iso)
    console.log(JSON.stringify({
      valeurs: [iso, '2027-04-12', local].map(valeurChampDate),
      joursUtcLocaux: [iso, '2027-04-12'].map(v => new Date(v).getDate()),
      minuitLocalIso: local.toISOString(),
      joursCourts: [jourMoisCourt(iso), jourMoisCourt(new Date(2027, 0, 1))],
      jourComplet: jourMoisAnnee(iso),
      midi: [midi.getFullYear(), midi.getMonth(), midi.getDate(), midi.getHours()],
      midiAbsent: midiLocalDuJour(null),
      corps: datesCalculeesEnJoursSeuls({
        especeId: 'Courge', dateSemis: local, datePlantation: '2027-05-10',
        dateRecolte: '2027-08-01T00:00:00.000Z', finRecolte: null,
      }),
    }))
  `
  const sortie = execFileSync(process.execPath, [
    '--import', 'tsx', '--eval', script,
    fileURLToPath(new URL('../champ-date.ts', import.meta.url)),
  ], { env: { ...process.env, TZ: tz }, encoding: 'utf8', timeout: 10000 })
  const resultat = JSON.parse(sortie) as ResultatsFuseau
  resultats.set(tz, resultat)
  return resultat
}

const FUSEAUX = ['Europe/Paris', 'UTC', 'America/Martinique', 'Pacific/Tahiti', 'Indian/Reunion', 'Pacific/Noumea']

describe('valeurChampDate', () => {
  it.each(FUSEAUX)('garde le jour saisi sous %s', (tz) => {
    // API (minuit UTC), jour saisi et Date calculée à minuit local.
    expect(sousFuseau(tz).valeurs).toEqual(['2027-04-12', '2027-04-12', '2027-04-12'])
  })

  it("témoin : la lecture locale d'un minuit UTC recule d'un jour à l'ouest", () => {
    // Ce que faisait la lecture locale de l'ISO dans les pages.
    expect(sousFuseau('America/Martinique').joursUtcLocaux).toEqual([11, 11])
  })

  it("témoin : une date calculée à l'écran part la veille à l'est", () => {
    // Minuit local sérialisé en instant : le 11 avril à 20:00 UTC.
    expect(sousFuseau('Indian/Reunion').minuitLocalIso).toBe('2027-04-11T20:00:00.000Z')
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
    const resultat = sousFuseau(tz)
    expect(resultat.joursCourts).toEqual(['12/04', '01/01'])
    expect(resultat.jourComplet).toBe('12/04/2027')
  })

  it('rendent null sans date', () => {
    expect(jourMoisCourt(null)).toBeNull()
    expect(jourMoisAnnee('')).toBeNull()
  })
})

describe('midiLocalDuJour', () => {
  it.each(FUSEAUX)('rend le jour saisi, lisible en local, sous %s', (tz) => {
    const resultat = sousFuseau(tz)
    expect(resultat.midi).toEqual([2027, 3, 12, 12])
    expect(resultat.midiAbsent).toBeNull()
  })
})

describe('datesCalculeesEnJoursSeuls', () => {
  it.each(FUSEAUX)('envoie le jour local des dates calculées sous %s', (tz) => {
    const corps = sousFuseau(tz).corps
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
