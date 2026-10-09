import { describe, expect, it } from "vitest"

import { etatIrrigation, etatTache, libelleActionTache, libelleDatePrevue, libelleRetard } from "./etat-tache"

describe("etatTache", () => {
  it("dit ce qu'il reste à faire, en verbe, sans retard", () => {
    expect(etatTache({ type: "semis", fait: false })).toEqual({ etat: "neutre", libelle: "À semer" })
    expect(etatTache({ type: "plantation", fait: false, retardJours: 0 })).toEqual({ etat: "neutre", libelle: "À planter" })
    expect(etatTache({ type: "recolte", fait: false, retardJours: null })).toEqual({ etat: "neutre", libelle: "À récolter" })
  })

  it("dit ce qui a été fait, même si la tâche était en retard", () => {
    expect(etatTache({ type: "semis", fait: true, retardJours: 12 })).toEqual({ etat: "ok", libelle: "Semé" })
    expect(etatTache({ type: "recolte", fait: true })).toEqual({ etat: "ok", libelle: "Récolté" })
  })

  it("passe en attention sous une semaine de retard, en critique à partir de sept jours", () => {
    expect(etatTache({ type: "semis", fait: false, retardJours: 1 })).toEqual({ etat: "attention", libelle: "En retard" })
    expect(etatTache({ type: "semis", fait: false, retardJours: 6 }).etat).toBe("attention")
    expect(etatTache({ type: "semis", fait: false, retardJours: 7 }).etat).toBe("critique")
    expect(etatTache({ type: "recolte", fait: false, retardJours: 28 }).etat).toBe("critique")
  })
})

describe("libelleActionTache", () => {
  it("solde d'un geste, note une récolte, annule ce qui est fait", () => {
    expect(libelleActionTache("semis", false)).toBe("Fait")
    expect(libelleActionTache("plantation", false)).toBe("Fait")
    expect(libelleActionTache("recolte", false)).toBe("Noter")
    expect(libelleActionTache("recolte", true)).toBe("Annuler")
    expect(libelleActionTache("semis", true)).toBe("Annuler")
  })
})

describe("libelleRetard", () => {
  it("compte en jours sous une semaine, en semaines ensuite, rien sans retard", () => {
    expect(libelleRetard(0)).toBe("")
    expect(libelleRetard(-2)).toBe("")
    expect(libelleRetard(3)).toBe("3 j de retard")
    expect(libelleRetard(7)).toBe("1 sem. de retard")
    expect(libelleRetard(20)).toBe("2 sem. de retard")
  })
})

describe("etatIrrigation", () => {
  const maintenant = new Date(2026, 9, 9, 10, 0)
  it("distingue retard, jour même, pluie prévue, à venir et fait", () => {
    expect(etatIrrigation({ retardJours: 2, datePrevue: new Date(2026, 9, 7), maintenant })).toEqual({ etat: "attention", libelle: "En retard" })
    expect(etatIrrigation({ retardJours: 9, datePrevue: new Date(2026, 9, 0), maintenant }).etat).toBe("critique")
    expect(etatIrrigation({ datePrevue: new Date(2026, 9, 9, 18), maintenant })).toEqual({ etat: "attention", libelle: "À arroser" })
    expect(etatIrrigation({ datePrevue: new Date(2026, 9, 11), maintenant })).toEqual({ etat: "neutre", libelle: "Prévu" })
    expect(etatIrrigation({ datePrevue: new Date(2026, 9, 11), probablementInutile: true, maintenant })).toEqual({ etat: "info", libelle: "Pluie prévue" })
    expect(etatIrrigation({ fait: true, retardJours: 3, datePrevue: new Date(2026, 9, 7), maintenant })).toEqual({ etat: "ok", libelle: "Arrosé" })
  })

  it("le retard prime sur la pluie prévue : un arrosage en retard reste à décider", () => {
    expect(etatIrrigation({ retardJours: 1, probablementInutile: true, datePrevue: new Date(2026, 9, 8), maintenant }).libelle).toBe("En retard")
  })
})

describe("libelleDatePrevue", () => {
  const maintenant = new Date(2026, 9, 9, 10, 0)
  it("dit Aujourd'hui pour le jour même, sinon le jour court en français", () => {
    expect(libelleDatePrevue(new Date(2026, 9, 9, 23), maintenant)).toBe("Aujourd'hui")
    expect(libelleDatePrevue(new Date(2026, 9, 10), maintenant)).toMatch(/^sam\.? 10$/)
    expect(libelleDatePrevue("pas une date", maintenant)).toBe("")
  })
})
