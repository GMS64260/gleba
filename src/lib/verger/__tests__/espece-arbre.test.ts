import { describe, expect, it } from "vitest"
import { choisirEspeceArbre, parcelleParDefautArbre, type EspeceCandidate } from "../espece-arbre"
import { planCopiesArbre } from "../duplication-arbre"

const officiel = (id: string, type = "arbre_fruitier"): EspeceCandidate => ({ id, nom: id, userId: null, type })

describe("choisirEspeceArbre", () => {
  const catalogue = [officiel("Kiwi", "petit_fruit"), officiel("Pommier"), officiel("Pêcher"), officiel("Prunier")]

  it("rattache une saisie en minuscules au nom canonique du catalogue (cas réel 2026-10-05)", () => {
    expect(choisirEspeceArbre("kiwi", catalogue, "u1")).toEqual({ espece: "Kiwi", especeId: "Kiwi", horsCatalogue: false })
    expect(choisirEspeceArbre("  pommier ", catalogue, "u1").espece).toBe("Pommier")
  })

  it("ignore les accents", () => {
    expect(choisirEspeceArbre("pecher", catalogue, "u1").especeId).toBe("Pêcher")
  })

  it("garde une saisie hors catalogue, signalée", () => {
    expect(choisirEspeceArbre("asiminier", catalogue, "u1")).toEqual({
      espece: "asiminier",
      especeId: null,
      horsCatalogue: true,
    })
  })

  it("préfère l'espèce personnelle de l'utilisateur à l'officielle homonyme", () => {
    const perso: EspeceCandidate = { id: "cuid1", nom: "Pommier", userId: "u1", type: "arbre_fruitier" }
    expect(choisirEspeceArbre("pommier", [...catalogue, perso], "u1").especeId).toBe("cuid1")
  })
})

describe("parcelleParDefautArbre", () => {
  const p = (id: string, couches: string[] = [], usage: string | null = null) => ({ id, couches, usage })

  it("rattache à la seule parcelle du compte", () => {
    expect(parcelleParDefautArbre([p("a")])).toBe("a")
  })

  it("rattache à la seule parcelle Verger parmi plusieurs", () => {
    expect(parcelleParDefautArbre([p("a", [], "culture"), p("b", ["VERGER"])])).toBe("b")
  })

  it("ne devine pas quand plusieurs parcelles sont possibles", () => {
    expect(parcelleParDefautArbre([p("a"), p("b")])).toBeNull()
    expect(parcelleParDefautArbre([p("a", ["VERGER"]), p("b", [], "verger")])).toBeNull()
    expect(parcelleParDefautArbre([])).toBeNull()
  })
})

describe("planCopiesArbre", () => {
  it("numérote depuis le nom de base et aligne à droite d'une envergure", () => {
    const plan = planCopiesArbre({ nom: "Kiwi (2)", posX: 2, posY: 5, envergure: 3 }, 2, ["Kiwi", "Kiwi (2)"])
    expect(plan).toEqual([
      { nom: "Kiwi (3)", posX: 5.5, posY: 5 },
      { nom: "Kiwi (4)", posX: 9, posY: 5 },
    ])
  })

  it("borne le nombre de copies", () => {
    expect(planCopiesArbre({ nom: "A", posX: 0, posY: 0, envergure: 1 }, 99, [])).toHaveLength(20)
    expect(planCopiesArbre({ nom: "A", posX: 0, posY: 0, envergure: 1 }, 0, [])).toHaveLength(1)
  })
})
