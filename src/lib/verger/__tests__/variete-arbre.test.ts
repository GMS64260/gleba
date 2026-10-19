/**
 * QA 2026-10-19 — une variété personnelle (id = cuid) affectée à un arbre par
 * son nom n'était jamais retrouvée : la matrice de pollinisation la lisait par
 * son seul id et ignorait ses semaines de floraison.
 */
import { describe, expect, it } from "vitest"

import { choisirVarieteArbre, libelleVarieteOption, whereVarietesCandidates } from "../variete-arbre"

const ME = "user-1"
const perso = { id: "ckperso0001", nom: "Variété A", nomNormalise: "variete a", especeId: "Prunier", userId: ME }
const persoAutreEspece = { id: "ckperso0002", nom: "Variété A", nomNormalise: "variete a", especeId: "Pommier", userId: ME }
const officielle = { id: "Reine-Claude", nom: "Reine-Claude", nomNormalise: "reine claude", especeId: "Prunier", userId: null }
const partageeHomonyme = { id: "ckautre0001", nom: "Reine Claude", nomNormalise: "reine claude", especeId: "Prunier", userId: "user-2" }
const candidats = [perso, persoAutreEspece, officielle, partageeHomonyme]

describe("choisirVarieteArbre", () => {
  it("retrouve une variété personnelle par son nom dans l'espèce de l'arbre", () => {
    expect(choisirVarieteArbre({ variete: "Variété A", especeId: "Prunier", espece: "Prunier" }, candidats, ME)).toBe(perso)
  })

  it("ignore la casse, les accents et les tirets", () => {
    expect(choisirVarieteArbre({ variete: "variete-a", especeId: null, espece: "prunier" }, candidats, ME)).toBe(perso)
  })

  it("ne confond pas deux espèces qui portent une variété du même nom", () => {
    expect(choisirVarieteArbre({ variete: "Variété A", especeId: "Pommier", espece: "Pommier" }, candidats, ME)).toBe(persoAutreEspece)
  })

  it("l'id exact fait foi (variété officielle, ou cuid choisi dans la liste)", () => {
    expect(choisirVarieteArbre({ variete: "Reine-Claude", especeId: null, espece: null }, candidats, ME)).toBe(officielle)
    expect(choisirVarieteArbre({ variete: "ckperso0001", especeId: null, espece: null }, candidats, ME)).toBe(perso)
  })

  it("préfère l'officielle à une homonyme partagée par un autre membre", () => {
    expect(choisirVarieteArbre({ variete: "reine claude", especeId: "Prunier", espece: "Prunier" }, candidats, ME)).toBe(officielle)
  })

  it("sans espèce connue, un libellé seul ne désigne rien", () => {
    expect(choisirVarieteArbre({ variete: "Variété A", especeId: null, espece: null }, candidats, ME)).toBeNull()
  })

  it("sans variété saisie, rien", () => {
    expect(choisirVarieteArbre({ variete: "  ", especeId: "Prunier", espece: "Prunier" }, candidats, ME)).toBeNull()
  })
})

describe("whereVarietesCandidates", () => {
  it("cherche par id et par libellé normalisé, dans le référentiel visible de l'utilisateur", () => {
    const where = whereVarietesCandidates(
      [{ variete: "Variété A" }, { variete: "Variété A" }, { variete: null }],
      ME,
    )
    expect(where.AND[0]).toEqual({ OR: [{ userId: null }, { partageCommunaute: true }, { userId: ME }] })
    expect(where.AND[1]).toEqual({ OR: [{ id: { in: ["Variété A"] } }, { nomNormalise: { in: ["variete a"] } }] })
  })
})

describe("libelleVarieteOption", () => {
  it("propose le nom affiché, jamais l'id technique d'une variété personnelle", () => {
    expect(libelleVarieteOption(perso)).toBe("Variété A")
    expect(libelleVarieteOption({ id: "Golden", nom: null })).toBe("Golden")
  })
})
