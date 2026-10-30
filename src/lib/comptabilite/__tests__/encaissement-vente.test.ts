/**
 * Décision du 2026-10-30 : une vente directe démarre payée ; la décocher en
 * fait une vente à crédit. Aucun mode n'est proposé d'office : les écrans de
 * vente n'en proposaient pas avant le 2026-10-28.
 */
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { changerEncaissement, encaissementVenteInitial, paiementVenteInitial } from '../encaissement-vente'

afterEach(() => { vi.useRealTimers() })

describe('statut proposé à la saisie d’une vente directe', () => {
  it('élevage (Ventes, fiche animal, sortie de cave) : payée, sans mode', () => {
    expect(encaissementVenteInitial()).toEqual({ paye: true, modeReglement: '' })
  })

  it('verger (fruits, bois) : règlement reçu coché, mode à choisir, date du jour', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 30, 23, 30))
    expect(paiementVenteInitial()).toEqual({ paye: true, modeReglement: '', datePaiement: '2026-10-30' })
  })

  it('choisir « À crédit » décoche la vente ; la recocher retire ce mode', () => {
    const payee = encaissementVenteInitial()
    expect(changerEncaissement(payee, { modeReglement: 'À crédit' })).toEqual({ modeReglement: 'À crédit', paye: false })
    expect(changerEncaissement({ paye: false, modeReglement: 'À crédit' }, { paye: true })).toEqual({ paye: true, modeReglement: '' })
  })

  it('les autres choix passent tels quels', () => {
    expect(changerEncaissement(encaissementVenteInitial(), { modeReglement: 'Chèque' })).toEqual({ modeReglement: 'Chèque' })
    expect(changerEncaissement({ paye: true, modeReglement: 'Chèque' }, { paye: false })).toEqual({ paye: false })
    expect(changerEncaissement({ paye: false, modeReglement: 'Virement' }, { paye: true })).toEqual({ paye: true })
  })

  // Les écrans ne se rendent pas dans ce banc (environnement node) : chaque
  // formulaire de vente doit partir du statut commun, jamais d'un `paye: false` figé.
  it.each([
    ['src/components/elevage/ProductionTab.tsx', 'encaissementVenteInitial()', 2],
    ['src/components/elevage/AnimauxTab.tsx', 'encaissementVenteInitial()', 1],
    ['src/components/elevage/AffinageSubTab.tsx', 'encaissementVenteInitial()', 2],
    ['src/components/verger/ProductionsTab.tsx', 'paiementVenteInitial()', 5],
  ])('%s part du statut commun', (fichier, appel, occurrences) => {
    const source = readFileSync(fichier, 'utf8')
    expect(source.split(appel).length - 1).toBeGreaterThanOrEqual(occurrences)
    expect(source).not.toMatch(/paye: false, modeReglement: ""/)
  })
})
