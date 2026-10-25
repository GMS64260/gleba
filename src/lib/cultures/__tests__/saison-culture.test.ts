import { describe, expect, it } from 'vitest'
import { alerteSaisonCulture, etapeImplantation, TOLERANCE_SEMAINES_IMPLANTATION } from '../saison-culture'

/**
 * Constat du 2026-10-25 sur un compte réel : deux cultures créées le même
 * après-midi depuis « Nouvelle culture ».
 *  - B, aubergine sous abri (INRAE-MESCLUN-0020, implantation S16–S18) : le
 *    formulaire, voyant la fenêtre de l'année passée, a décalé tout le cycle à
 *    partir du jour même ; plantation au 25 octobre (S43), sans un mot.
 *  - A, ail de printemps sec sous abri (INRAE-MESCLUN-0011, implantation
 *    S3–S7) : plantation au 12 janvier (S3), dans la fenêtre.
 */
const AUBERGINE_0020 = {
  semaineSemis: null,
  semainePlantation: 16,
  semaineImplantationDebut: 16,
  semaineImplantationFin: 18,
  implantation: 'Plantation',
}
const AIL_0011 = {
  semaineSemis: null,
  semainePlantation: 3,
  semaineImplantationDebut: 3,
  semaineImplantationFin: 7,
  implantation: 'Plantation',
}

