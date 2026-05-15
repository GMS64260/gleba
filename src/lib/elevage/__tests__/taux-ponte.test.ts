/**
 * BUG #3 + #5 (audit Julien 15/05/2026) — référentiel taux de ponte
 * saisonnier + helpers calendrier/dashboard.
 */

import { describe, it, expect } from 'vitest'
import {
  resolvePonteRef,
  tauxPonteJour,
  oeufsAttendusJour,
  tauxPonteAttenduPeriode,
  oeufsAttendusPeriode,
  seuilCollecteMaxJour,
  TAUX_PONTE_PAR_MOIS,
  MARGE_COHERENCE_COLLECTE,
} from '../taux-ponte'

describe('resolvePonteRef', () => {
  it('reconnaît marans / sussex insensible casse + accents', () => {
    expect(resolvePonteRef('Marans')).toBe('marans')
    expect(resolvePonteRef('marans')).toBe('marans')
    expect(resolvePonteRef('Maran ')).toBe('pondeuse_standard') // typo, retombe sur fallback
    expect(resolvePonteRef('Maráns')).toBe('marans')
    expect(resolvePonteRef('Sussex')).toBe('sussex')
    expect(resolvePonteRef('Sussex héritière')).toBe('sussex')
  })

  it('reconnaît canard et caille', () => {
    expect(resolvePonteRef('Canard coureur indien')).toBe('canard')
    expect(resolvePonteRef('Caille japonaise')).toBe('caille')
  })

  it('fallback pondeuse_standard si null/inconnu', () => {
    expect(resolvePonteRef(null)).toBe('pondeuse_standard')
    expect(resolvePonteRef(undefined)).toBe('pondeuse_standard')
    expect(resolvePonteRef('')).toBe('pondeuse_standard')
    expect(resolvePonteRef('Poule')).toBe('pondeuse_standard')
  })
})

describe('tauxPonteJour (BUG #3)', () => {
  it('Marans en mai → 80 %', () => {
    const mai = new Date(2026, 4, 15) // mois 4 = mai
    expect(tauxPonteJour('Marans', mai)).toBe(80)
  })

  it('Marans en janvier → 30 %', () => {
    expect(tauxPonteJour('Marans', new Date(2026, 0, 10))).toBe(30)
  })

  it('Marans en novembre → 25 %', () => {
    expect(tauxPonteJour('Marans', new Date(2026, 10, 15))).toBe(25)
  })

  it('Sussex > Marans à chaque mois (référence métier)', () => {
    for (let m = 0; m < 12; m++) {
      const d = new Date(2026, m, 15)
      expect(tauxPonteJour('Sussex', d)).toBeGreaterThanOrEqual(tauxPonteJour('Marans', d))
    }
  })
})

describe('oeufsAttendusJour (cas Julien)', () => {
  it('29 Marans en mai → 23 œufs (29 × 80 % arrondi)', () => {
    const mai = new Date(2026, 4, 15)
    expect(oeufsAttendusJour(29, 'Marans', mai)).toBe(23)
  })

  it('29 Marans en novembre → 7 œufs (29 × 25 % arrondi)', () => {
    const nov = new Date(2026, 10, 15)
    expect(oeufsAttendusJour(29, 'Marans', nov)).toBe(7)
  })

  it('19 Marans en mai → 15 œufs (DoD : supprimer 10 → ~16)', () => {
    // Julien : « Supprimer 10 pondeuses → ~16/jour attendu instantanément »
    const mai = new Date(2026, 4, 15)
    expect(oeufsAttendusJour(19, 'Marans', mai)).toBe(15)
  })

  it('0 effectif → 0 œuf, jamais NaN', () => {
    expect(oeufsAttendusJour(0, 'Marans', new Date())).toBe(0)
    expect(oeufsAttendusJour(-5, 'Marans', new Date())).toBe(0)
  })
})

describe('tauxPonteAttenduPeriode (BUG #5)', () => {
  it("matche tauxPonteJour quand la période est d'1 jour", () => {
    const d = new Date(2026, 4, 15)
    expect(tauxPonteAttenduPeriode('Marans', d, d)).toBe(80)
  })

  it('lisse correctement une période mai→juin', () => {
    const start = new Date(2026, 4, 15)
    const end = new Date(2026, 5, 15)
    const taux = tauxPonteAttenduPeriode('Marans', start, end)
    // mai = 80, juin = 80 → moyenne ≈ 80 (légère pondération)
    expect(taux).toBeGreaterThan(75)
    expect(taux).toBeLessThan(85)
  })

  it("ne renvoie jamais l'absurdité « 8 % » en mai (BUG #5 régression)", () => {
    // L'ancien stats/route.ts:228 sortait ~8 % pour Marans en mai. On
    // s'assure que le nouveau helper ne peut PAS produire cette valeur.
    const start = new Date(2026, 4, 1)
    const end = new Date(2026, 4, 31)
    const taux = tauxPonteAttenduPeriode('Marans', start, end)
    expect(taux).toBeGreaterThan(70)
  })
})

describe('oeufsAttendusPeriode', () => {
  it('29 Marans sur 7 jours en mai → ≈ 162 œufs (29 × 0.8 × 7)', () => {
    const start = new Date(2026, 4, 1)
    const end = new Date(2026, 4, 7)
    const total = oeufsAttendusPeriode(29, 'Marans', start, end)
    expect(total).toBeGreaterThan(150)
    expect(total).toBeLessThan(175)
  })
})

describe('seuilCollecteMaxJour (BUG #2)', () => {
  it('29 Marans → seuil 32 œufs/jour (29 × 1.10 = 31.9 → ceil 32)', () => {
    expect(seuilCollecteMaxJour(29, 'Marans')).toBe(32)
  })

  it('20 canards → seuil 21 (canards marge 1.05)', () => {
    expect(seuilCollecteMaxJour(20, 'Canard')).toBe(21)
  })

  it('100 cailles → seuil 120 (caille marge 1.20)', () => {
    expect(seuilCollecteMaxJour(100, 'Caille')).toBe(120)
  })

  it('effectif 0 ou négatif → null (pas de seuil évaluable)', () => {
    expect(seuilCollecteMaxJour(0, 'Marans')).toBeNull()
    expect(seuilCollecteMaxJour(-1, 'Marans')).toBeNull()
    expect(seuilCollecteMaxJour(NaN, 'Marans')).toBeNull()
  })
})

describe('intégrité du référentiel', () => {
  it('toutes les races ont 12 valeurs mensuelles', () => {
    for (const key of Object.keys(TAUX_PONTE_PAR_MOIS) as Array<keyof typeof TAUX_PONTE_PAR_MOIS>) {
      expect(TAUX_PONTE_PAR_MOIS[key]).toHaveLength(12)
    }
  })

  it('toutes les races ont une marge cohérente entre 1.0 et 1.5', () => {
    for (const key of Object.keys(MARGE_COHERENCE_COLLECTE) as Array<keyof typeof MARGE_COHERENCE_COLLECTE>) {
      expect(MARGE_COHERENCE_COLLECTE[key]).toBeGreaterThanOrEqual(1)
      expect(MARGE_COHERENCE_COLLECTE[key]).toBeLessThan(1.5)
    }
  })

  it('aucune valeur de taux > 100 (% par jour, pas plus d\'1 œuf/poule)', () => {
    for (const key of Object.keys(TAUX_PONTE_PAR_MOIS) as Array<keyof typeof TAUX_PONTE_PAR_MOIS>) {
      for (const v of TAUX_PONTE_PAR_MOIS[key]) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(100)
      }
    }
  })
})
