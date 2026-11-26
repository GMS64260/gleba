import { describe, expect, it } from 'vitest'
import { bornesDateEcriture, dateEcritureSchema, dernierExercice, refusDateHorsExercices } from './exercices'
import { getAvailableYears } from '@/components/year-selector'

const maintenant = new Date(2026, 10, 26)

describe("horizon des exercices (D73)", () => {
  it("refuse une date qu'aucun sélecteur d'année ne sait rouvrir", () => {
    expect(refusDateHorsExercices(new Date('2036-05-12T00:00:00Z'), maintenant)).toContain('2000 à 2027')
    expect(refusDateHorsExercices(new Date('1999-12-31T00:00:00Z'), maintenant)).not.toBeNull()
  })

  it("accepte tout l'horizon du sélecteur, bornes comprises", () => {
    expect(refusDateHorsExercices(new Date('2000-01-01T00:00:00Z'), maintenant)).toBeNull()
    expect(refusDateHorsExercices(new Date('2027-12-31T00:00:00Z'), maintenant)).toBeNull()
    expect(refusDateHorsExercices(new Date('2028-01-01T00:00:00Z'), maintenant)).not.toBeNull()
  })

  it("suit exactement les années du sélecteur", () => {
    const annees = getAvailableYears()
    expect(annees[0]).toBe(dernierExercice())
    expect(annees[annees.length - 1]).toBe(2000)
    expect(bornesDateEcriture(maintenant)).toEqual({ min: '2000-01-01', max: '2027-12-31' })
  })

  it("le schéma lit « AAAA-MM-JJ » et refuse hors horizon", () => {
    expect(dateEcritureSchema.safeParse('2026-11-26').success).toBe(true)
    expect(dateEcritureSchema.safeParse('2036-01-01').success).toBe(false)
    expect(dateEcritureSchema.safeParse('pas une date').success).toBe(false)
  })
})
