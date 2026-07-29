import { describe, expect, it } from "vitest"

import {
  isRotationActiveNonApplied,
  isRotationIncomplete,
} from "./rotation-status"

describe("statut d'une rotation", () => {
  it("ne compte pas une rotation vide parmi les rotations actives non appliquées", () => {
    const rotation = { active: true, details: [], _count: { planches: 0 } }

    expect(isRotationIncomplete(rotation)).toBe(true)
    expect(isRotationActiveNonApplied(rotation)).toBe(false)
  })

  it("compte une rotation définie sans planche comme active non appliquée", () => {
    const rotation = {
      active: true,
      details: [{ annee: 1 }],
      _count: { planches: 0 },
    }

    expect(isRotationIncomplete(rotation)).toBe(false)
    expect(isRotationActiveNonApplied(rotation)).toBe(true)
  })
})
