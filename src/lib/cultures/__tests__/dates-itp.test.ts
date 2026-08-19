import { getISOWeek } from "date-fns"
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

describe("cultures pluriannuelles", () => {
  // « Avocatier — antilles » : plantation S25, récolte S26, durée 1 095 j. Les
  // semaines décrivent la SAISON de récolte, pas le cycle : l'écart d'une
  // semaine proposait une récolte d'avocats sept jours après la plantation,
  // sous une fiche annonçant « Cycle : 1095 jours ».
  const AVOCATIER = {
    semainePlantation: 25,
    semaineRecolte: 26,
    dureeCulture: 1095,
    delaiPremiereRecolteAnnees: 3,
  }

  it("place la première récolte à sa semaine, N années plus tard", () => {
    const d = datesDepuisItp(2026, AVOCATIER)
    expect(d.datePlantation!.getFullYear()).toBe(2026)
    expect(d.dateRecolte!.getFullYear()).toBe(2029)
    // Semaine de récolte préservée : le calendrier local reste juste.
    expect(getISOWeek(d.dateRecolte!)).toBe(26)
  })

  it("déduit le délai de la durée de culture quand il n'est pas déclaré", () => {
    const { delaiPremiereRecolteAnnees: _ignore, ...sansDelai } = AVOCATIER
    void _ignore
    expect(datesDepuisItp(2026, sansDelai).dateRecolte!.getFullYear()).toBe(2029)
    expect(dureeCycleItpJours(sansDelai)).toBe(dureeCycleItpJours(AVOCATIER))
  })

  /**
   * L'invariant qui compte : la durée annoncée par `dureeCycleItpJours` et la
   * date posée par `datesDepuisItp` doivent décrire le MÊME cycle. Sur les 4 ITP
   * dont la durée déclarée tombe entre 366 et 912 jours (ananas, bananier
   * plantain), rendre la durée déclarée telle quelle les désaccordait de
   * plusieurs mois.
   */
  it.each([
    ['Avocatier — antilles', { semainePlantation: 25, semaineRecolte: 26, dureeCulture: 1095 }],
    ['Cocotier — austral', { semainePlantation: 46, semaineRecolte: 44, dureeCulture: 2555 }],
    ['Ananas — antilles', { semainePlantation: 24, semaineRecolte: 26, dureeCulture: 600 }],
    ['Ananas — austral', { semainePlantation: 42, semaineRecolte: 49, dureeCulture: 510 }],
    ['Bananier plantain — antilles', { semainePlantation: 24, semaineRecolte: 28, dureeCulture: 390 }],
  ])('accorde la durée et la date de récolte sur %s', (_nom, itp) => {
    const d = datesDepuisItp(2026, itp)
    const joursReels = Math.round(
      (d.dateRecolte!.getTime() - d.datePlantation!.getTime()) / 86_400_000
    )
    const duree = dureeCycleItpJours(itp)!
    // Tolérance : l'année à 365 jours du calcul contre les bissextiles réelles.
    expect(Math.abs(duree - joursReels)).toBeLessThanOrEqual(8)
  })

  it('reste au-dessus de la durée déclarée par la source', () => {
    expect(dureeCycleItpJours({ semainePlantation: 25, semaineRecolte: 26, dureeCulture: 1095 })).toBeGreaterThanOrEqual(1095)
  })

  it("recale la récolte sur la durée pluriannuelle quand la plantation bouge", () => {
    const recolte = recolteApresDebut(new Date("2026-03-15T00:00:00"), AVOCATIER)
    expect(recolte!.getFullYear()).toBe(2029)
  })

  it("ne change rien pour une culture annuelle", () => {
    const d = datesDepuisItp(2026, {
      semaineSemis: 10,
      semaineRecolte: 30,
      dureeCulture: 140,
    })
    expect(d.dateSemis!.getFullYear()).toBe(2026)
    expect(d.dateRecolte!.getFullYear()).toBe(2026)
    expect(dureeCycleItpJours({ semaineSemis: 10, semaineRecolte: 30, dureeCulture: 140 })).toBe(140)
  })
})
