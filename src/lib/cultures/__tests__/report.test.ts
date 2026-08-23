import { describe, expect, it } from 'vitest'
import { ecrituresReport, type CultureAReporter } from '../report'

/**
 * Friction 2026-08-23 : face à des plantations en retard, un maraîcher a
 * supprimé ses cultures puis recréé les mêmes variétés à dates fraîches —
 * aucune action de report n'existait. Le report déplace l'étape ET fait suivre
 * le reste du cycle non fait, sans jamais toucher aux étapes faites.
 */

function culture(surcharges: Partial<CultureAReporter> = {}): CultureAReporter {
  return {
    semisFait: false,
    plantationFaite: false,
    recolteFaite: false,
    terminee: null,
    dateSemis: new Date(2026, 7, 17, 12, 0), // 17/08/2026
    datePlantation: new Date(2026, 8, 14, 12, 0), // 14/09/2026
    dateRecolte: new Date(2026, 10, 12, 12, 0), // 12/11/2026
    dateSemisPlan: null,
    datePlantationPlan: null,
    dateRecoltePlan: null,
    ...surcharges,
  }
}

describe('ecrituresReport', () => {
  it('reporte le semis et décale plantation et récolte du même nombre de jours', () => {
    const resultat = ecrituresReport(culture(), 'semis', new Date(2026, 7, 24, 0, 0)) // +7 j
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.ecritures.dateSemis).toEqual(new Date(2026, 7, 24, 0, 0))
    expect(resultat.ecritures.datePlantation).toEqual(new Date(2026, 8, 21, 12, 0))
    expect(resultat.ecritures.dateRecolte).toEqual(new Date(2026, 10, 19, 12, 0))
    expect(resultat.decalages.map((d) => d.etape)).toEqual(['semis', 'plantation', 'recolte'])
  })

  it('ne touche jamais une étape déjà faite, même ultérieure', () => {
    const resultat = ecrituresReport(
      culture({ recolteFaite: true }),
      'plantation',
      new Date(2026, 8, 21, 0, 0)
    )
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.ecritures.datePlantation).toEqual(new Date(2026, 8, 21, 0, 0))
    expect(resultat.ecritures.dateRecolte).toBeUndefined()
    expect(resultat.ecritures.dateSemis).toBeUndefined()
    expect(resultat.decalages.map((d) => d.etape)).toEqual(['plantation'])
  })

  it('refuse de reporter une étape déjà faite', () => {
    const resultat = ecrituresReport(culture({ semisFait: true }), 'semis', new Date(2026, 7, 24))
    expect(resultat.ok).toBe(false)
    if (resultat.ok) return
    expect(resultat.erreur).toContain('déjà faite')
  })

  it('refuse de reporter une culture terminée', () => {
    const resultat = ecrituresReport(culture({ terminee: 'x' }), 'semis', new Date(2026, 7, 24))
    expect(resultat.ok).toBe(false)
  })

  it('refuse un report qui placerait la plantation avant un semis fait', () => {
    const resultat = ecrituresReport(
      culture({ semisFait: true, dateSemis: new Date(2026, 8, 1, 12, 0) }),
      'plantation',
      new Date(2026, 7, 20, 0, 0)
    )
    expect(resultat.ok).toBe(false)
    if (resultat.ok) return
    expect(resultat.erreur).toContain('avant le semis')
  })

  it('autorise une avance (delta négatif) tant que la chronologie tient', () => {
    const resultat = ecrituresReport(culture(), 'semis', new Date(2026, 7, 10, 0, 0)) // -7 j
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.ecritures.datePlantation).toEqual(new Date(2026, 8, 7, 12, 0))
    expect(resultat.ecritures.dateRecolte).toEqual(new Date(2026, 10, 5, 12, 0))
  })

  it('sans ancienne date, pose la nouvelle sans décaler le reste', () => {
    const resultat = ecrituresReport(
      culture({ datePlantation: null }),
      'plantation',
      new Date(2026, 8, 20, 0, 0)
    )
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.ecritures.datePlantation).toEqual(new Date(2026, 8, 20, 0, 0))
    expect(resultat.ecritures.dateRecolte).toBeUndefined()
    expect(resultat.decalages).toHaveLength(1)
  })

  it('ignore une étape ultérieure sans date', () => {
    const resultat = ecrituresReport(culture({ dateRecolte: null }), 'semis', new Date(2026, 7, 24, 0, 0))
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.ecritures.dateRecolte).toBeUndefined()
    expect(resultat.decalages.map((d) => d.etape)).toEqual(['semis', 'plantation'])
  })

  it('libère la mémoire de plan des étapes déplacées (date redéfinie)', () => {
    const resultat = ecrituresReport(
      culture({ datePlantationPlan: new Date(2026, 8, 1), dateRecoltePlan: new Date(2026, 10, 1) }),
      'plantation',
      new Date(2026, 8, 21, 0, 0)
    )
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.ecritures.datePlantationPlan).toBeNull()
    expect(resultat.ecritures.dateRecoltePlan).toBeNull()
  })

  it('un report au même jour ne décale pas le reste du cycle', () => {
    const resultat = ecrituresReport(culture(), 'semis', new Date(2026, 7, 17, 0, 0))
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.ecritures.datePlantation).toBeUndefined()
    expect(resultat.decalages).toHaveLength(1)
  })
})
