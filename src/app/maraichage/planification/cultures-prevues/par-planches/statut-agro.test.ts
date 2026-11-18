import { describe, expect, it } from "vitest"

import { statutsAgro, type CultureAStatuer } from "./statut-agro"

const culture = (extra: Partial<CultureAStatuer>): CultureAStatuer => ({
  plancheId: "A1",
  semaineSemis: 10,
  semainePlantation: null,
  semaineRecolte: 20,
  existante: true,
  ...extra,
})

describe("statut agronomique par planche", () => {
  it("deux cultures sans planche ne se chevauchent pas", () => {
    expect(statutsAgro([culture({ plancheId: "" }), culture({ plancheId: "" })])).toEqual(["ok", "ok"])
  })

  it("signale un chevauchement réel sur une même planche, pas entre deux planches", () => {
    expect(
      statutsAgro([
        culture({}),
        culture({ semaineSemis: 15, semaineRecolte: 30 }),
        culture({ plancheId: "B2", semaineSemis: 15, semaineRecolte: 30 }),
      ]),
    ).toEqual(["overlap", "overlap", "ok"])
  })

  it("tolère une passation de moins de deux semaines", () => {
    expect(statutsAgro([culture({}), culture({ semaineSemis: 19, semaineRecolte: 30 })])).toEqual(["ok", "ok"])
    expect(statutsAgro([culture({}), culture({ semaineSemis: 18, semaineRecolte: 30 })])).toEqual(["overlap", "overlap"])
  })

  it("distingue dates vides, à créer et cohérent", () => {
    const sansDate = { semaineSemis: null, semainePlantation: null, semaineRecolte: null }
    expect(
      statutsAgro([
        culture({ plancheId: "C1", ...sansDate }),
        culture({ plancheId: "C2", ...sansDate, existante: false }),
        culture({ plancheId: "C3", existante: false }),
        culture({ plancheId: "C4" }),
      ]),
    ).toEqual(["empty", "todo", "todo", "ok"])
  })

  it("une culture sans période exploitable n’entre dans aucun chevauchement", () => {
    expect(statutsAgro([culture({}), culture({ semaineRecolte: null })])).toEqual(["ok", "ok"])
  })
})
