import { describe, expect, it } from 'vitest'
import { debutSurPlanche, estEnPlace, fenetreRecolteOuverte, presenceSurPlanche, type CultureEnPlace } from '../en-place'

/**
 * QA cmvnur8eu (2026-10-25) — « qu'est-ce qui est planté sur B5 ? ». Le
 * prédicat réunit les règles de l'irrigation (`debutSurPlanche`,
 * `whereCulturesEnPlace`) et de l'occupation (`estVivaceEnPlace`) ; les cas
 * ci-dessous sont ceux que la revue a vu régresser avec une règle maison.
 */

// Dates de calendrier à minuit local, comme en base.
const jour = (a: number, m: number, j: number) => new Date(a, m - 1, j)

const base: CultureEnPlace = {
  annee: 2026,
  terminee: null,
  semisFait: false,
  plantationFaite: false,
  recolteFaite: false,
  dateSemis: null,
  datePlantation: null,
  dateRecolte: null,
  finRecolte: null,
  espece: { vivace: false },
}
const culture = (c: Partial<CultureEnPlace>): CultureEnPlace => ({ ...base, ...c })
const OCTOBRE = new Date(2026, 9, 25, 14, 17)

describe('presenceSurPlanche', () => {
  it('B5 : la courge en récolte est en place, le poivron planifié pour 2027 est à venir', () => {
    const courge = culture({
      semisFait: true, plantationFaite: true, recolteFaite: true,
      dateSemis: jour(2026, 4, 10), datePlantation: jour(2026, 5, 20), dateRecolte: jour(2026, 9, 1),
    })
    const poivron = culture({
      annee: 2027, dateSemis: jour(2027, 3, 1), datePlantation: jour(2027, 5, 15), dateRecolte: jour(2027, 8, 15),
    })
    expect(presenceSurPlanche(courge, OCTOBRE)).toEqual({ statut: 'en_place', etat: 'En récolte', depuis: '2026-05-20' })
    expect(presenceSurPlanche(poivron, OCTOBRE)).toEqual({ statut: 'a_venir', etat: 'Planifiée', debut: '2027-05-15' })
    expect(estEnPlace(poivron, OCTOBRE)).toBe(false)
  })

  it('annuelle de l’année précédente en janvier (poireau d’hiver, fin de récolte au 31/03) : en place', () => {
    const poireau = culture({
      annee: 2026, semisFait: true, plantationFaite: true,
      datePlantation: jour(2026, 7, 15), dateRecolte: jour(2026, 11, 15), finRecolte: jour(2027, 3, 31),
    })
    expect(presenceSurPlanche(poireau, new Date(2027, 0, 15))).toMatchObject({ statut: 'en_place', etat: 'Plantée' })
  })

  it('tomate semée dont la plantation prévue est passée et non cochée : réputée plantée', () => {
    const tomate = culture({
      semisFait: true, dateSemis: jour(2026, 3, 15), datePlantation: jour(2026, 5, 10),
      dateRecolte: jour(2026, 7, 15), finRecolte: jour(2026, 10, 15),
    })
    expect(presenceSurPlanche(tomate, new Date(2026, 5, 20))).toEqual({
      statut: 'en_place',
      etat: 'Semée',
      depuis: '2026-05-10',
      note: 'plantation prévue le 10/05/2026 non cochée, réputée faite',
    })
  })

  it('tomate semée en pépinière, plantation à venir : pas encore sur la planche', () => {
    const tomate = culture({ semisFait: true, dateSemis: jour(2026, 3, 15), datePlantation: jour(2026, 5, 10) })
    expect(presenceSurPlanche(tomate, new Date(2026, 3, 20))).toEqual({ statut: 'a_venir', etat: 'Semée', debut: '2026-05-10' })
  })

  it('vivace planifiée en 2023, jamais cochée : en place (estVivaceEnPlace)', () => {
    const asperge = culture({ annee: 2023, datePlantation: jour(2023, 4, 1), espece: { vivace: true } })
    expect(presenceSurPlanche(asperge, OCTOBRE)).toEqual({
      statut: 'en_place', etat: 'Planifiée', depuis: '2023-04-01', note: 'aucun jalon coché',
    })
  })

  it('laitue récoltée en juin, jamais close, en octobre : à vérifier, récolte terminée', () => {
    const laitue = culture({
      semisFait: true, plantationFaite: true, recolteFaite: true,
      datePlantation: jour(2026, 4, 1), dateRecolte: jour(2026, 6, 1), finRecolte: jour(2026, 6, 20),
    })
    expect(presenceSurPlanche(laitue, OCTOBRE)).toEqual({
      statut: 'a_verifier', etat: 'En récolte', raison: 'récolte terminée le 20/06/2026, non close',
    })
  })

  it('récolte commencée il y a plus de 60 jours sans fin renseignée : à vérifier', () => {
    const courgette = culture({ plantationFaite: true, recolteFaite: true, datePlantation: jour(2026, 5, 1), dateRecolte: jour(2026, 7, 1) })
    const p = presenceSurPlanche(courgette, OCTOBRE)
    expect(p.statut).toBe('a_verifier')
    expect(p).toMatchObject({ raison: 'récolte commencée le 01/07/2026, il y a plus de 60 jours, sans fin renseignée, non close' })
  })

  it('planifiée de l’année aux dates passées : à vérifier (aucun jalon coché), jamais « pas en place »', () => {
    const p = presenceSurPlanche(culture({ dateSemis: jour(2026, 3, 1) }), OCTOBRE)
    expect(p).toEqual({ statut: 'a_verifier', etat: 'Planifiée', raison: 'semis prévu le 01/03/2026 passé, aucun jalon coché' })
  })

  it('cases et dates contradictoires : à vérifier avec la raison', () => {
    const p = presenceSurPlanche(culture({ recolteFaite: true, datePlantation: jour(2026, 11, 20) }), OCTOBRE)
    expect(p).toEqual({ statut: 'a_verifier', etat: 'En récolte', raison: 'récolte cochée alors que plantation prévue le 20/11/2026' })
  })

  it('campagne plus ancienne que l’année précédente, jamais close : à vérifier', () => {
    const p = presenceSurPlanche(culture({ annee: 2024, plantationFaite: true }), OCTOBRE)
    expect(p).toEqual({ statut: 'a_verifier', etat: 'Plantée', raison: 'campagne 2024 jamais close' })
  })

  it('codes de clôture : « x » et « NS » closes, « v » à vérifier', () => {
    expect(presenceSurPlanche(culture({ terminee: 'x', recolteFaite: true }), OCTOBRE).statut).toBe('close')
    expect(presenceSurPlanche(culture({ terminee: 'NS' }), OCTOBRE).statut).toBe('close')
    expect(presenceSurPlanche(culture({ terminee: 'v', plantationFaite: true }), OCTOBRE)).toMatchObject({ statut: 'a_verifier' })
  })

  it('jalons cochés sans aucune date (import) : en place', () => {
    expect(presenceSurPlanche(culture({ plantationFaite: true }), OCTOBRE)).toEqual({ statut: 'en_place', etat: 'Plantée', depuis: null })
  })

  it('planifiée sans date : à venir pour l’année en cours ou suivante, à vérifier pour une année passée', () => {
    expect(presenceSurPlanche(culture({ annee: 2027 }), OCTOBRE)).toEqual({ statut: 'a_venir', etat: 'Planifiée', debut: null })
    expect(presenceSurPlanche(culture({ annee: 2025 }), OCTOBRE).statut).toBe('a_verifier')
  })
})

