import { describe, expect, it } from "vitest"

import {
  IDS_REPERES,
  IDS_TUILES,
  deplacer,
  dispositionDefaut,
  masques,
  memeDisposition,
  remettre,
  retirer,
  sanitizeAccueilDisposition,
  visiblesSelonModules,
} from "./disposition"

describe("sanitizeAccueilDisposition", () => {
  it("ignore les identifiants inconnus et les doublons, garde l'ordre", () => {
    const d = sanitizeAccueilDisposition({
      reperes: ["repere:semaine", "repere:inconnu", "repere:cultures", "repere:semaine"],
      tuiles: ["plan", "aujourdhui", "plan", 42],
    })
    expect(d.reperes).toEqual(["repere:semaine", "repere:cultures"])
    expect(d.tuiles).toEqual(["plan", "aujourdhui"])
  })

  it("une liste vide est permise, une liste absente revient au défaut", () => {
    expect(sanitizeAccueilDisposition({ reperes: [], tuiles: ["agent"] })).toEqual({ reperes: [], tuiles: ["agent"] })
    expect(sanitizeAccueilDisposition({ tuiles: ["agent"] }).reperes).toEqual([...IDS_REPERES])
    expect(sanitizeAccueilDisposition(null)).toEqual(dispositionDefaut())
    expect(sanitizeAccueilDisposition("v2")).toEqual(dispositionDefaut())
  })
})

describe("modules", () => {
  it("un module désactivé masque ses tuiles et repères à l'affichage sans toucher la liste", () => {
    const d = dispositionDefaut()
    expect(visiblesSelonModules(d.tuiles, ["maraichage"])).toEqual(["aujourdhui", "plan", "semaine", "agent"])
    expect(visiblesSelonModules(d.reperes, ["elevage"])).toEqual(["repere:semaine"])
    expect(d.tuiles).toEqual([...IDS_TUILES])
  })

  it("masques : ce qu'on peut remettre, hors modules désactivés", () => {
    expect(masques(IDS_TUILES, ["aujourdhui", "plan"], ["maraichage", "elevage"])).toEqual(["semaine", "agent", "elevage"])
    expect(masques(IDS_TUILES, ["aujourdhui", "plan"], ["maraichage"])).toEqual(["semaine", "agent"])
  })
})

describe("déplacer, retirer, remettre", () => {
  it("déplace d'un cran et s'arrête aux bords", () => {
    expect(deplacer(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"])
    expect(deplacer(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"])
    expect(deplacer(["a", "b", "c"], "x", 1)).toEqual(["a", "b", "c"])
  })

  it("retire puis remet à sa place de référence", () => {
    const sans = retirer([...IDS_TUILES], "plan")
    expect(sans).toEqual(["aujourdhui", "semaine", "agent", "elevage"])
    expect(remettre(sans, "plan", IDS_TUILES)).toEqual([...IDS_TUILES])
    expect(remettre(["agent"], "elevage", IDS_TUILES)).toEqual(["agent", "elevage"])
    expect(remettre(["agent"], "agent", IDS_TUILES)).toEqual(["agent"])
  })

  it("memeDisposition", () => {
    expect(memeDisposition(dispositionDefaut(), dispositionDefaut())).toBe(true)
    expect(memeDisposition(dispositionDefaut(), { ...dispositionDefaut(), tuiles: ["agent"] })).toBe(false)
  })
})
