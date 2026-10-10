import { describe, expect, it } from "vitest"

import {
  CATALOGUE_TUILES,
  IDS_REPERES,
  IDS_TUILES,
  TUILES_DEFAUT,
  catalogue,
  definirTaille,
  deplacer,
  dispositionDefaut,
  largeurTuile,
  masques,
  memeDisposition,
  remettre,
  reordonner,
  retirer,
  sanitizeAccueilDisposition,
  tailleSuivante,
  tuilesOptionnellesDemandees,
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
    expect(d.tailles).toEqual({})
  })

  it("garde une taille seulement si la tuile la propose", () => {
    const d = sanitizeAccueilDisposition({ tuiles: ["plan", "aujourdhui"], tailles: { plan: 8, aujourdhui: 4, inconnue: 6, agent: "8" } })
    expect(d.tailles).toEqual({ plan: 8 })
    expect(largeurTuile("plan", d)).toBe(8)
    expect(largeurTuile("aujourdhui", d)).toBe(7)
  })

  it("une liste vide est permise, une liste absente revient au défaut", () => {
    expect(sanitizeAccueilDisposition({ reperes: [], tuiles: ["agent"] })).toEqual({ reperes: [], tuiles: ["agent"], tailles: {} })
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
    expect(d.tuiles).toEqual([...TUILES_DEFAUT])
  })

  it("le catalogue propose toutes les tuiles, dit lesquelles sont affichées et lesquelles manquent de module", () => {
    const c = catalogue(["aujourdhui", "plan"], ["maraichage", "comptabilite"])
    expect(c.map((p) => p.fiche.id)).toEqual([...IDS_TUILES])
    expect(c.find((p) => p.fiche.id === "plan")?.affichee).toBe(true)
    expect(c.find((p) => p.fiche.id === "elevage")?.moduleManquant).toBe("elevage")
    expect(c.find((p) => p.fiche.id === "verger")?.moduleManquant).toBe("verger")
    expect(c.find((p) => p.fiche.id === "tresorerie")?.moduleManquant).toBeNull()
    expect(c.find((p) => p.fiche.id === "raccourcis")?.moduleManquant).toBeNull()
    for (const id of IDS_TUILES) expect(CATALOGUE_TUILES[id].tailles.length).toBeGreaterThan(0)
  })

  it("masques : ce qu'on peut remettre, hors modules désactivés", () => {
    expect(masques(TUILES_DEFAUT, ["aujourdhui", "plan"], ["maraichage", "elevage"])).toEqual(["semaine", "agent", "elevage"])
    expect(masques(TUILES_DEFAUT, ["aujourdhui", "plan"], ["maraichage"])).toEqual(["semaine", "agent"])
  })
})

describe("déplacer, retirer, remettre", () => {
  it("déplace d'un cran et s'arrête aux bords", () => {
    expect(deplacer(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"])
    expect(deplacer(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"])
    expect(deplacer(["a", "b", "c"], "x", 1)).toEqual(["a", "b", "c"])
  })

  it("retire puis remet à sa place de référence", () => {
    const sans = retirer([...TUILES_DEFAUT], "plan")
    expect(sans).toEqual(["aujourdhui", "semaine", "agent", "elevage"])
    expect(remettre(sans, "plan", IDS_TUILES)).toEqual([...TUILES_DEFAUT])
    expect(remettre(["agent"], "elevage", IDS_TUILES)).toEqual(["agent", "elevage"])
    expect(remettre(["agent"], "agent", IDS_TUILES)).toEqual(["agent"])
  })

  it("memeDisposition", () => {
    expect(memeDisposition(dispositionDefaut(), dispositionDefaut())).toBe(true)
    expect(memeDisposition(dispositionDefaut(), { ...dispositionDefaut(), tuiles: ["agent"] })).toBe(false)
  })
})

describe("glisser-déposer et tailles", () => {
  it("reordonner prend la place de la cible et décale les autres", () => {
    expect(reordonner(["a", "b", "c", "d"], "d", "b")).toEqual(["a", "d", "b", "c"])
    expect(reordonner(["a", "b", "c", "d"], "a", "c")).toEqual(["b", "c", "a", "d"])
    expect(reordonner(["a", "b"], "a", "x")).toEqual(["a", "b"])
  })

  it("la taille suivante tourne dans les choix de la tuile, et une taille hors choix est refusée", () => {
    const d = dispositionDefaut()
    expect(tailleSuivante("plan", d)).toBe(6)
    expect(tailleSuivante("plan", definirTaille(d, "plan", 8))).toBe(4)
    expect(tailleSuivante("aujourdhui", d)).toBe(8)
    expect(definirTaille(d, "plan", 12)).toBe(d)
    expect(memeDisposition(d, definirTaille(d, "plan", 6))).toBe(false)
  })

  it("ne demande au serveur que les tuiles optionnelles affichées", () => {
    expect(tuilesOptionnellesDemandees(["aujourdhui", "verger", "raccourcis", "carte"])).toEqual(["verger", "carte"])
  })
})
