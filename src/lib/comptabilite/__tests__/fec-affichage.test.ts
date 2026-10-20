/**
 * Contrôle d'équilibre FEC : montants en français (ticket cmvge803p, 2026-10-20).
 * L'écran affichait « Total Débit : 47224.12 € » et « Écart : 0.00 € ».
 */

import { describe, expect, it } from 'vitest'
import { formatMontantFec } from '../fec-affichage'

/** `Intl` sépare les milliers par une espace fine insécable et le symbole par une insécable. */
const lisible = (s: string) => s.replace(/[  ]/g, ' ')

describe('formatMontantFec', () => {
  it('écrit les totaux du ticket avec séparateur de milliers et virgule décimale', () => {
    expect(lisible(formatMontantFec(47224.12))).toBe('47 224,12 €')
    expect(lisible(formatMontantFec(0))).toBe('0,00 €')
  })

  it("n'affiche jamais « -0,00 € » pour un écart arrondi à zéro", () => {
    expect(lisible(formatMontantFec(-0))).toBe('0,00 €')
    expect(lisible(formatMontantFec(-0.004))).toBe('0,00 €')
  })

  it('garde le signe d’un vrai écart et arrondit au centime', () => {
    expect(lisible(formatMontantFec(-12.5))).toBe('-12,50 €')
    expect(lisible(formatMontantFec(1234.567))).toBe('1 234,57 €')
  })

  it('ne casse pas sur une valeur non finie', () => {
    expect(lisible(formatMontantFec(Number.NaN))).toBe('0,00 €')
  })
})
