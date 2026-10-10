/**
 * Dates de la météo du bilan : historique ancré, arithmétique de calendrier
 * (heure d'été) et jour du lieu (Outre-mer).
 */
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/cache-helper", () => ({ getOrFetch: vi.fn() }))
vi.mock("@/lib/meteo", () => ({ fetchOpenMeteoHistory: vi.fn() }))

import { ajouterJours, debutHistoriqueBilan, jourDuLieu } from "../meteo-bilan"

describe("météo du bilan", () => {
  it("l'historique part du 1er janvier, du 1er décembre tant que janvier n'a pas 30 jours", () => {
    expect(debutHistoriqueBilan("2026-10-10")).toBe("2026-01-01")
    expect(debutHistoriqueBilan("2026-01-31")).toBe("2026-01-01")
    expect(debutHistoriqueBilan("2026-01-30")).toBe("2025-12-01")
    expect(debutHistoriqueBilan("2027-01-02")).toBe("2026-12-01")
  })

  it("le jour d'avant ne saute pas au changement d'heure", () => {
    expect(ajouterJours("2026-03-30", -1)).toBe("2026-03-29")
    expect(ajouterJours("2026-10-26", -1)).toBe("2026-10-25")
    expect(ajouterJours("2026-03-01", -1)).toBe("2026-02-28")
    expect(ajouterJours("2026-12-31", 1)).toBe("2027-01-01")
  })

  it("un arrosage du soir aux Antilles reste du jour du lieu", () => {
    // 21 h à la Guadeloupe (UTC-4) = 3 h du matin le lendemain à Paris.
    const soir = new Date("2026-07-15T01:00:00.000Z")
    expect(jourDuLieu(soir, { decalageUtcS: -4 * 3600 })).toBe("2026-07-14")
    expect(jourDuLieu(soir, { decalageUtcS: 2 * 3600 })).toBe("2026-07-15")
    // 23 h 30 à La Réunion (UTC+4) : déjà le lendemain là-bas.
    expect(jourDuLieu(new Date("2026-07-14T20:30:00.000Z"), { decalageUtcS: 4 * 3600 })).toBe("2026-07-15")
  })
})

describe("pluie des 7 derniers jours (ticket QA cmv2rf6mb)", () => {
  it("aujourd'hui exclu, 7 jours exactement", async () => {
    const { pluieSeptDerniersJours } = await import("../meteo-bilan")
    const historique = Array.from({ length: 10 }, (_, i) => ({ date: `2026-10-0${i}`, pluie: i, et0: 1 }))
    // Jours 3 à 9 : 3 + 4 + … + 9 = 42.
    expect(pluieSeptDerniersJours({ historique })).toBe(42)
  })
})
