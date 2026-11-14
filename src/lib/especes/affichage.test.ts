import { describe, expect, it } from "vitest"
import { origineBadge, nomEspece } from "./affichage"

describe("origineBadge", () => {
  it("identifie une espèce du compte courant", () => {
    expect(origineBadge({ userId: "moi" }, "moi")?.label).toBe("Perso")
  })
  it("identifie une espèce d'un autre compte", () => {
    expect(origineBadge({ userId: "autre" }, "moi")?.label).toBe("Communauté")
  })
  it("ne donne aucun badge à une espèce officielle", () => {
    expect(origineBadge({ userId: null }, "moi")).toBeNull()
  })
  it.each([undefined, null, ""])("ne devine pas l'origine sans compte courant (%s)", (compte) => {
    expect(origineBadge({ userId: "moi" }, compte)).toBeNull()
  })
})

describe("nomEspece", () => {
  it("affiche le nom d'une espèce privée plutôt que son identifiant technique", () => {
    expect(nomEspece({ id: "cm-identifiant-technique", nom: "Tomate de la ferme" })).toBe("Tomate de la ferme")
  })
  it("garde l'identifiant lisible d'une espèce officielle", () => {
    expect(nomEspece({ id: "Tomate", nom: null })).toBe("Tomate")
  })
})
