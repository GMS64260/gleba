/**
 * Revue du modèle d'arrosage (2026-10-10) : la règle d'urgence pilote seule
 * les lignes « à arroser » depuis la suppression du plan pré-généré.
 */
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({ default: {} }))
vi.mock("@/lib/meteo", () => ({ fetchOpenMeteoForecast: vi.fn(), fetchOpenMeteoHistory: vi.fn() }))

import {
  JOURS_APRES_FIN_RECOLTE,
  calculerUrgenceMeteo,
  whereCulturesEnPlace,
} from "@/lib/irrigation-conseil"

/** Météo d'une zone : ET0 journalière constante sur 8 jours d'archive + aujourd'hui. */
function meteo(et0Jour: number, opts: { pluie7j?: number; joursSansPluie?: number; pluiePrevue5j?: number } = {}) {
  return {
    lat: 43,
    lng: 0,
    historique: Array.from({ length: 8 }, () => ({ precipitation: (opts.pluie7j ?? 0) / 8, et0: et0Jour })),
    previsions: [],
    pluie48hPassees: 0,
    pluie7jPassees: opts.pluie7j ?? 0,
    et0_7j: et0Jour * 9,
    joursSansPluie: opts.joursSansPluie ?? 10,
    pluiePrevue48h: 0,
    pluiePrevue5j: opts.pluiePrevue5j ?? 0,
    joursAvantPluie: 99,
  } as never
}

const ARROSER = ["critique", "haute"]
const urgence = (jours: number | null, besoin: number, m: ReturnType<typeof meteo> | null) =>
  calculerUrgenceMeteo(jours, besoin, "Moyenne", m, false).urgence

describe("calculerUrgenceMeteo", () => {
  it("hiver sec (ET0 0,6 mm/j) : aucune culture à arroser, quel que soit son besoin", () => {
    for (const besoin of [1, 2, 3, 4, 5]) {
      expect(ARROSER).not.toContain(urgence(30, besoin, meteo(0.6)))
    }
  })

  it("une culture gourmande n'est jamais moins urgente qu'une sobre (plus d'inversion)", () => {
    const rang = { critique: 0, haute: 1, moyenne: 2, faible: 3, aucune: 4 } as const
    for (const et0 of [0.6, 1.5, 3, 5]) {
      const sobre = urgence(10, 1, meteo(et0))
      const gourmande = urgence(10, 5, meteo(et0))
      expect(rang[gourmande]).toBeLessThanOrEqual(rang[sobre])
    }
  })

  it("été (ET0 5 mm/j) : rien le lendemain d'un arrosage, à arroser au bout de 3 jours", () => {
    expect(ARROSER).not.toContain(urgence(1, 4, meteo(5)))
    expect(ARROSER).toContain(urgence(3, 4, meteo(5)))
  })

  it("une bruine de 1 mm ne compte pas comme un apport : seule une pluie significative remet à zéro", () => {
    // `joursSansPluie` est calculé avec SEUIL_PLUIE_SIGNIFICATIVE ; une zone qui a
    // reçu 2 mm hier reste donc à 10 jours sans pluie.
    expect(ARROSER).toContain(urgence(10, 4, meteo(5, { pluie7j: 2, joursSansPluie: 10 })))
  })

  it("sans coordonnées de parcelle : jamais une tâche, une invitation à géolocaliser", () => {
    for (const jours of [null, 1, 3, 10, 30]) {
      const r = calculerUrgenceMeteo(jours, 5, "Faible", null, false)
      expect(ARROSER).not.toContain(r.urgence)
    }
    expect(calculerUrgenceMeteo(10, 4, "Moyenne", null, false).raison).toContain("Géolocalisez une parcelle")
  })

  it("sous abri, la pluie ne compte pas", () => {
    const pluvieux = meteo(3, { pluie7j: 40, joursSansPluie: 0, pluiePrevue5j: 20 })
    expect(calculerUrgenceMeteo(6, 4, "Moyenne", pluvieux, false).urgence).toBe("aucune")
    expect(ARROSER).toContain(calculerUrgenceMeteo(6, 4, "Moyenne", pluvieux, true).urgence)
  })
})

describe("whereCulturesEnPlace", () => {
  const maintenant = new Date(2027, 0, 15)
  const borne = new Date(maintenant.getTime() - JOURS_APRES_FIN_RECOLTE * 86_400_000)
  const borneSansFin = new Date(maintenant.getTime() - 60 * 86_400_000)

  it("garde la saison précédente (cultures d'hiver en terre en janvier) et les vivaces de toute année", () => {
    const where = whereCulturesEnPlace(2027, maintenant)
    expect(where).toEqual({
      AND: [
        { OR: [{ espece: { vivace: true } }, { annee: { in: [2026, 2027] } }] },
        {
          OR: [
            { espece: { vivace: true } },
            { dateRecolte: null, finRecolte: null },
            { finRecolte: { gte: borne } },
            // Sans fin de récolte, une courgette récoltée tout l'été reste suivie 60 jours.
            { finRecolte: null, dateRecolte: { gte: borneSansFin } },
          ],
        },
      ],
    })
  })
})
