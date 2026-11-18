import { describe, expect, it } from "vitest"

import { placerPlants } from "@/components/garden/garden3d/procedural"
import { empreintePlantMetres } from "./unites-plants"

describe("empreintePlantMetres", () => {
  it("convertit les 25 cm d'une laitue sans étalement en 0,25 m", () => {
    expect(empreintePlantMetres({ espece: { etalement: null }, espacement: 25, itp: { espacement: 30 } })).toBe(0.25)
  })

  it("convertit les 30 cm de l'ITP sans espacement de culture en 0,30 m", () => {
    expect(empreintePlantMetres({ espacement: null, itp: { espacement: 30 } })).toBe(0.3)
  })

  it("donne priorité à l'étalement de l'espèce déjà en mètres", () => {
    expect(empreintePlantMetres({ espece: { etalement: 0.6 }, espacement: 25, itp: { espacement: 30 } })).toBe(0.6)
  })

  it("utilise 0,3 m quand toutes les dimensions sont absentes", () => {
    expect(empreintePlantMetres({})).toBe(0.3)
  })

  it.each([null, undefined, 0, -25, NaN, Infinity, -Infinity])("ignore la dimension invalide %s à chaque niveau", (valeur) => {
    expect(empreintePlantMetres({ espece: { etalement: valeur }, espacement: 25 })).toBe(0.25)
    expect(empreintePlantMetres({ espece: { etalement: valeur }, espacement: valeur, itp: { espacement: 30 } })).toBe(0.3)
    expect(empreintePlantMetres({ espece: { etalement: valeur }, espacement: valeur, itp: { espacement: valeur } })).toBe(0.3)
  })
})

describe("placement 3D d'une laitue à maturité", () => {
  it("garde des diamètres de 0,25 m au plus sur une planche de 1,7 × 5 m", () => {
    const empreinte = empreintePlantMetres({ espece: { etalement: null }, espacement: 25 })
    const plants = placerPlants(1.7, 5, empreinte, 1, 1)

    expect(plants.length).toBeGreaterThan(1)
    for (const plant of plants) {
      expect(Number.isFinite(plant.r)).toBe(true)
      expect(plant.r * 2).toBeLessThanOrEqual(0.25)
      expect(plant.r * 2).toBeLessThanOrEqual(1.7)
    }
  })
})
