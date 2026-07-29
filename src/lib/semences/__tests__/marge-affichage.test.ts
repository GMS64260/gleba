import { describe, expect, it } from "vitest"
import {
  besoinGrainesSansMarge,
  totalGrainesACommander,
} from "@/lib/semences/calcul"

describe("affichage des besoins avec ou sans marge", () => {
  const besoins = [
    {
      grainesNecessaires: 20.7,
      margeSecuritePct: 15,
      stockActuel: 0,
    },
    {
      grainesNecessaires: 0.345,
      margeSecuritePct: 15,
      stockActuel: 0,
    },
  ]

  it("reconstitue le besoin brut d'une ligne", () => {
    expect(besoinGrainesSansMarge(besoins[0])).toBeCloseTo(18)
  })

  it("fait suivre le total à commander au sélecteur de marge", () => {
    expect(totalGrainesACommander(besoins, true)).toBeCloseTo(21.045)
    expect(totalGrainesACommander(besoins, false)).toBeCloseTo(18.3)
  })

  it("déduit le stock sans produire de quantité négative", () => {
    expect(totalGrainesACommander([
      { grainesNecessaires: 11.5, margeSecuritePct: 15, stockActuel: 12 },
      { grainesNecessaires: 5.75, margeSecuritePct: 15, stockActuel: 2 },
    ], false)).toBeCloseTo(3)
  })
})
