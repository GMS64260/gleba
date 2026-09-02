import { describe, expect, it } from 'vitest'
import {
  chevauchePeriode,
  estVivaceEnPlace,
  finDeCycle,
  finRecolteDepuisItp,
  recolteEnRetard,
  semainesDeRecolte,
} from '../fenetre-recolte'

/**
 * Constat du 2026-08-26 : `cultures.fin_recolte` valait NULL sur les 579
 * cultures de la production, alors que 767 des 773 ITP portent une durée de
 * récolte. Une culture n'avait donc qu'une DATE de récolte, et passait « en
 * retard » le lendemain — 84 cultures sur 13 comptes, 63 jours de retard moyen.
 *
 * Cas de référence du jour : l'aubergine d'un compte réel, ITP `Aubergine-serre`,
 * 18 semaines de récolte à partir du 26/07, affichée « 31 jours de retard ».
 */
describe('semainesDeRecolte', () => {
  it('retient la durée explicite du référentiel', () => {
    expect(semainesDeRecolte({ dureeRecolte: 18, semaineRecolte: 24 })).toBe(18)
  })

  it('déduit la durée du couple début/fin quand la durée manque', () => {
    expect(semainesDeRecolte({ semaineRecolte: 31, semaineRecolteFin: 37 })).toBe(6)
  })

  it('gère une fenêtre qui passe une fin d’année', () => {
    // Récolte de S48 à S6 : 10 semaines, pas -42.
    expect(semainesDeRecolte({ semaineRecolte: 48, semaineRecolteFin: 6 })).toBe(10)
  })

  it('préfère la durée explicite au couple début/fin', () => {
    expect(
      semainesDeRecolte({ dureeRecolte: 4, semaineRecolte: 30, semaineRecolteFin: 40 })
    ).toBe(4)
  })

  it('rend null quand le référentiel ne dit rien', () => {
    expect(semainesDeRecolte({ semaineRecolte: 24 })).toBeNull()
    expect(semainesDeRecolte({ dureeRecolte: 0, semaineRecolte: 24 })).toBeNull()
    expect(semainesDeRecolte(null)).toBeNull()
  })
})

describe('finRecolteDepuisItp', () => {
  it('reporte la durée en jours civils depuis le début de récolte', () => {
    const fin = finRecolteDepuisItp(new Date(2026, 6, 26), { dureeRecolte: 18 })
    // 26/07 + 18 semaines = 29/11
    expect(fin?.getFullYear()).toBe(2026)
    expect(fin?.getMonth()).toBe(10)
    expect(fin?.getDate()).toBe(29)
  })

  it('n’invente aucune fenêtre sans durée au référentiel', () => {
    expect(finRecolteDepuisItp(new Date(2026, 6, 26), { semaineRecolte: 24 })).toBeNull()
    expect(finRecolteDepuisItp(new Date(2026, 6, 26), null)).toBeNull()
  })

  it('ne rend rien sans date de début', () => {
    expect(finRecolteDepuisItp(null, { dureeRecolte: 18 })).toBeNull()
  })
})

describe('finDeCycle', () => {
  it('prend la fin de fenêtre quand elle existe', () => {
    const fin = finDeCycle({
      dateRecolte: new Date(2026, 6, 26),
      finRecolte: new Date(2026, 10, 29),
    })
    expect(fin?.getMonth()).toBe(10)
  })

  it('retombe sur la date de récolte sans fenêtre', () => {
    const fin = finDeCycle({ dateRecolte: new Date(2026, 6, 26), finRecolte: null })
    expect(fin?.getMonth()).toBe(6)
  })

  it('ne raccourcit jamais un cycle sur une donnée incohérente', () => {
    // Une fin antérieure au début est une donnée fausse : on garde la plus
    // tardive plutôt que de libérer la planche trop tôt.
    const fin = finDeCycle({
      dateRecolte: new Date(2026, 6, 26),
      finRecolte: new Date(2026, 5, 1),
    })
    expect(fin?.getMonth()).toBe(6)
  })
})

