import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({ default: {} }))

import { findTreeCareProfile, generateCareOperations } from "@/lib/tree-care-calendar"
import { planCalendrierEntretien } from "../creation-arbre"

/**
 * Revue du 2026-10-25 (après le ticket cmvnopnsu) : la création appliquait le
 * plancher d'une plantation à venir et retirait la récolte d'un arbre non
 * productif ; la régénération (`generer-calendrier`) recalculait sans ces deux
 * règles. Une seule règle désormais, `planCalendrierEntretien`.
 */

const pommier = findTreeCareProfile("Pommier", "fruitier")!
const jour = (a: number, m: number, j: number) => new Date(a, m - 1, j)
const ARBRE = { id: 881, variete: null }

describe("règle unique du calendrier d'entretien", () => {
  it("le profil Pommier existe et prévoit une récolte", () => {
    expect(pommier).not.toBeNull()
    expect(pommier.operations.some((op) => op.type === "recolte")).toBe(true)
  })

  it("plantation à venir : aucune opération avant la plantation, année de la plantation", () => {
    const plantation = jour(2027, 3, 1)
    const { annee, operations } = planCalendrierEntretien(
      pommier,
      { ...ARBRE, datePlantation: plantation, productif: true },
      "u1",
      { maintenant: jour(2026, 10, 25) },
    )

    expect(annee).toBe(2027)
    expect(operations.length).toBeGreaterThan(0)
    for (const op of operations) expect(op.datePrevue.getTime()).toBeGreaterThanOrEqual(plantation.getTime())
  })

  it("arbre non productif : aucune récolte, qui revient quand il produit", () => {
    const arbre = { ...ARBRE, datePlantation: jour(2024, 3, 1) }
    const options = { maintenant: jour(2026, 3, 1) }

    const nonProductif = planCalendrierEntretien(pommier, { ...arbre, productif: false }, "u1", options)
    const productif = planCalendrierEntretien(pommier, { ...arbre, productif: true }, "u1", options)

    expect(nonProductif.operations.some((op) => op.type === "recolte")).toBe(false)
    expect(productif.operations.some((op) => op.type === "recolte")).toBe(true)
  })

  it("année en cours : aucune opération dont la fenêtre est déjà refermée", () => {
    const aujourdhui = jour(2026, 10, 25)
    const { annee, operations } = planCalendrierEntretien(
      pommier,
      { ...ARBRE, datePlantation: jour(2020, 3, 1), productif: true },
      "u1",
      { maintenant: aujourdhui },
    )

    expect(annee).toBe(2026)
    for (const op of operations) expect(op.dateLimite.getTime()).toBeGreaterThanOrEqual(aujourdhui.getTime())
  })

  it("année passée demandée explicitement : générée en entier", () => {
    const { annee, operations } = planCalendrierEntretien(
      pommier,
      { ...ARBRE, datePlantation: jour(2020, 3, 1), productif: true },
      "u1",
      { annee: 2025, maintenant: jour(2026, 10, 25) },
    )

    expect(annee).toBe(2025)
    expect(operations).toEqual(generateCareOperations(pommier, 2025, 881, "u1", null, null))
    expect(operations.some((op) => op.datePrevue.getMonth() === 0)).toBe(true)
  })
})
