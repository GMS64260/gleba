import { describe, expect, it } from "vitest"
import {
  listerCiblesCollecteLait,
  plafondCollecteLait,
} from "./cibles-collecte-lait"

describe("cibles de collecte de lait", () => {
  it("ne conserve que les femelles et lots de production laitière ou mixte", () => {
    const animaux = [
      { id: 1, sexe: "femelle", especeAnimale: { nom: "Brebis", production: "viande" } },
      { id: 2, sexe: "femelle", especeAnimale: { nom: "Chèvre", production: "lait" } },
      { id: 3, sexe: "femelle", especeAnimale: { nom: "Vache", production: "mixte" } },
      { id: 4, sexe: "male", especeAnimale: { nom: "Chèvre", production: "lait" } },
      { id: 5, sexe: "femelle", orientationProduction: "lait", especeAnimale: { nom: "Brebis", production: "viande" } },
      { id: 6, sexe: "femelle", orientationProduction: "mixte", especeAnimale: { nom: "Poule pondeuse", production: "oeufs", productions: ["Oeufs"] } },
    ]
    const lots = [
      { id: 4, especeAnimale: { nom: "Ovins", production: "laine" } },
      { id: 5, especeAnimale: { nom: "Caprins", production: "lait" } },
    ]

    const result = listerCiblesCollecteLait(animaux, lots)
    expect(result.animaux.map((animal) => animal.id)).toEqual([2, 3, 5])
    expect(result.lots.map((lot) => lot.id)).toEqual([5])
  })

  it("exclut chien, mâle et sexe inconnu même si le client forge la liste", () => {
    const animaux = [
      { id: 1, nom: "Rex", sexe: "male", especeAnimale: { nom: "Chien", production: "compagnie" } },
      { id: 2, nom: "Myrtille", sexe: "femelle", especeAnimale: { nom: "Chèvre", production: "lait" } },
      { id: 3, nom: "Indéterminé", sexe: "inconnu", especeAnimale: { nom: "Chèvre", production: "lait" } },
      { id: 4, nom: "Chienne", sexe: "femelle", especeAnimale: { nom: "Chien", production: "compagnie" } },
    ]
    const lots = [{ id: 9, nom: "Lot chèvres", especeAnimale: { production: "lait" } }]

    const r = listerCiblesCollecteLait(animaux, lots)
    expect(r.animaux.map((a) => a.id)).toEqual([2])
    expect(r.lots).toEqual(lots)
  })

  it("normalise les réponses absentes en listes vides", () => {
    expect(listerCiblesCollecteLait(undefined, null)).toEqual({ animaux: [], lots: [] })
  })

  it("applique un plafond indicatif par espèce et par effectif", () => {
    expect(plafondCollecteLait("Chèvre Alpine", "animal")).toBe(8)
    expect(plafondCollecteLait("Brebis Lacaune", "animal")).toBe(5)
    expect(plafondCollecteLait("Vache Normande", "lot", 12)).toBe(360)
  })
})
