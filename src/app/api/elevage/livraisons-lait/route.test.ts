import { describe, expect, it } from 'vitest'
import { livraisonLaitSchema } from '@/lib/validations/livraison-lait'

describe('validation livraison lait', () => {
  it('accepte des analyses plausibles (cellules/germes en ×10³/mL)', () => {
    // Convention canonique : milliers/mL (650 = 650 000 cellules/mL, 12 = 12 000 germes/mL).
    expect(livraisonLaitSchema.safeParse({ date: '2026-07-21', litres: 120, tb: 38, tp: 32, cellules: 650, germes: 12, lipolyse: 0.6 }).success).toBe(true)
  })

  it('refuse une saisie en valeur brute (erreur d’unité)', () => {
    // Valeurs brutes /mL au lieu de milliers/mL → au-delà du garde-fou (20 000).
    expect(livraisonLaitSchema.safeParse({ date: '2026-07-21', litres: 120, cellules: 650000 }).success).toBe(false)
    expect(livraisonLaitSchema.safeParse({ date: '2026-07-21', litres: 120, germes: 500000 }).success).toBe(false)
  })

  it.each(['tb', 'tp', 'cellules', 'germes', 'lipolyse'])('refuse une valeur negative pour %s', (field) => {
    expect(livraisonLaitSchema.safeParse({ date: '2026-07-21', litres: 120, [field]: -1 }).success).toBe(false)
  })
})
