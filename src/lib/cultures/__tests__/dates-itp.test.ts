import { describe, expect, it } from "vitest"

import {
  datesDepuisItp,
  dureeCycleItpJours,
  recolteApresDebut,
  semaineSemisEffective,
  semaineVersDate,
} from "@/lib/cultures/dates-itp"

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

describe("semaineVersDate", () => {
  it("renvoie le lundi de la semaine ISO", () => {
    expect(semaineVersDate(2026, 1).getDay()).toBe(1)
    expect(semaineVersDate(2026, 27).getDay()).toBe(1)
  })
})

describe("semaineSemisEffective", () => {
  it("préfère la semaine de semis quand elle existe", () => {
    expect(
      semaineSemisEffective({ semaineSemis: 10, semaineImplantationDebut: 14 })
    ).toBe(10)
  })

  it("retombe sur l'implantation sans semis ni plantation", () => {
    expect(semaineSemisEffective({ semaineImplantationDebut: 14 })).toBe(14)
  })

  it("reste nulle si l'ITP porte une plantation", () => {
    expect(
      semaineSemisEffective({ semainePlantation: 18, semaineImplantationDebut: 14 })
    ).toBeNull()
  })

  it("reste nulle sans aucun jalon", () => {
    expect(semaineSemisEffective({ semaineRecolte: 20 })).toBeNull()
  })
})