describe('alerteSaisonCulture', () => {
  it('B : aubergine plantée S43 pour une fenêtre S16–S18, alerte qui le dit', () => {
    const alerte = alerteSaisonCulture({
      itp: AUBERGINE_0020,
      dateSemis: null,
      // Stockée à minuit UTC, comme toute date « jour seul ».
      datePlantation: new Date('2026-10-25T00:00:00.000Z'),
    })
    expect(alerte).not.toBeNull()
    expect(alerte?.etape).toBe('plantation')
    expect(alerte?.champ).toBe('datePlantation')
    expect(alerte?.semaine).toBe(43)
    expect(alerte?.message).toBe("Hors fenêtre de l'itinéraire (plantation S16–S18) : plantation prévue S43.")
  })

  it('B : même verdict sur un minuit local (dates calculées par les écrans)', () => {
    expect(
      alerteSaisonCulture({ itp: AUBERGINE_0020, datePlantation: new Date(2026, 9, 25) })?.semaine
    ).toBe(43)
  })

  it('A : ail planté S3 dans une fenêtre S3–S7, aucune alerte', () => {
    expect(
      alerteSaisonCulture({ itp: AIL_0011, dateSemis: null, datePlantation: '2026-01-12' })
    ).toBeNull()
  })

  it(`tolère ${TOLERANCE_SEMAINES_IMPLANTATION} semaines autour de la fenêtre, pas une de plus`, () => {
    // S18 + 3 = S21 (lundi 18 mai 2026) : toléré ; S22 (25 mai) : alerte.
    expect(alerteSaisonCulture({ itp: AUBERGINE_0020, datePlantation: '2026-05-18' })).toBeNull()
    expect(alerteSaisonCulture({ itp: AUBERGINE_0020, datePlantation: '2026-05-25' })?.ecartSemaines).toBe(4)
    // S16 − 3 = S13 (23 mars) toléré ; S12 (16 mars) : alerte.
    expect(alerteSaisonCulture({ itp: AUBERGINE_0020, datePlantation: '2026-03-23' })).toBeNull()
    expect(alerteSaisonCulture({ itp: AUBERGINE_0020, datePlantation: '2026-03-16' })).not.toBeNull()
  })

  it('itinéraire en plantation : un semis en pépinière ne se compare pas à la fenêtre', () => {
    expect(alerteSaisonCulture({ itp: AUBERGINE_0020, dateSemis: '2026-02-02', datePlantation: null })).toBeNull()
  })

  it('semis direct : la date de semis est jugée sur la fenêtre de semis', () => {
    const couvert = {
      semaineSemis: 20,
      semainePlantation: null,
      semaineImplantationDebut: 20,
      semaineImplantationFin: 26,
      implantation: 'Semis',
    }
    expect(alerteSaisonCulture({ itp: couvert, dateSemis: '2026-06-22' })).toBeNull() // S26
    const alerte = alerteSaisonCulture({ itp: couvert, dateSemis: '2026-08-24' }) // S35
    expect(alerte?.champ).toBe('dateSemis')
    expect(alerte?.message).toBe("Hors fenêtre de l'itinéraire (semis S20–S26) : semis prévu S35.")
  })

  it('mesclun sans semaine de semis ni de plantation : implantation = semis', () => {
    const mesclun = { semaineImplantationDebut: 10, semaineImplantationFin: 14, implantation: null }
    expect(etapeImplantation(mesclun)).toBe('semis')
    expect(alerteSaisonCulture({ itp: mesclun, dateSemis: '2026-09-07' })?.message).toContain('semis S10–S14')
  })

  it('« Semis et implantation » est un semis', () => {
    expect(etapeImplantation({ implantation: 'Semis et implantation', semainePlantation: null })).toBe('semis')
  })

  it('tolère le passage d’année (fenêtre S50–S2)', () => {
    const hiver = { semainePlantation: 50, semaineImplantationDebut: 50, semaineImplantationFin: 2, implantation: 'Plantation' }
    expect(alerteSaisonCulture({ itp: hiver, datePlantation: '2027-01-11' })).toBeNull() // S2
    expect(alerteSaisonCulture({ itp: hiver, datePlantation: '2027-02-01' })).toBeNull() // S5 = S2 + 3
    expect(alerteSaisonCulture({ itp: hiver, datePlantation: '2026-11-16' })).toBeNull() // S47 = S50 − 3
    expect(alerteSaisonCulture({ itp: hiver, datePlantation: '2027-02-08' })?.ecartSemaines).toBe(4) // S6
  })

  it('ITP sans fenêtre documentée : la semaine de référence fait fenêtre (revue du 2026-10-25)', () => {
    const historique = { semaineSemis: 10, semainePlantation: 16, semaineImplantationDebut: null, semaineImplantationFin: null }
    expect(alerteSaisonCulture({ itp: historique, datePlantation: '2026-10-25' })?.message).toBe(
      "Hors fenêtre de l'itinéraire (plantation S16) : plantation prévue S43."
    )
    // S16 ± 3 semaines : S19 (4 mai) toléré.
    expect(alerteSaisonCulture({ itp: historique, datePlantation: '2026-05-04' })).toBeNull()
    // Semis direct historique : `semaineSemisEffective`.
    const radis = { semaineSemis: 12, semainePlantation: null }
    expect(alerteSaisonCulture({ itp: radis, dateSemis: '2026-09-07' })?.message).toContain('semis S12')
  })

  it('ITP qui ne situe pas son implantation, ou pas d’ITP : aucune alerte', () => {
    expect(alerteSaisonCulture({ itp: { semaineSemis: null, semainePlantation: null }, datePlantation: '2026-10-25' })).toBeNull()
    expect(alerteSaisonCulture({ itp: null, datePlantation: '2026-10-25' })).toBeNull()
  })

  it('« Semis et implantation » (ITP perso semé S10, planté S16, fenêtre S15–S18) : jugé sur la plantation', () => {
    const perso = {
      semaineSemis: 10,
      semainePlantation: 16,
      semaineImplantationDebut: 15,
      semaineImplantationFin: 18,
      implantation: 'Semis et implantation',
    }
    expect(etapeImplantation(perso)).toBe('plantation')
    // Semé S10 (2 mars), planté S16 (13 avril) : rien à dire.
    expect(alerteSaisonCulture({ itp: perso, dateSemis: '2026-03-02', datePlantation: '2026-04-13' })).toBeNull()
    // Même ITP sans libellé d'implantation : même verdict.
    expect(alerteSaisonCulture({ itp: { ...perso, implantation: null }, dateSemis: '2026-03-02', datePlantation: '2026-04-13' })).toBeNull()
    // Planté S30 : c'est la plantation qui est hors fenêtre.
    expect(alerteSaisonCulture({ itp: perso, dateSemis: '2026-03-02', datePlantation: '2026-07-20' })?.champ).toBe('datePlantation')
  })

  it('« Semis et implantation » dont seule la semaine de semis tombe dans la fenêtre : jugé sur le semis', () => {
    const itp = { semaineSemis: 15, semainePlantation: 22, semaineImplantationDebut: 15, semaineImplantationFin: 17, implantation: 'Semis et implantation' }
    expect(etapeImplantation(itp)).toBe('semis')
  })

  it('semis direct avec une plantation seule : la plantation est l’implantation', () => {
    const couvert = { semaineSemis: 20, semainePlantation: null, semaineImplantationDebut: 20, semaineImplantationFin: 26, implantation: 'Semis' }
    const alerte = alerteSaisonCulture({ itp: couvert, dateSemis: null, datePlantation: '2026-08-24' })
    expect(alerte?.champ).toBe('datePlantation')
    expect(alerte?.message).toBe("Hors fenêtre de l'itinéraire (semis S20–S26) : plantation prévue S35.")
    expect(alerteSaisonCulture({ itp: couvert, dateSemis: null, datePlantation: '2026-06-01' })).toBeNull()
  })

  it('date absente ou illisible : aucune alerte', () => {
    expect(alerteSaisonCulture({ itp: AUBERGINE_0020, datePlantation: null })).toBeNull()
    expect(alerteSaisonCulture({ itp: AUBERGINE_0020, datePlantation: 'pas une date' })).toBeNull()
  })
})
