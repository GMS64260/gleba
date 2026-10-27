import { beforeEach, expect, it } from 'vitest'
import { delegueMemoire } from '@/lib/__tests__/fixtures/referentiel-memoire'
import { verifierReferencesIntervention } from './references'

let db: Parameters<typeof verifierReferencesIntervention>[0]
beforeEach(() => {
  db = {
    culture: delegueMemoire([{ id: 1, userId: 'moi' }, { id: 2, userId: 'autre' }]),
    arbre: delegueMemoire([{ id: 1, userId: 'moi' }, { id: 2, userId: 'autre' }]),
    planche: delegueMemoire([{ id: 'p1', nom: 'A1', userId: 'moi' }, { id: 'p2', nom: 'A2', userId: 'autre' }]),
  } as unknown as typeof db
})
it('accepte les références de la même exploitation', async () => {
  expect(await verifierReferencesIntervention(db, 'moi', { cultureId: 1, arbreId: 1, plancheId: 'p1' }))
    .toEqual({ ok: true, plancheId: 'p1' })
})
it('traduit un ancien nom de planche dans le même compte', async () => {
  expect(await verifierReferencesIntervention(db, 'moi', { plancheId: 'A1' })).toEqual({ ok: true, plancheId: 'p1' })
})
it.each(['cultureId', 'arbreId', 'plancheId'] as const)('refuse %s appartenant à une autre exploitation', async champ => {
  expect(await verifierReferencesIntervention(db, 'moi', { [champ]: champ === 'plancheId' ? 'p2' : 2 }))
    .toMatchObject({ ok: false, champ })
})
it('ne conserve pas une planche inconnue ou supprimée à l’écriture', async () => {
  expect(await verifierReferencesIntervention(db, 'moi', { plancheId: 'absente' })).toMatchObject({ ok: false, champ: 'plancheId' })
})
it('préserve la différence entre référence omise et référence effacée', async () => {
  expect(await verifierReferencesIntervention(db, 'moi', {})).toEqual({ ok: true, plancheId: undefined })
  expect(await verifierReferencesIntervention(db, 'moi', { plancheId: null })).toEqual({ ok: true, plancheId: null })
})
