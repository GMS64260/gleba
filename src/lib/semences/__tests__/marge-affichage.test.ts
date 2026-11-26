import { describe, expect, it } from "vitest"
import {
  besoinGrainesSansMarge,
  statutSelonMarge,
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

// Équipe debug, D91 — marge désactivée, le statut restait celui du serveur,
// marge comprise : « Insuffisant » alors que le stock couvrait le besoin affiché.
describe("statutSelonMarge", () => {
  const besoin = { grainesNecessaires: 10.35, margeSecuritePct: 15, stockActuel: 9.68, statut: "LOW" as const }

  it("garde le statut du serveur quand la marge est comptée", () => {
    expect(statutSelonMarge(besoin, true)).toBe("LOW")
  })

  it("recalcule sans la marge : 9,68 g couvrent un besoin brut de 9 g", () => {
    expect(statutSelonMarge(besoin, false)).toBe("OK")
    expect(statutSelonMarge({ ...besoin, stockActuel: 8.9 }, false)).toBe("LOW")
    expect(statutSelonMarge({ ...besoin, stockActuel: 9 }, false)).toBe("OK")
    expect(statutSelonMarge({ ...besoin, stockActuel: 0, statut: "MISSING" as const }, false)).toBe("MISSING")
  })

  it("ne touche ni un besoin compté en unités, ni un statut sans comparaison de stock", () => {
    expect(statutSelonMarge(besoin, false, true)).toBe("LOW")
    expect(statutSelonMarge({ ...besoin, statut: "DONNEE_MANQUANTE" as const }, false)).toBe("DONNEE_MANQUANTE")
    expect(statutSelonMarge({ ...besoin, grainesNecessaires: 0 }, false)).toBe("LOW")
  })
})
