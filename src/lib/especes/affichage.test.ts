import { describe, expect, it } from "vitest"
import { origineBadge, nomEspece } from "./affichage"

describe("origineBadge", () => {
  it("affiche Perso selon l'origine calculée par le serveur, sans identité de l'acteur", () => {
    expect(origineBadge({ origine: "perso" })).toEqual({ label: "Perso", cls: "bg-amber-100 text-amber-700" })
  })
  it("affiche Communauté selon l'origine calculée par le serveur", () => {
    expect(origineBadge({ origine: "communaute" })).toEqual({ label: "Communauté", cls: "bg-sky-100 text-sky-700" })
  })
  it("ne donne aucun badge à une espèce officielle", () => {
    expect(origineBadge({ origine: null })).toBeNull()
  })
  it("ne devine pas l'origine si le serveur ne l'a pas fournie", () => {
    expect(origineBadge({})).toBeNull()
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
