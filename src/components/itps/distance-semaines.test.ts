import { describe, expect, it } from "vitest"

import { distanceSemainesAvant } from "./distance-semaines"

describe("distanceSemainesAvant", () => {
  it("compte vers l'avant dans l'année", () => {
    expect(distanceSemainesAvant(10, 10, 52)).toBe(0)
    expect(distanceSemainesAvant(10, 13, 52)).toBe(3)
  })

  it("passe la fin d'une année à 52 semaines", () => {
    expect(distanceSemainesAvant(51, 2, 52)).toBe(3)
    expect(distanceSemainesAvant(52, 1, 52)).toBe(1)
  })

  it("compte la semaine 53 d'une année longue", () => {
    // Semaine 53 de 2026 (28/12/2026 → 03/01/2027) : la S1 est la SUIVANTE.
    expect(distanceSemainesAvant(53, 1, 53)).toBe(1)
    expect(distanceSemainesAvant(53, 3, 53)).toBe(3)
    // S51 de 2026 : S52, S53, puis S1 — trois semaines, pas deux.
    expect(distanceSemainesAvant(51, 1, 53)).toBe(3)
  })

  it("une semaine passée de peu est loin devant, pas derrière", () => {
    expect(distanceSemainesAvant(10, 9, 52)).toBe(51)
  })
})
