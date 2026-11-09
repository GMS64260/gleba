import { describe, expect, it } from "vitest"
import { debutJourCivilSoin, estLotMedicamentAuRebut, lotMedicamentPerime, refusUnitePrelevement, stockMedicamentEstDisponible } from "./stock-medicament"

describe("stockMedicamentEstDisponible", () => {
  it("accepte un lot approvisionné sans date de péremption", () => {
    expect(stockMedicamentEstDisponible(
      { quantite: 7, datePeremption: null },
      "2026-07-29",
    )).toBe(true)
  })

  it("accepte un lot qui périme le jour du soin", () => {
    expect(stockMedicamentEstDisponible(
      { quantite: 7, datePeremption: "2026-07-29T00:00:00.000Z" },
      "2026-07-29",
    )).toBe(true)
  })

  it("refuse un lot épuisé ou déjà périmé", () => {
    expect(stockMedicamentEstDisponible(
      { quantite: 0, datePeremption: "2026-08-01T00:00:00.000Z" },
      "2026-07-29",
    )).toBe(false)
    expect(stockMedicamentEstDisponible(
      { quantite: 7, datePeremption: "2026-07-28T00:00:00.000Z" },
      "2026-07-29",
    )).toBe(false)
  })
})

describe("lotMedicamentPerime", () => {
  const peremption = new Date("2026-11-09T00:00:00.000Z")

  it("compare des jours civils : « Fait » à 10 h le jour de la péremption est accepté", () => {
    expect(lotMedicamentPerime(peremption, new Date("2026-11-09T09:00:00.000Z"))).toBe(false)
    // 23:30 à Paris le 9 = 22:30 UTC : encore le 9.
    expect(lotMedicamentPerime(peremption, new Date("2026-11-09T22:30:00.000Z"))).toBe(false)
    // 00:30 à Paris le 10 = 23:30 UTC le 9 : déjà le lendemain.
    expect(lotMedicamentPerime(peremption, new Date("2026-11-09T23:30:00.000Z"))).toBe(true)
    expect(lotMedicamentPerime(peremption, "2026-11-10")).toBe(true)
    expect(lotMedicamentPerime(null, "2030-01-01")).toBe(false)
  })

  it("donne la borne SQL du jour civil du soin", () => {
    expect(debutJourCivilSoin(new Date("2026-11-09T09:00:00.000Z"))).toEqual(peremption)
  })
})

describe("rebut et unité du prélèvement", () => {
  it("reconnaît un lot au rebut : stock nul ET note de rebut", () => {
    expect(estLotMedicamentAuRebut({ quantite: 0, notes: "Mis au rebut le 01/11/2026 (3 mL restants)." })).toBe(true)
    expect(estLotMedicamentAuRebut({ quantite: 0, notes: null })).toBe(false)
    // Réapprovisionné après coup : ce n'est plus un lot jeté.
    expect(estLotMedicamentAuRebut({ quantite: 5, notes: "Mis au rebut le 01/11/2026 (3 mL restants)." })).toBe(false)
  })

  it("exige l'unité du lot pour la quantité prélevée", () => {
    expect(refusUnitePrelevement("mL", "mL")).toBeNull()
    expect(refusUnitePrelevement(" ml ", "mL")).toBeNull()
    expect(refusUnitePrelevement(null, "mL")).toBeNull()
    expect(refusUnitePrelevement("doses", "mL")).toContain("mL")
  })
})
