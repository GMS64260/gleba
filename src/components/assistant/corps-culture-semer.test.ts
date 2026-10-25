/**
 * Ticket QA cmvnpkkhp (2026-10-25) — « Semer » > Planche existante
 * « v8-Marc-2510 plan2D (2) » > Laitue, planning manuel 2027, 3 rangs, 16 m,
 * 30 cm : le récapitulatif annonçait ~159 plants, le corps envoyé n'en
 * portait aucun.
 */
import { describe, expect, it } from 'vitest'
import { corpsCultureSemer, libelleDonneesManquantes, plantsSemer } from './corps-culture-semer'

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
      dateSemis: '2027-01-31T23:00:00.000Z',
      datePlantation: '2027-02-28T23:00:00.000Z',
      dateRecolte: '2027-04-14T22:00:00.000Z',
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
