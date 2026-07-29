import { describe, expect, it } from "vitest"
import { libelleForesterie } from "@/lib/verger/libelles-foresterie"

describe("libelleForesterie", () => {
  it.each([
    ["resineux", "Résineux"],
    ["tres_rapide", "Très rapide"],
    ["biodiversite", "Biodiversité"],
    ["Biodiversite", "Biodiversité"],
    ["bois_oeuvre", "Bois d’œuvre"],
    ["bois oeuvre", "Bois d’œuvre"],
    ["BRF", "BRF"],
  ])("transforme %s en libellé métier", (valeur, attendu) => {
    expect(libelleForesterie(valeur)).toBe(attendu)
  })
})
