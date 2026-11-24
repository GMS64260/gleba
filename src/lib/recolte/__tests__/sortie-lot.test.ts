import { describe, expect, it } from 'vitest'
import { jourSortie, preparerSortieLot } from '@/lib/recolte/sortie-lot'

const maintenant = new Date('2026-11-24T10:00:00Z')
const lot = { quantite: 10, unite: 'kg' as string | null, date: new Date('2026-11-20T06:00:00Z') }
const jour = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

describe('preparerSortieLot', () => {
  it('sans quantité ni date : le lot entier, à l’instant présent (sortie du jour)', () => {
    expect(preparerSortieLot(lot, {}, maintenant)).toEqual({ ok: true, quantite: 10, reliquat: 0, date: maintenant })
    // 23:30 UTC le 24 = 00:30 à Paris le 25 : c'est aujourd'hui à Paris.
    const minuitPasse = new Date('2026-11-24T23:30:00Z')
    expect(preparerSortieLot(lot, {}, minuitPasse)).toMatchObject({ date: minuitPasse })
  })

  it('une sortie d’un jour passé est un jour seul, stocké à minuit UTC ; celle d’aujourd’hui garde l’instant', () => {
    expect(preparerSortieLot(lot, { dateSortie: jour('2026-11-22') }, maintenant)).toMatchObject({ date: jour('2026-11-22') })
    expect(preparerSortieLot(lot, { dateSortie: jour('2026-11-24') }, maintenant)).toMatchObject({ date: maintenant })
  })

  it('jourSortie relit les deux formes au jour de Paris', () => {
    expect(jourSortie(jour('2026-11-22'))).toBe('2026-11-22')
    expect(jourSortie(new Date('2026-11-24T23:30:00Z'))).toBe('2026-11-25')
  })

  it('partielle : le reliquat est arrondi au millième', () => {
    expect(preparerSortieLot(lot, { quantiteSortie: 3.3 }, maintenant)).toMatchObject({ ok: true, quantite: 3.3, reliquat: 6.7 })
    expect(preparerSortieLot({ ...lot, quantite: 0.3 }, { quantiteSortie: 0.1 }, maintenant)).toMatchObject({ reliquat: 0.2 })
  })

  it('une quantité égale au lot à la bavure du flottant près vaut le lot entier', () => {
    expect(preparerSortieLot({ ...lot, quantite: 0.1 + 0.2 }, { quantiteSortie: 0.3 }, maintenant)).toMatchObject({ ok: true, quantite: 0.1 + 0.2, reliquat: 0 })
  })

  it('refuse zéro, un dépassement, une fraction de pièce et une part plus fine que le millième', () => {
    expect(preparerSortieLot(lot, { quantiteSortie: 0 }, maintenant)).toMatchObject({ ok: false, champ: 'quantiteSortie' })
    expect(preparerSortieLot(lot, { quantiteSortie: 10.01 }, maintenant)).toMatchObject({ ok: false, champ: 'quantiteSortie' })
    expect(preparerSortieLot({ ...lot, unite: 'piece' }, { quantiteSortie: 1.5 }, maintenant)).toMatchObject({ ok: false, champ: 'quantiteSortie' })
    expect(preparerSortieLot({ ...lot, unite: null }, { quantiteSortie: 1.5 }, maintenant)).toMatchObject({ ok: true })
    expect(preparerSortieLot(lot, { quantiteSortie: 3.3334 }, maintenant)).toMatchObject({ ok: false, champ: 'quantiteSortie' })
    expect(preparerSortieLot(lot, { quantiteSortie: 3.333 }, maintenant)).toMatchObject({ ok: true, reliquat: 6.667 })
  })

  it('un lot entier sort même s’il est plus fin que le millième', () => {
    expect(preparerSortieLot({ ...lot, quantite: 1.23456 }, {}, maintenant)).toMatchObject({ ok: true, quantite: 1.23456, reliquat: 0 })
  })

  it('le jour de sortie va du jour de la récolte à demain (marge de l’Outre-mer de l’Est)', () => {
    const le = (iso: string) => preparerSortieLot(lot, { quantiteSortie: 1, dateSortie: jour(iso) }, maintenant)
    expect(le('2026-11-19')).toMatchObject({ ok: false, champ: 'dateSortie' })
    expect(le('2026-11-20')).toMatchObject({ ok: true, date: jour('2026-11-20') })
    expect(le('2026-11-24')).toMatchObject({ ok: true, date: maintenant })
    expect(le('2026-11-25')).toMatchObject({ ok: true })
    expect(le('2026-11-26')).toMatchObject({ ok: false, champ: 'dateSortie' })
  })

  it('Nouméa, 8 h le 25 (21 h UTC le 24) : une récolte du jour sort, avec ou sans date', () => {
    const noumea = new Date('2026-11-24T21:00:00Z')
    const recolteDuJour = { ...lot, date: jour('2026-11-25') }
    expect(preparerSortieLot(recolteDuJour, { dateSortie: jour('2026-11-25') }, noumea)).toMatchObject({ ok: true, date: jour('2026-11-25') })
    expect(preparerSortieLot(recolteDuJour, {}, noumea)).toMatchObject({ ok: true, date: jour('2026-11-25') })
  })
})
