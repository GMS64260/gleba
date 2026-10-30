import { beforeEach, describe, expect, it } from "vitest"
import { budgetEpuise, consommerBudgets, consommerOuEspacer, rendreBudget, viderBudgets } from "./budget"

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

describe("consommerOuEspacer (plafond à débit limité)", () => {
  const INTERVALLE = 10_000
  beforeEach(() => viderBudgets())

  it("sous le plafond, prend une unité d'avance ; au plafond, un passage par intervalle compté depuis le dernier", () => {
    expect(consommerOuEspacer("ip", 2, QUART, INTERVALLE, 0)).toEqual({ ok: true, unite: true })
    expect(consommerOuEspacer("ip", 2, QUART, INTERVALLE, 1000)).toEqual({ ok: true, unite: true })
    // Plafond atteint par le passage de 1 s : le suivant attend 11 s.
    expect(consommerOuEspacer("ip", 2, QUART, INTERVALLE, 1000)).toEqual({ ok: false, reessayerDansS: 10 })
    expect(consommerOuEspacer("ip", 2, QUART, INTERVALLE, 10_500)).toEqual({ ok: false, reessayerDansS: 1 })
    expect(consommerOuEspacer("ip", 2, QUART, INTERVALLE, 11_000)).toEqual({ ok: true, unite: false })
    expect(consommerOuEspacer("ip", 2, QUART, INTERVALLE, 11_000)).toEqual({ ok: false, reessayerDansS: 10 })
    // Une autre clé n'est pas concernée.
    expect(consommerOuEspacer("autre", 2, QUART, INTERVALLE, 11_000)).toEqual({ ok: true, unite: true })
  })

  it("annonce la fin de la fenêtre quand elle précède le prochain passage, puis repart de zéro", () => {
    consommerOuEspacer("ip", 1, QUART, INTERVALLE, 0)
    expect(consommerOuEspacer("ip", 1, QUART, INTERVALLE, QUART - 3000)).toEqual({ ok: true, unite: false })
    expect(consommerOuEspacer("ip", 1, QUART, INTERVALLE, QUART - 2000)).toEqual({ ok: false, reessayerDansS: 2 })
    expect(consommerOuEspacer("ip", 1, QUART, INTERVALLE, QUART)).toEqual({ ok: true, unite: true })
  })

  it("rendreBudget libère l'unité prise d'avance sans descendre sous zéro", () => {
    consommerOuEspacer("ip", 1, QUART, INTERVALLE, 0)
    expect(budgetEpuise("ip", 1, 0)).toBe(900)
    rendreBudget("ip", 5, 0)
    expect(budgetEpuise("ip", 1, 0)).toBeNull()
    expect(consommerOuEspacer("ip", 1, QUART, INTERVALLE, 0)).toEqual({ ok: true, unite: true })
    expect(budgetEpuise("ip", 1, 0)).toBe(900)
  })
})
