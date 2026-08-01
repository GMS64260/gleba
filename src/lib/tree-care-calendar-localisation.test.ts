import { describe, expect, it } from "vitest"
import {
  TREE_CARE_PROFILES,
  findTreeCareProfile,
  generateCareOperations,
  getMonthlyCalendar,
} from "@/lib/tree-care-calendar"

describe("generateCareOperations — plancher anti-retards artificiels", () => {
  const olivier = findTreeCareProfile("Olivier")!

  it("génère toute l'année sans plancher", () => {
    const ops = generateCareOperations(olivier, 2026, 1, "user-1")
    expect(ops.length).toBe(olivier.operations.length)
  })

  it("omet les échéances antérieures au plancher (arbre créé en juillet)", () => {
    const from = new Date(2026, 6, 21) // 21 juillet
    const ops = generateCareOperations(olivier, 2026, 1, "user-1", null, from)
    expect(ops.length).toBeGreaterThan(0)
    expect(ops.length).toBeLessThan(olivier.operations.length)
    for (const op of ops) {
      expect(op.datePrevue.getTime()).toBeGreaterThanOrEqual(from.getTime())
    }
  })

  it("conserve une échéance le jour même du plancher", () => {
    const from = new Date(2026, 2, 15) // 15 mars = jour d'échéance générée
    const ops = generateCareOperations(olivier, 2026, 1, "user-1", null, from)
    expect(ops.some((op) => op.datePrevue.getTime() === from.getTime())).toBe(true)
  })
})

describe("calendrier d'entretien du verger", () => {
  it("utilise les libellés de mois français", () => {
    const calendrier = getMonthlyCalendar(TREE_CARE_PROFILES[0])

    expect(calendrier.map((mois) => mois.label)).toEqual([
      "Janv.",
      "Févr.",
      "Mars",
      "Avr.",
      "Mai",
      "Juin",
      "Juil.",
      "Août",
      "Sept.",
      "Oct.",
      "Nov.",
      "Déc.",
    ])
  })
})
