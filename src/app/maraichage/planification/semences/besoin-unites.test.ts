import { describe, expect, it } from "vitest"

import { calculerBesoin } from "@/lib/semences/calcul"

import { besoinEnUnites, formatUnites } from "./besoin-unites"

/** Ligne telle que l'API la rend, à partir du calcul réel. */
function ligne(entree: Partial<Parameters<typeof calculerBesoin>[0]>) {
  const calc = calculerBesoin({ mode: "graine_directe", surfaceM2: 0, nbPlants: 0, ...entree })
  return {
    mode: calc.mode,
    grainesNecessaires: calc.besoinGrammes,
    besoinCaieux: calc.besoinCaieux,
    caieuxACommander: calc.manqueCaieux,
  }
}

describe("besoin de semences compté en unités", () => {
  it("plant repiqué en graines/godet sans graines/g : des graines, pas « 0 g »", () => {
    const b = ligne({ mode: "plant_repique", nbPlants: 60, uniteDose: "graines_plant", doseGParM2: 2, grainesParGramme: null, margeSecuritePct: 10 })
    expect(b.grainesNecessaires).toBe(0)

    const unites = besoinEnUnites(b)
    expect(unites).not.toBeNull()
    expect(formatUnites(unites!.quantite, unites!)).toBe("132 graines")
    expect(formatUnites(unites!.aCommander, unites!)).toBe("132 graines")
  })

  it("semis direct dosé en plants/m² : des plants", () => {
    const b = ligne({ mode: "graine_directe", surfaceM2: 10, uniteDose: "pieces_m2", doseGParM2: 4, margeSecuritePct: 0, stockUnites: 39 })
    const unites = besoinEnUnites(b)
    expect(formatUnites(unites!.quantite, unites!)).toBe("40 plants")
    expect(formatUnites(unites!.aCommander, unites!)).toBe("1 plant")
  })

  it("un besoin en grammes reste en grammes", () => {
    const b = ligne({ mode: "graine_directe", surfaceM2: 10, uniteDose: "g_m2", doseGParM2: 2 })
    expect(b.grainesNecessaires).toBeGreaterThan(0)
    expect(besoinEnUnites(b)).toBeNull()
  })

  it("ne concerne pas les bulbilles, qui ont leur onglet en unités", () => {
    expect(besoinEnUnites({ mode: "bulbe_caieu", grainesNecessaires: 0, besoinCaieux: 100, caieuxACommander: 100 })).toBeNull()
  })
})
