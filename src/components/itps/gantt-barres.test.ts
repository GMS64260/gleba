import { describe, expect, it } from "vitest"

import { barresGantt, ecartSemaines, type BarreGantt } from "./gantt-barres"

/** Semaines (1–52) couvertes par les barres portant ce libellé. */
function semaines(barres: BarreGantt[], label: string): number[] {
  const couvertes: number[] = []
  for (const barre of barres.filter((b) => b.label === label)) {
    const debut = Math.round((barre.start / 100) * 52) + 1
    const duree = Math.round((barre.width / 100) * 52)
    for (let s = debut; s < debut + duree; s++) couvertes.push(s)
  }
  return couvertes.sort((a, b) => a - b)
}

const suite = (debut: number, fin: number) => Array.from({ length: fin - debut + 1 }, (_, i) => debut + i)

describe("barresGantt — cycles à cheval sur deux années", () => {
  it("ail planté S42, récolté S25 : la croissance se poursuit de janvier à juin", () => {
    const barres = barresGantt({ semainePlantation: 42, semaineRecolte: 25, dureeRecolte: 3 })
    expect(semaines(barres, "Croissance")).toEqual([...suite(1, 24), ...suite(42, 52)])
    expect(semaines(barres, "Récolte")).toEqual([25, 26, 27])
  })

  it("semis direct S50, récolte S8 : germination en décembre, croissance en janvier-février", () => {
    const barres = barresGantt({ semaineSemis: 50, semaineRecolte: 8, dureeRecolte: 2 })
    expect(semaines(barres, "Semis / germination")).toEqual([50, 51, 52])
    expect(semaines(barres, "Croissance")).toEqual(suite(1, 7))
  })

  it("pépinière S48 → plantation S6 : le semis boucle lui aussi", () => {
    const barres = barresGantt({ semaineSemis: 48, semainePlantation: 6, semaineRecolte: 20 })
    expect(semaines(barres, "Semis")).toEqual([...suite(1, 5), ...suite(48, 52)])
    expect(semaines(barres, "Croissance")).toEqual(suite(6, 19))
  })

  it("aucune barre ne sort de l'axe", () => {
    for (const semis of [1, 20, 40, 52]) {
      for (const recolte of [1, 10, 30, 52]) {
        for (const barre of barresGantt({
          semaineSemis: semis,
          semainePlantation: ((semis + 5) % 52) + 1,
          semaineRecolte: recolte,
          dureeRecolte: 30,
        })) {
          expect(barre.start).toBeGreaterThanOrEqual(0)
          expect(barre.start + barre.width).toBeLessThanOrEqual(100.0001)
          expect(barre.width).toBeGreaterThan(0)
        }
      }
    }
  })
})

describe("barresGantt — fenêtre d'implantation documentée", () => {
  it("trace implantation, croissance indicative et fenêtre de récolte", () => {
    const barres = barresGantt({
      semaineImplantationDebut: 14,
      semaineImplantationFin: 16,
      semaineRecolte: 24,
      semaineRecolteFin: 31,
      implantation: "Plantation",
    })
    expect(semaines(barres, "Plantation")).toEqual([14, 15, 16])
    expect(semaines(barres, "Croissance indicative")).toEqual(suite(16, 23))
    expect(semaines(barres, "Fenêtre de récolte")).toEqual(suite(24, 31))
  })

  it("ne dessine pas de croissance quand la récolte commence pendant l'implantation", () => {
    // Semis échelonnés : implantation S10–S30, récolte dès S16. L'écart bouclé
    // S30 → S16 valait 38 semaines de « croissance indicative ».
    const barres = barresGantt({
      semaineImplantationDebut: 10,
      semaineImplantationFin: 30,
      semaineRecolte: 16,
      semaineRecolteFin: 40,
    })
    expect(semaines(barres, "Croissance indicative")).toEqual([])
    expect(semaines(barres, "Fenêtre de récolte")).toEqual(suite(16, 40))
  })

  it("boucle la croissance d'une implantation d'automne récoltée au printemps", () => {
    const barres = barresGantt({
      semaineImplantationDebut: 40,
      semaineImplantationFin: 44,
      semaineRecolte: 18,
      semaineRecolteFin: 22,
    })
    expect(semaines(barres, "Croissance indicative")).toEqual([...suite(1, 17), ...suite(44, 52)])
  })

  it("garde le semis en pépinière antérieur à la fenêtre", () => {
    const barres = barresGantt({
      semaineSemis: 13,
      semaineImplantationDebut: 18,
      semaineImplantationFin: 22,
      semaineRecolte: 28,
    })
    expect(semaines(barres, "Semis en pépinière")).toEqual(suite(13, 17))
  })
})

describe("barresGantt — la récolte a toujours une barre", () => {
  it("fenêtre d'implantation sans fin de récolte : durée de récolte de l'ITP", () => {
    const barres = barresGantt({
      semaineImplantationDebut: 14,
      semaineImplantationFin: 16,
      semaineRecolte: 24,
      dureeRecolte: 8,
    })
    expect(semaines(barres, "Fenêtre de récolte")).toEqual(suite(24, 31))
  })

  it("ITP sans durée de récolte mais avec une fin de fenêtre", () => {
    const barres = barresGantt({
      semaineSemis: 10,
      semainePlantation: 16,
      semaineRecolte: 27,
      semaineRecolteFin: 35,
    })
    expect(semaines(barres, "Récolte")).toEqual(suite(27, 35))
  })

  it("ITP créé depuis le formulaire, sans durée ni fin : la semaine de début", () => {
    const barres = barresGantt({ semaineSemis: 10, semainePlantation: 16, semaineRecolte: 27 })
    expect(semaines(barres, "Récolte")).toEqual([27])
  })

  it("fenêtre de récolte à cheval sur la fin d'année", () => {
    const barres = barresGantt({ semaineSemis: 30, semaineRecolte: 50, semaineRecolteFin: 3 })
    expect(semaines(barres, "Récolte")).toEqual([1, 2, 3, 50, 51, 52])
  })

  it("rien à tracer sans semaine de récolte ni de semis", () => {
    expect(barresGantt({})).toEqual([])
  })
})

describe("ecartSemaines", () => {
  it("boucle sur 52 semaines", () => {
    expect(ecartSemaines(10, 14)).toBe(4)
    expect(ecartSemaines(50, 3)).toBe(5)
    expect(ecartSemaines(20, 20)).toBe(0)
  })
})