describe('fenetreRecolteOuverte (miroir de whereCulturesEnPlace)', () => {
  it('fin de récolte + 14 jours, début + 60 jours sans fin, ouverte sans date', () => {
    const maintenant = new Date(2026, 9, 25, 12)
    expect(fenetreRecolteOuverte({ dateRecolte: null, finRecolte: new Date(2026, 9, 12) }, maintenant)).toBe(true)
    expect(fenetreRecolteOuverte({ dateRecolte: null, finRecolte: new Date(2026, 9, 10) }, maintenant)).toBe(false)
    expect(fenetreRecolteOuverte({ dateRecolte: new Date(2026, 7, 27), finRecolte: null }, maintenant)).toBe(true)
    expect(fenetreRecolteOuverte({ dateRecolte: new Date(2026, 7, 20), finRecolte: null }, maintenant)).toBe(false)
    expect(fenetreRecolteOuverte({ dateRecolte: null, finRecolte: null }, maintenant)).toBe(true)
  })
})

describe('debutSurPlanche (déplacé depuis irrigation/bilan-culture.ts)', () => {
  it('pépinière, coché en avance, semis direct', () => {
    const pepiniere = { dateSemis: jour(2026, 4, 1), datePlantation: jour(2026, 10, 20), semisFait: true, plantationFaite: false }
    expect(debutSurPlanche(pepiniere, '2026-10-10')).toBe('2026-10-20')
    expect(debutSurPlanche({ ...pepiniere, plantationFaite: true }, '2026-10-10')).toBe('2026-10-10')
    expect(debutSurPlanche({ ...pepiniere, datePlantation: null }, '2026-10-10')).toBe('2026-04-01')
  })
})
