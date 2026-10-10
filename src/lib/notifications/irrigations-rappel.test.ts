/**
 * Refonte de l'arrosage (2026-10-10) : un courriel d'arrosage ne part plus pour
 * un passage planifié en retard, seulement pour une planche dont le bilan
 * hydrique est critique aujourd'hui.
 */
import { describe, expect, it } from "vitest"
import {
  MAX_RAPPELS_IRRIGATIONS,
  creerCleRappelIrrigation,
  rappelsArrosageCritique,
  type ArrosageCritiqueInput,
} from "./detect"

const AUJOURDHUI = new Date(2026, 9, 10, 9, 0)

function arrosage(overrides: Partial<ArrosageCritiqueInput> = {}): ArrosageCritiqueInput {
  return {
    cle: "planche:p1",
    plancheNom: "A3",
    especes: "Tomate + Basilic",
    urgence: "critique",
    raison: "Déficit hydrique de 22mm. 6j sans eau. Pas de pluie prévue.",
    ...overrides,
  }
}

describe("rappelsArrosageCritique", () => {
  it("rappelle une planche critique avec sa raison", () => {
    const rappels = rappelsArrosageCritique([arrosage()], AUJOURDHUI)
    expect(rappels).toEqual([
      {
        type: "irrigation-rappel",
        titre: "arrosage planche A3",
        message:
          "La planche A3 (Tomate + Basilic) est à arroser aujourd'hui : Déficit hydrique de 22mm. 6j sans eau. Pas de pluie prévue.",
        key: "irrigation-rappel:planche:p1:2026-10-10",
      },
    ])
  })

  it("n'envoie rien pour une urgence haute : elle reste dans les tâches du jour", () => {
    expect(rappelsArrosageCritique([arrosage({ urgence: "haute" })], AUJOURDHUI)).toEqual([])
  })

  it("plafonne le nombre de rappels par scan", () => {
    const nombreux = Array.from({ length: MAX_RAPPELS_IRRIGATIONS + 3 }, (_, i) => arrosage({ cle: `planche:p${i}` }))
    expect(rappelsArrosageCritique(nombreux, AUJOURDHUI)).toHaveLength(MAX_RAPPELS_IRRIGATIONS)
  })

  it("une planche reçoit au plus un rappel par jour (clé datée)", () => {
    expect(creerCleRappelIrrigation("planche:p1", AUJOURDHUI)).toBe("irrigation-rappel:planche:p1:2026-10-10")
    expect(creerCleRappelIrrigation("planche:p1", new Date(2026, 9, 11))).toBe("irrigation-rappel:planche:p1:2026-10-11")
  })
})