describe("datesDepuisItp", () => {
  it("garde un cycle de printemps sur une seule année", () => {
    const d = datesDepuisItp(2026, {
      semaineSemis: 10,
      semainePlantation: 18,
      semaineRecolte: 33,
    })
    expect(iso(d.dateSemis)!.startsWith("2026")).toBe(true)
    expect(iso(d.datePlantation)!.startsWith("2026")).toBe(true)
    expect(iso(d.dateRecolte)!.startsWith("2026")).toBe(true)
  })

  it("reporte la plantation à l'année suivante quand elle précède le semis", () => {
    const d = datesDepuisItp(2026, { semaineSemis: 40, semainePlantation: 5 })
    expect(iso(d.dateSemis)!.startsWith("2026")).toBe(true)
    expect(iso(d.datePlantation)!.startsWith("2027")).toBe(true)
  })

  it("n'inverse plus récolte et plantation sur un ITP à cheval", () => {
    // Cas qui cassait : plantation reportée en 2027, récolte laissée en 2026
    // parce que sa semaine (45) est supérieure à celle de plantation (5).
    const d = datesDepuisItp(2026, {
      semaineSemis: 40,
      semainePlantation: 5,
      semaineRecolte: 45,
    })
    expect(d.datePlantation!.getTime()).toBeGreaterThan(d.dateSemis!.getTime())
    expect(d.dateRecolte!.getTime()).toBeGreaterThan(d.datePlantation!.getTime())
  })

  it("accepte un cycle s'étalant sur trois millésimes", () => {
    const d = datesDepuisItp(2026, {
      semaineSemis: 40,
      semainePlantation: 5,
      semaineRecolte: 3,
    })
    expect(iso(d.dateSemis)!.startsWith("2026")).toBe(true)
    expect(iso(d.datePlantation)!.startsWith("2027")).toBe(true)
    expect(iso(d.dateRecolte)!.startsWith("2028")).toBe(true)
  })

  it("gère un cycle hiver classique semis août → récolte janvier", () => {
    const d = datesDepuisItp(2026, { semaineSemis: 33, semaineRecolte: 3 })
    expect(d.dateRecolte!.getTime()).toBeGreaterThan(d.dateSemis!.getTime())
    expect(iso(d.dateRecolte)!.startsWith("2027")).toBe(true)
  })

  it("laisse nulles les étapes absentes de l'ITP", () => {
    const d = datesDepuisItp(2026, { semaineRecolte: 20 })
    expect(d.dateSemis).toBeNull()
    expect(d.datePlantation).toBeNull()
    expect(iso(d.dateRecolte)!.startsWith("2026")).toBe(true)
  })

  // QA cmsfxvbab — Pourpier INRAE-MESCLUN-0412 : implantation S10, récolte S17,
  // ni semaine de semis ni semaine de plantation. La récolte était proposée
  // seule (20/04/2026), donc antérieure au semis saisi, et l'API refusait la
  // création avec un simple toast.
  it("ancre le cycle sur la fenêtre d'implantation quand semis et plantation manquent", () => {
    const d = datesDepuisItp(2026, {
      semaineRecolte: 17,
      semaineImplantationDebut: 10,
    })
    expect(d.dateSemis).not.toBeNull()
    expect(d.dateRecolte!.getTime()).toBeGreaterThan(d.dateSemis!.getTime())
  })

  it("n'invente pas de semis quand l'ITP porte une semaine de plantation", () => {
    const d = datesDepuisItp(2026, {
      semainePlantation: 18,
      semaineRecolte: 33,
      semaineImplantationDebut: 10,
    })
    expect(d.dateSemis).toBeNull()
    expect(d.dateRecolte!.getTime()).toBeGreaterThan(d.datePlantation!.getTime())
  })

  it("garde l'ordre croissant sur un cycle d'implantation à cheval sur deux années", () => {
    const d = datesDepuisItp(2026, {
      semaineRecolte: 4,
      semaineImplantationDebut: 40,
    })
    expect(iso(d.dateSemis)!.startsWith("2026")).toBe(true)
    expect(iso(d.dateRecolte)!.startsWith("2027")).toBe(true)
  })

  // Friction 2026-08-14 — la date de récolte doit suivre le début saisi.
  it("mesure la durée du cycle depuis l'ancrage plantation", () => {
    // Laitue INRAE-MESCLUN-0222 : plantation S15, récolte S22 → 7 semaines.
    expect(dureeCycleItpJours({ semainePlantation: 15, semaineRecolte: 22 })).toBe(49)
  })

  it("mesure un cycle à cheval sur deux années modulo 52", () => {
    // Ail INRAE-MESCLUN-0009 : plantation S40, récolte S27 → 39 semaines.
    expect(dureeCycleItpJours({ semainePlantation: 40, semaineRecolte: 27 })).toBe(273)
  })

  it("retombe sur la durée de culture brute sans semaines exploitables", () => {
    expect(dureeCycleItpJours({ dureeCulture: 56 })).toBe(56)
    expect(dureeCycleItpJours({})).toBeNull()
  })

  it("recale la récolte sur le début réel en préservant la durée du cycle", () => {
    // Cas réel : laitue plantée le 13/07/2026, récolte restée au 22/06/2026
    // (antérieure à la plantation). Attendu : 13/07 + 49 j = 31/08/2026.
    const recolte = recolteApresDebut(new Date("2026-07-13T00:00:00"), {
      semainePlantation: 15,
      semaineRecolte: 22,
    })
    expect(recolte!.getFullYear()).toBe(2026)
    expect(recolte!.getMonth()).toBe(7)
    expect(recolte!.getDate()).toBe(31)
  })

  it("ne recale rien quand l'ITP ne permet aucun calcul", () => {
    expect(recolteApresDebut(new Date(), {})).toBeNull()
  })

  it("produit toujours un ordre croissant, quelles que soient les semaines", () => {
    for (const semis of [1, 12, 26, 40, 52]) {
      for (const plantation of [1, 12, 26, 40, 52]) {
        for (const recolte of [1, 12, 26, 40, 52]) {
          const d = datesDepuisItp(2026, {
            semaineSemis: semis,
            semainePlantation: plantation,
            semaineRecolte: recolte,
          })
          expect(d.datePlantation!.getTime()).toBeGreaterThanOrEqual(d.dateSemis!.getTime())
          expect(d.dateRecolte!.getTime()).toBeGreaterThanOrEqual(d.datePlantation!.getTime())
        }
      }
    }
  })
})
