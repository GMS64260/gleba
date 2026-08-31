import { describe, expect, it } from 'vitest'
import {
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
