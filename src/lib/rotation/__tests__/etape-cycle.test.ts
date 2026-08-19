/**
 * Position dans le cycle de rotation — tickets cmswy9fyr puis cmsx6348h.
 *
 * Deux planches sur la MÊME rotation peuvent légitimement être à des étapes
 * différentes : c'est l'année de départ de chaque planche qui décale le cycle.
 * Sans année de départ, la phase retombe sur un epoch fixe — arbitraire, mais
 * stable d'une année sur l'autre. Ces deux propriétés sont ce que l'écran
 * explique désormais à l'utilisateur, donc ce qu'il faut tenir.
 */

import { describe, it, expect } from 'vitest'
import { EPOCH_ROTATION_SANS_ANCRAGE, etapeCycleRotation } from '../etape-cycle'

describe('etapeCycleRotation', () => {
  it('place la planche à l’étape 1 son année de départ', () => {
    expect(etapeCycleRotation(2026, 2026, 3)).toBe(1)
  })

  it('avance d’une étape par année et boucle sur le cycle', () => {
    expect(etapeCycleRotation(2027, 2026, 3)).toBe(2)
    expect(etapeCycleRotation(2028, 2026, 3)).toBe(3)
    expect(etapeCycleRotation(2029, 2026, 3)).toBe(1)
  })

  it('reste dans le cycle pour une année antérieure à l’ancrage', () => {
    expect(etapeCycleRotation(2025, 2026, 3)).toBe(3)
    expect(etapeCycleRotation(2024, 2026, 3)).toBe(2)
  })

  it('décale deux planches de la même rotation selon leur ancrage', () => {
    // Cas exact du signalement : C1 (départ 2026) contre une planche sans départ.
    expect(etapeCycleRotation(2026, 2026, 3)).toBe(1)
    expect(etapeCycleRotation(2026, null, 3)).toBe(
      etapeCycleRotation(2026, EPOCH_ROTATION_SANS_ANCRAGE, 3),
    )
  })

  it('sans ancrage, retombe sur l’epoch fixe et progresse quand même', () => {
    const etape2026 = etapeCycleRotation(2026, null, 3)
    const etape2027 = etapeCycleRotation(2027, null, 3)
    expect(etape2027).toBe((etape2026 % 3) + 1)
  })

  it('reste dans les bornes 1..nbAnnees pour tout cycle plausible', () => {
    for (const nbAnnees of [1, 2, 3, 4, 5, 6, 7, 8]) {
      for (let annee = 2020; annee <= 2035; annee++) {
        const etape = etapeCycleRotation(annee, 2026, nbAnnees)
        expect(etape).toBeGreaterThanOrEqual(1)
        expect(etape).toBeLessThanOrEqual(nbAnnees)
      }
    }
  })

  it('rend 1 pour un cycle vide ou incohérent plutôt que NaN', () => {
    expect(etapeCycleRotation(2026, 2026, 0)).toBe(1)
    expect(etapeCycleRotation(2026, 2026, -3)).toBe(1)
  })
})
