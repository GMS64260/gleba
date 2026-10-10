/**
 * Revue du modèle d'arrosage (2026-10-10) : la règle d'urgence pilote seule
 * les lignes « à arroser » depuis la suppression du plan pré-généré.
 */
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({ default: {} }))
vi.mock("@/lib/meteo", () => ({ fetchOpenMeteoForecast: vi.fn(), fetchOpenMeteoHistory: vi.fn() }))

import {
  JOURS_APRES_FIN_RECOLTE,
  resumeMeteo,
  urgenceFallback,
  whereCulturesEnPlace,
} from "@/lib/irrigation-conseil"

// La règle d'urgence elle-même vit dans le moteur de bilan hydrique :
// src/lib/irrigation/__tests__/bilan-sol.test.ts.

describe("urgenceFallback (sans météo)", () => {
  it("n'est jamais une tâche, quel que soit le temps sans arrosage", () => {
    for (const jours of [null, 1, 3, 10, 30]) {
      expect(["critique", "haute"]).not.toContain(urgenceFallback(jours, 5, "Faible").urgence)
    }
  })

  it("dit pourquoi : parcelle à géolocaliser ou météo indisponible", () => {
    expect(urgenceFallback(10, 4, "Moyenne").raison).toContain("Géolocalisez une parcelle")
    expect(urgenceFallback(10, 4, "Moyenne", "meteo-indisponible").raison).toContain("Météo momentanément indisponible")
  })
})

describe("resumeMeteo", () => {
  it("compte les jours sans pluie significative et la prochaine pluie, depuis la série du bilan", () => {
    const r = resumeMeteo({
      historique: [
        { date: "2026-10-05", pluie: 12, et0: 2 },
        { date: "2026-10-06", pluie: 1, et0: 2 },
        { date: "2026-10-07", pluie: 2, et0: 2 },
      ],
      aujourdhui: { date: "2026-10-08", pluie: 0, et0: 2 },
      previsions: [
        { date: "2026-10-09", pluie: 0, et0: 2 },
        { date: "2026-10-10", pluie: 6, et0: 2 },
      ],
    })
    // Bruines de 1 et 2 mm : pas significatives (seuil 3 mm).
    expect(r.joursSansPluie).toBe(3)
    expect(r.joursAvantPluie).toBe(2)
    expect(r.pluiePrevue48h).toBe(6)
    expect(r.pluie48hPassees).toBe(3)
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
