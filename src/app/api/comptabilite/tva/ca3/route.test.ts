import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: async () => ({ error: null, session: { user: { id: 'ferme', email: 'ferme@example.invalid' } } }) }))
vi.mock('@/lib/kpi/tva', () => ({
  computeTvaPeriode: async () => ({
    franchise: false,
    regimeTva: 'reel',
    collectee: { parTaux: { '20': { base: 100, tva: 20 }, '5.5': { base: 200, tva: 11 } }, total: 31 },
    deductible: { immobilisations: 10, total: 41 },
    solde: { tvaAPayer: 0, creditTVA: 10 },
    details: { nbInfereesCollectees: 0, nbInfereesDeductibles: 0 },
  }),
}))
import { GET } from './route'

describe('aide à la déclaration de TVA (revue du 2026-11-11)', () => {
  it("donne les montants sans aucun numéro de case : un crédit n'est plus annoncé sur la ligne du total à payer", async () => {
    const reponse = await GET(new NextRequest('http://localhost/api/comptabilite/tva/ca3?year=2026&trimestre=1&format=csv'))
    expect(reponse.status).toBe(200)
    const lignes = (await reponse.text()).split('\n')
    expect(lignes).toContain('libelle;valeur_eur')
    expect(lignes).toContain('"Crédit de TVA";10.00')
    expect(lignes).toContain('"TVA nette due (solde à payer)";0.00')
    const donnees = lignes.filter((l) => !l.startsWith('#') && l !== 'libelle;valeur_eur')
    expect(donnees.length).toBeGreaterThan(8)
    for (const l of donnees) expect(l).toMatch(/^"[^"]+";-?\d+\.\d{2}$/)
    expect(lignes.join('\n')).not.toMatch(/recopier/i)
  })
})
