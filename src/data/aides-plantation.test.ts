import { describe, expect, it } from 'vitest'
import { AIDES_PLANTATION } from './aides-plantation'

const fiche = (id: string) => AIDES_PLANTATION.find((a) => a.id === id)!

describe('catalogue des aides : fiches vérifiées sur les textes officiels', () => {
  // FB-5J3M23 — notice CAB 2026 (version DGPE du 27/04/2026), § 2 Montants.
  it('CAB : maraîchage et arboriculture à 900 €/ha, légumes de plein champ à 450 €/ha', () => {
    const { tauxAide, conditions } = fiche('cab')
    expect(tauxAide).toContain('maraîchage et arboriculture 900 €')
    expect(tauxAide).toContain('plein champ 450 €')
    expect(tauxAide).not.toMatch(/maraîchage\s*~\s*350/)
    expect(conditions.join(' ')).toContain('300 €')
  })

  // FB-V71OVA — décision FranceAgriMer INTV-SIIF-2026-33, art. 3.2 : « les
  // travaux d'arrachage » sont inéligibles.
  it('rénovation des vergers : aide à la plantation, pas à l’arrachage', () => {
    const { description, tauxAide, url } = fiche('fam_vergers')
    expect(description).not.toMatch(/soutien à l'arrachage/i)
    expect(description).toContain("Les travaux d'arrachage ne sont pas aidés")
    expect(tauxAide).toContain('20 % des dépenses éligibles HT')
    expect(new URL(url!).pathname.length).toBeGreaterThan(1)
  })
})
