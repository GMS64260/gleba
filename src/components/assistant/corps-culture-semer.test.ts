/**
 * Ticket QA cmvnpkkhp (2026-10-25) — « Semer » > Planche existante
 * « v8-Marc-2510 plan2D (2) » > Laitue, planning manuel 2027, 3 rangs, 16 m,
 * 30 cm : le récapitulatif annonçait ~159 plants, le corps envoyé n'en
 * portait aucun.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { corpsCultureSemer, jourEnvoye, libelleDonneesManquantes, plantsSemer } from './corps-culture-semer'

// Le navigateur du ticket est à Paris : les objets Date de l'étape planning y
// sont des minuits locaux.
const tzAvant = process.env.TZ
beforeAll(() => {
  process.env.TZ = 'Europe/Paris'
})
afterAll(() => {
  if (tzAvant === undefined) delete process.env.TZ
  else process.env.TZ = tzAvant
})

// Dates saisies à Paris (01/02, 01/03, 15/04/2027), objets Date de l'étape planning.
const etatTicket = {
  planche: { id: 'cmvnpk0plan2d0002demo0001', nom: 'v8-Marc-2510 plan2D (2)', largeur: 0.8, longueur: 16 },
  espece: { id: 'Laitue' },
  itp: null,
  variete: null,
  culture: {
    especeId: 'Laitue',
    annee: 2027,
    dateSemis: new Date('2027-01-31T23:00:00.000Z'),
    datePlantation: new Date('2027-02-28T23:00:00.000Z'),
    dateRecolte: new Date('2027-04-14T22:00:00.000Z'),
    nbRangs: 3,
    longueur: 16,
    espacement: 30,
  },
}

describe('corpsCultureSemer', () => {
  it('le corps du ticket porte quantite = 159, le nombre affiché', () => {
    const corps = corpsCultureSemer(etatTicket, { plancheId: 'cmvnpk0plan2d0002demo0001', aIrriguer: true })

    expect(corps).toEqual({
      especeId: 'Laitue',
      varieteId: null,
      itpId: null,
      plancheId: 'cmvnpk0plan2d0002demo0001',
      annee: 2027,
      // Ticket cmvnulry1 : le jour saisi, et non l'instant UTC de la veille au
      // soir (« 2027-01-31T23:00:00.000Z »), que le registre lisait au 31/01.
      dateSemis: '2027-02-01',
      datePlantation: '2027-03-01',
      dateRecolte: '2027-04-15',
      nbRangs: 3,
      longueur: 16,
      espacement: 30,
      quantite: 159,
      aIrriguer: true,
      semisFait: false,
      plantationFaite: false,
      recolteFaite: false,
    })
    expect(plantsSemer(etatTicket).quantite).toBe(corps.quantite)
  })

  it('longueur de culture vide : celle de la planche est envoyée et sert au calcul', () => {
    const etat = { ...etatTicket, culture: { ...etatTicket.culture, longueur: undefined } }
    expect(corpsCultureSemer(etat, { plancheId: null, aIrriguer: false })).toMatchObject({ longueur: 16, quantite: 159 })
  })

  it("sans rangs ni espacement : rien d'inventé, les données manquantes sont nommées", () => {
    const etat = { ...etatTicket, culture: { ...etatTicket.culture, nbRangs: undefined, espacement: undefined } }
    const plants = plantsSemer(etat)

    expect(plants).toMatchObject({ nbRangs: null, espacement: null, quantite: null, manquants: ['rangs', 'espacement'] })
    expect(libelleDonneesManquantes(plants.manquants)).toBe('rangs et espacement')
    expect(corpsCultureSemer(etat, { plancheId: null, aIrriguer: false }).quantite).toBeNull()
  })

  it('nomme une seule donnée manquante, ou les trois', () => {
    expect(libelleDonneesManquantes(['longueur'])).toBe('longueur')
    expect(libelleDonneesManquantes(['longueur', 'rangs', 'espacement'])).toBe('longueur, rangs et espacement')
  })
})

describe('dates envoyées par « Semer » (ticket cmvnulry1)', () => {
  it("le jour d'un minuit local, quel que soit le fuseau du navigateur", () => {
    for (const fuseau of ['Europe/Paris', 'UTC', 'America/Martinique', 'Pacific/Tahiti', 'Pacific/Noumea', 'Pacific/Wallis']) {
      process.env.TZ = fuseau
      // Étape planning : date calculée depuis l'ITP ou saisie, minuit local.
      expect(jourEnvoye(new Date(2027, 3, 12)), fuseau).toBe('2027-04-12')
    }
    process.env.TZ = 'Europe/Paris'
  })

  it('un jour déjà au format du formulaire passe tel quel ; absent ou illisible : null', () => {
    expect(jourEnvoye('2027-04-12')).toBe('2027-04-12')
    expect(jourEnvoye(null)).toBeNull()
    expect(jourEnvoye(undefined)).toBeNull()
    expect(jourEnvoye('')).toBeNull()
    expect(jourEnvoye(new Date(Number.NaN))).toBeNull()
  })

  it("l'étape Dates : saisie en minuit local, vérification d'occupation au même jour que l'envoi", () => {
    const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
    const etape = fs.readFileSync(path.join(racine, 'src/components/assistant/AssistantStepDates.tsx'), 'utf-8')
    expect(etape).not.toContain('T12:00:00.000Z')
    expect(etape).not.toMatch(/[\w)]\.toISOString\(\)/)
    expect(etape).toMatch(/new Date\(annee, mois - 1, jour\)/)
    for (const champ of ['dateSemis', 'datePlantation', 'dateRecolte']) {
      expect(etape).toContain(`${champ}: enJour(culture.${champ}),`)
    }
    expect(etape).toMatch(/const enJour = \(d: Date \| string \| null \| undefined\) => jourEnvoye\(d\) \?\? ""/)
  })
})
