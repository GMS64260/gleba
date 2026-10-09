import { describe, expect, it } from "vitest"

import { appliquerElementsAuPlan, calculerCadre, compterEtats } from "./plan-vignette"
import type { PlanVignetteDonnees } from "./types"

const vide: PlanVignetteDonnees = { planches: [], arbres: [], objets: [] }

describe("calculerCadre", () => {
  it("rend un cadre par défaut quand rien n'est placé", () => {
    const cadre = calculerCadre(vide)
    expect(cadre.largeur).toBeGreaterThan(0)
    expect(cadre.hauteur).toBeGreaterThan(0)
  })

  it("englobe planches, arbres et objets avec une marge", () => {
    const cadre = calculerCadre(
      {
        planches: [{ id: "p", nom: "A1", posX: 2, posY: 3, largeur: 0.8, longueur: 10, rotation2D: 0, etat: "libre" }],
        arbres: [{ id: 1, posX: 20, posY: 5, envergure: 4 }],
        objets: [{ id: 1, type: "serre", posX: -4, posY: 0, largeur: 3, longueur: 6, rotation2D: 0 }],
      },
      1,
    )
    // serre : centre (-2.5, 3), rayon = demi-diagonale ≈ 3.35 → x min ≈ -5.85
    expect(cadre.x).toBeCloseTo(-6.85, 1)
    expect(cadre.y).toBeCloseTo(-1.35, 1)
    expect(cadre.x + cadre.largeur).toBeCloseTo(23, 5) // arbre : 20 + 2 + marge
    expect(cadre.y + cadre.hauteur).toBeCloseTo(14, 5) // planche : 3 + 10 + marge
  })

  it("une planche tournée est couverte par sa demi-diagonale", () => {
    const droite = calculerCadre(
      { ...vide, planches: [{ id: "p", nom: "A1", posX: 0, posY: 0, largeur: 1, longueur: 10, rotation2D: 0, etat: "libre" }] },
      0,
    )
    const tournee = calculerCadre(
      { ...vide, planches: [{ id: "p", nom: "A1", posX: 0, posY: 0, largeur: 1, longueur: 10, rotation2D: 90, etat: "libre" }] },
      0,
    )
    expect(droite.largeur).toBe(1)
    expect(tournee.largeur).toBeGreaterThan(10)
  })
})

describe("compterEtats", () => {
  it("compte chaque état", () => {
    const base = { nom: "x", posX: 0, posY: 0, largeur: 1, longueur: 1, rotation2D: 0 }
    expect(
      compterEtats({
        ...vide,
        planches: [
          { ...base, id: "1", etat: "arroser" },
          { ...base, id: "2", etat: "arroser" },
          { ...base, id: "3", etat: "recolter" },
          { ...base, id: "4", etat: "en-place" },
          { ...base, id: "5", etat: "libre" },
        ],
      }),
    ).toEqual({ arroser: 2, recolter: 1, enPlace: 1, libre: 1 })
  })
})

describe("appliquerElementsAuPlan", () => {
  const base = { nom: "x", posX: 0, posY: 0, largeur: 1, longueur: 1, rotation2D: 0 }
  const plan = {
    ...vide,
    planches: [
      { ...base, id: "a", etat: "arroser" as const },
      { ...base, id: "b", etat: "recolter" as const },
      { ...base, id: "c", etat: "libre" as const },
    ],
  }

  it("une planche dont plus aucune ligne ne parle passe en place, les autres restent", () => {
    const repeint = appliquerElementsAuPlan(plan, [{ plancheIds: ["b"] }])
    expect(repeint.planches.map((p) => p.etat)).toEqual(["en-place", "recolter", "libre"])
    expect(plan.planches[0].etat).toBe("arroser") // jamais modifié
  })

  it("avec les lignes d'origine, rien ne change", () => {
    const repeint = appliquerElementsAuPlan(plan, [{ plancheIds: ["a"] }, { plancheIds: ["b"] }])
    expect(repeint.planches.map((p) => p.etat)).toEqual(["arroser", "recolter", "libre"])
  })
})
