import { describe, expect, it } from "vitest"

import {
  bornesSemaineISO,
  classerParUrgence,
  dateMidiLocal,
  etatPourRetard,
  jourLocalISO,
  libelleRetard,
  listerNoms,
  sousTitreAujourdhui,
} from "./classement"

describe("classerParUrgence", () => {
  it("met le critique en tête, puis le plus en retard, puis le titre", () => {
    const resultat = classerParUrgence([
      { id: "a", etat: "ok" as const, retardJours: 0, titre: "Facture" },
      { id: "b", etat: "attention" as const, retardJours: 2, titre: "Semer" },
      { id: "c", etat: "critique" as const, retardJours: 0, titre: "Arroser" },
      { id: "d", etat: "attention" as const, retardJours: 21, titre: "Récolter" },
      { id: "e", etat: "attention" as const, retardJours: 21, titre: "Planter" },
      { id: "f", etat: "info" as const, retardJours: -1, titre: "Soin" },
    ])
    expect(resultat.map((e) => e.id)).toEqual(["c", "e", "d", "b", "f", "a"])
  })

  it("ne modifie pas le tableau reçu", () => {
    const source = [
      { etat: "ok" as const, retardJours: 0, titre: "b" },
      { etat: "critique" as const, retardJours: 0, titre: "a" },
    ]
    classerParUrgence(source)
    expect(source[0].titre).toBe("b")
  })
})

describe("etatPourRetard", () => {
  it("info le jour même ou à venir, attention en retard, critique au-delà du seuil", () => {
    expect(etatPourRetard(0)).toBe("info")
    expect(etatPourRetard(-3)).toBe("info")
    expect(etatPourRetard(1)).toBe("attention")
    expect(etatPourRetard(7)).toBe("attention")
    expect(etatPourRetard(8)).toBe("critique")
    expect(etatPourRetard(3, { critiqueApres: 2 })).toBe("critique")
  })
})

describe("libellés", () => {
  it("libelleRetard", () => {
    expect(libelleRetard(3)).toBe("en retard de 3 j")
    expect(libelleRetard(0)).toBe("aujourd'hui")
    expect(libelleRetard(-2)).toBe("dans 2 j")
  })

  it("listerNoms dédoublonne et abrège", () => {
    expect(listerNoms(["C1", "C2", "C1"])).toBe("C1, C2")
    expect(listerNoms(["C1", "C2", "C3"])).toBe("C1, C2, C3")
    expect(listerNoms(["C1", "C2", "C3", "C4", "C5", "C6"])).toBe("C1, C2 et 4 autres")
    expect(listerNoms([])).toBe("")
  })

  it("sousTitreAujourdhui", () => {
    expect(sousTitreAujourdhui(0)).toBe("Rien d'urgent")
    expect(sousTitreAujourdhui(1)).toBe("1 chose à faire")
    expect(sousTitreAujourdhui(6)).toBe("6 choses · classées par urgence")
  })
})

describe("dates civiles locales", () => {
  it("jourLocalISO lit les composants locaux, pas l'UTC", () => {
    expect(jourLocalISO(new Date(2026, 9, 9, 0, 30))).toBe("2026-10-09")
  })

  it("dateMidiLocal ancre à midi local, donc le jour de semaine est juste", () => {
    const d = dateMidiLocal("2026-10-08")
    expect(d.getDate()).toBe(8)
    expect(d.getHours()).toBe(12)
    expect(d.getDay()).toBe(4) // jeudi
  })

  it("bornesSemaineISO va du lundi 00:00 au dimanche 23:59:59.999", () => {
    const { debut, fin } = bornesSemaineISO(new Date(2026, 9, 8, 15)) // jeudi 8 octobre 2026
    expect(jourLocalISO(debut)).toBe("2026-10-05")
    expect(debut.getHours()).toBe(0)
    expect(jourLocalISO(fin)).toBe("2026-10-11")
    expect(fin.getHours()).toBe(23)
    // Un dimanche appartient à la semaine qui le précède.
    expect(jourLocalISO(bornesSemaineISO(new Date(2026, 9, 11, 9)).debut)).toBe("2026-10-05")
  })
})
