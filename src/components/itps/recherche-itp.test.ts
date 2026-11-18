import { describe, expect, it } from "vitest"

import { correspondRechercheItp, texteRechercheItp } from "./recherche-itp"

const MACHE = {
  id: "cmitp123",
  nom: "Mâche d'hiver — sous-abri",
  especeId: "cmespece9",
  espece: { nom: "Mâche à grosse graine" },
}

describe("recherche d'un ITP dans les calendriers", () => {
  const texte = texteRechercheItp(MACHE)

  it("ignore accents, casse et ponctuation", () => {
    expect(correspondRechercheItp(texte, "mache")).toBe(true)
    expect(correspondRechercheItp(texte, "MÂCHE")).toBe(true)
    expect(correspondRechercheItp(texte, "sous abri")).toBe(true)
  })

  it("cherche aussi dans le nom de l'espèce", () => {
    expect(correspondRechercheItp(texte, "grosse graine")).toBe(true)
  })

  it("ne fait pas correspondre une saisie à cheval sur deux champs", () => {
    expect(correspondRechercheItp(texte, "abri cmespece9")).toBe(false)
  })

  it("ne filtre rien pour une saisie vide ou réduite à de la ponctuation", () => {
    expect(correspondRechercheItp(texte, "")).toBe(true)
    expect(correspondRechercheItp(texte, " - ")).toBe(true)
  })

  it("écarte ce qui ne correspond pas, et tolère les champs absents", () => {
    expect(correspondRechercheItp(texte, "tomate")).toBe(false)
    expect(texteRechercheItp({ id: "Radis-ete", nom: null, especeId: null, espece: null })).toBe("radis ete")
  })
})
