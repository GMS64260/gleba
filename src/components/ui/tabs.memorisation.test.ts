import { describe, expect, it } from "vitest"
import { ongletAMemoriser } from "./tabs"

// Équipe debug, D254 : un onglet choisi par une carte de l'écran doit rester choisi au rechargement.
describe("mémorisation d'un onglet changé par le code de l'écran", () => {
  const onglets = ["all", "volailles", "caprins"]
  const cle = "gleba:tabs:/elevage:all|volailles|caprins:user:u1"

  it("mémorise le retour à « Tous » déclenché par une carte", () => {
    expect(ongletAMemoriser({ cle, valeur: "volailles" }, cle, "all", onglets)).toBe(true)
  })

  it("laisse la restauration décider à la première passe avec une clé", () => {
    // Session encore en chargement au premier rendu : la clé n'existait pas.
    expect(ongletAMemoriser({ cle: null, valeur: "all" }, cle, "all", onglets)).toBe(false)
    expect(ongletAMemoriser({ cle: null, valeur: undefined }, cle, "volailles", onglets)).toBe(false)
  })

  it("n'écrit rien sans changement, ni pour une valeur qui n'est pas un onglet", () => {
    expect(ongletAMemoriser({ cle, valeur: "all" }, cle, "all", onglets)).toBe(false)
    expect(ongletAMemoriser({ cle, valeur: "all" }, cle, "inconnu", onglets)).toBe(false)
  })
})