describe('recolteEnRetard', () => {
  const maintenant = new Date(2026, 7, 26) // 26/08/2026

  it('ne déclare PAS en retard une culture dont la fenêtre court encore', () => {
    // Le cas exact du 2026-08-26 : début 26/07, fenêtre de 18 semaines.
    expect(
      recolteEnRetard(
        {
          dateRecolte: new Date(2026, 6, 26),
          finRecolte: new Date(2026, 10, 29),
          recolteFaite: false,
        },
        maintenant
      )
    ).toBe(false)
  })

  it('déclare en retard une fois la fenêtre close', () => {
    expect(
      recolteEnRetard(
        {
          dateRecolte: new Date(2026, 4, 1),
          finRecolte: new Date(2026, 5, 1),
          recolteFaite: false,
        },
        maintenant
      )
    ).toBe(true)
  })

  it('garde le comportement d’avant quand aucune fenêtre n’est connue', () => {
    expect(
      recolteEnRetard(
        { dateRecolte: new Date(2026, 6, 26), finRecolte: null, recolteFaite: false },
        maintenant
      )
    ).toBe(true)
  })

  it('ignore une récolte faite ou une culture close', () => {
    expect(
      recolteEnRetard(
        { dateRecolte: new Date(2026, 4, 1), finRecolte: null, recolteFaite: true },
        maintenant
      )
    ).toBe(false)
    expect(
      recolteEnRetard(
        { dateRecolte: new Date(2026, 4, 1), finRecolte: null, terminee: 'x' },
        maintenant
      )
    ).toBe(false)
  })
})

/**
 * Cas réel du 2026-08-25 : fraisiers plantés le 03/04/2023, récolte du
 * 05/05/2026 au 08/09/2026, jamais terminés. Une vivace ne libère pas sa
 * planche à la fin de sa fenêtre : toute période postérieure à sa mise en
 * place la chevauche.
 */
describe('vivaces — occupation sans fin de cycle', () => {
  const fraisier = {
    datePlantation: new Date(2023, 3, 3),
    dateRecolte: new Date(2026, 4, 5),
    finRecolte: new Date(2026, 8, 8),
    espece: { vivace: true },
  }
  const periodeAutomne = [new Date(2026, 9, 1), new Date(2026, 11, 15)] as const

  it('estVivaceEnPlace : vivace non terminée seulement', () => {
    expect(estVivaceEnPlace(fraisier)).toBe(true)
    expect(estVivaceEnPlace({ ...fraisier, terminee: 'recoltee' })).toBe(false)
    expect(estVivaceEnPlace({ ...fraisier, espece: { vivace: false } })).toBe(false)
    expect(estVivaceEnPlace({ ...fraisier, espece: null })).toBe(false)
  })

  it('une vivace recouvre une période postérieure à sa fenêtre de récolte', () => {
    expect(chevauchePeriode(fraisier, ...periodeAutomne)).toBe(true)
    // et l'année suivante encore
    expect(chevauchePeriode(fraisier, new Date(2027, 2, 1), new Date(2027, 5, 30))).toBe(true)
  })

  it('la même culture, annuelle, libère la planche après sa fenêtre', () => {
    const annuelle = { ...fraisier, espece: { vivace: false } }
    expect(chevauchePeriode(annuelle, ...periodeAutomne)).toBe(false)
    // mais chevauche pendant sa fenêtre
    expect(chevauchePeriode(annuelle, new Date(2026, 5, 1), new Date(2026, 6, 1))).toBe(true)
  })

  it('une vivace terminée ne compte plus', () => {
    expect(chevauchePeriode({ ...fraisier, terminee: 'arrachee' }, ...periodeAutomne)).toBe(false)
  })

  it('ne recouvre pas une période antérieure à sa mise en place', () => {
    expect(chevauchePeriode(fraisier, new Date(2022, 0, 1), new Date(2022, 11, 31))).toBe(false)
  })

  it('rend null quand les dates ne permettent pas de conclure', () => {
    expect(chevauchePeriode({ espece: { vivace: true } }, ...periodeAutomne)).toBeNull()
    expect(
      chevauchePeriode({ datePlantation: new Date(2026, 3, 1), espece: { vivace: false } }, ...periodeAutomne)
    ).toBeNull()
  })

  it('finDeCycle et recolteEnRetard restent inchangés pour une vivace', () => {
    // La fenêtre de récolte garde son sens d'échéance : la planche, elle,
    // n'est pas libérée pour autant (chevauchePeriode).
    expect(finDeCycle(fraisier)).toEqual(new Date(2026, 8, 8))
    expect(recolteEnRetard({ ...fraisier, recolteFaite: false }, new Date(2026, 8, 20))).toBe(true)
  })
})
