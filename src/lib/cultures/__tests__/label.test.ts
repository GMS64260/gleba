import { describe, expect, it } from "vitest"

import { libelleCulture, libelleEspeceVariete } from "../label"

describe("libelleCulture", () => {
  it("résout les relations Prisma au lieu d'afficher [object Object]", () => {
    const libelle = libelleCulture({
      espece: { id: "Blette", nom: "Blette" },
      variete: { id: "Verte à carde blanche", nom: "Verte à carde blanche" },
      planche: { nom: "Marc-Codex-3007-64200" },
    })

    expect(libelle).toBe("Blette (Verte à carde blanche) — Marc-Codex-3007-64200")
    expect(libelle).not.toContain("[object Object]")
  })

  it("retombe sur l'identifiant quand la relation n'a pas de nom", () => {
    expect(libelleCulture({ espece: { id: "Tomate" }, planche: { id: "A1" } })).toBe("Tomate — A1")
  })

  it("accepte des champs déjà aplatis en chaînes", () => {
    expect(libelleCulture({ espece: "Carotte", variete: "Nantaise", plancheId: "B1" }))
      .toBe("Carotte (Nantaise) — B1")
  })

  it("utilise les identifiants scalaires quand les relations sont absentes", () => {
    expect(libelleCulture({ especeId: "Radis", varieteId: "De 18 jours" }))
      .toBe("Radis (De 18 jours)")
  })

  it("omet la variété quand elle répète l'espèce", () => {
    expect(libelleCulture({ espece: "Épinard", variete: "Épinard", plancheId: "C2" }))
      .toBe("Épinard — C2")
  })

  it("reste lisible sans aucune donnée exploitable", () => {
    expect(libelleCulture({})).toBe("Culture")
    expect(libelleCulture({ espece: null, variete: null, planche: null })).toBe("Culture")
  })

  it("n'affiche pas de séparateur orphelin sans planche", () => {
    const libelle = libelleCulture({ espece: "Blette" })
    expect(libelle).toBe("Blette")
    expect(libelle).not.toContain("—")
  })
})

describe("libelleEspeceVariete (QA cmv2ex2vq)", () => {
  it("tait la variété de repli « Non spécifiée »", () => {
    expect(libelleEspeceVariete("Radis", "Radis — Non spécifiée")).toBe("Radis")
    expect(libelleEspeceVariete("Radis", null)).toBe("Radis")
  })

  it("ne répète pas l'espèce que le nom de variété contient déjà", () => {
    expect(libelleEspeceVariete("Courge butternut", "Courge butternut-Waltham")).toBe("Courge butternut-Waltham")
    expect(libelleEspeceVariete("Pêcher", "pecher de vigne")).toBe("pecher de vigne")
    expect(libelleEspeceVariete("Radis", "Radis")).toBe("Radis")
  })

  it("joint espèce et variété sinon", () => {
    expect(libelleEspeceVariete("Aubergine", "Violette longue")).toBe("Aubergine · Violette longue")
  })
})

describe("libelleEspeceVariete — préfixe en mot entier (revue)", () => {
  it("ne prend pas une variété qui commence par l'espèce au milieu d'un mot", () => {
    expect(libelleEspeceVariete("Courge", "Courgette ronde")).toBe("Courge · Courgette ronde")
    expect(libelleEspeceVariete("Ail", "Ailette")).toBe("Ail · Ailette")
    expect(libelleEspeceVariete("Courge", "Courge musquée")).toBe("Courge musquée")
  })
})
