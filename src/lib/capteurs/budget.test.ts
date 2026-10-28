import { beforeEach, describe, expect, it } from "vitest"
import { consommerBudgets, viderBudgets } from "./budget"

const QUART = 15 * 60 * 1000

describe("consommerBudgets", () => {
  beforeEach(() => viderBudgets())

  it("accorde jusqu'au plafond, refuse au-delà, et dit quand réessayer", () => {
    expect(consommerBudgets([{ cle: "a", quantite: 590, max: 600 }], QUART, 0).ok).toBe(true)
    expect(consommerBudgets([{ cle: "a", quantite: 10, max: 600 }], QUART, 1000).ok).toBe(true)
    const refus = consommerBudgets([{ cle: "a", quantite: 1, max: 600 }], QUART, 60_000)
    expect(refus).toEqual({ ok: false, reessayerDansS: 840 })
  })

  it("repart à zéro à la fenêtre suivante", () => {
    consommerBudgets([{ cle: "a", quantite: 600, max: 600 }], QUART, 0)
    expect(consommerBudgets([{ cle: "a", quantite: 600, max: 600 }], QUART, QUART).ok).toBe(true)
  })

  it("tout ou rien : un refus sur une clé ne consomme pas l'autre", () => {
    consommerBudgets([{ cle: "compte", quantite: 3000, max: 3000 }], QUART, 0)
    expect(consommerBudgets([{ cle: "connecteur", quantite: 20, max: 600 }, { cle: "compte", quantite: 1, max: 3000 }], QUART, 0).ok).toBe(false)
    expect(consommerBudgets([{ cle: "connecteur", quantite: 600, max: 600 }], QUART, 0).ok).toBe(true)
  })
})
