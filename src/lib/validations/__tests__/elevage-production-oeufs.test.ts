/**
 * BUG #2 (audit Julien 15/05/2026) — schéma Zod accepte le flag
 * `overrideCoherence` pour les saisies de rattrapage.
 */

import { describe, it, expect } from 'vitest'
import { productionOeufsSchema } from '../elevage-production-oeufs'

describe('productionOeufsSchema (BUG #2)', () => {
  const base = { lotId: 1, date: new Date('2026-05-15'), quantite: 20 }

  it('valide une saisie cohérente standard', () => {
    expect(productionOeufsSchema.safeParse(base).success).toBe(true)
  })

  it('accepte overrideCoherence=true (saisie de rattrapage)', () => {
    const r = productionOeufsSchema.safeParse({ ...base, quantite: 999, overrideCoherence: true })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.overrideCoherence).toBe(true)
  })

  it('accepte overrideCoherence absent (validation effectif faite côté route)', () => {
    const r = productionOeufsSchema.safeParse({ ...base, quantite: 999 })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.overrideCoherence).toBeUndefined()
  })

  it('refuse quantité 0 ou négative', () => {
    expect(productionOeufsSchema.safeParse({ ...base, quantite: 0 }).success).toBe(false)
    expect(productionOeufsSchema.safeParse({ ...base, quantite: -1 }).success).toBe(false)
  })

  it('refuse quantité non-entière (œuf indivisible)', () => {
    expect(productionOeufsSchema.safeParse({ ...base, quantite: 3.5 }).success).toBe(false)
  })

  it("exige lotId OU animalId (au moins l'un des deux)", () => {
    expect(productionOeufsSchema.safeParse({ quantite: 10 }).success).toBe(false)
    expect(productionOeufsSchema.safeParse({ animalId: 5, quantite: 10 }).success).toBe(true)
    expect(productionOeufsSchema.safeParse({ lotId: 5, quantite: 10 }).success).toBe(true)
  })
})
