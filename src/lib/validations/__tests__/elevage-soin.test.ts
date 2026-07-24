import { describe, expect, it } from "vitest"
import { soinPatchSchema } from "../elevage-soin"

describe("soinPatchSchema", () => {
  it("refuse les nombres et intervalles hors bornes", () => {
    expect(soinPatchSchema.safeParse({ id: 1, nbInjections: 31, intervalleInjectionsHeures: 24 }).success).toBe(false)
    expect(soinPatchSchema.safeParse({ id: 1, nbInjections: 3, intervalleInjectionsHeures: -1 }).success).toBe(false)
  })

  it("exige un intervalle pour plusieurs injections", () => {
    expect(soinPatchSchema.safeParse({ id: 1, nbInjections: 3, intervalleInjectionsHeures: null }).success).toBe(false)
  })
})
