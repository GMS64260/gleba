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

/**
 * Revue du 2026-11-11 : un jour d'archive dont la pluie n'est pas encore
 * publiée (ET0 connue) restait à 0 mm au lieu de céder à la prévision
 * `past_days`, et gardait son drapeau « pluie inconnue » sur l'écran Météo
 * une fois la pluie remplacée.
 */
describe("jour d'archive à pluie non publiée", () => {
  const MAINTENANT = new Date("2026-10-10T10:00:00.000Z")
  const jourArchive = (date: string, extra: Record<string, unknown> = {}) => ({
    date, tempMin: 8, tempMax: 18, tempMoy: 13, precipitation: 0, et0: 2,
    radiation: 10, sunshine: 6, humidityMin: 50, humidityMax: 90, windSpeedMax: 12, ...extra,
  })

  async function preparer(archive: ReturnType<typeof jourArchive>[]) {
    const { getOrFetch } = await import("@/lib/cache-helper")
    const { fetchOpenMeteoHistory } = await import("@/lib/meteo")
    const bilan = await import("../meteo-bilan")
    // Prévision avec jours passés : 2 mm/j d'ET0, 9 mm de pluie le 9 octobre.
    const jours = Array.from({ length: 39 }, (_, i) => {
      const date = bilan.ajouterJours("2026-10-10", i - 31)
      return { date, pluie: date === "2026-10-09" ? 9 : 0, et0: 2 }
    })
    vi.mocked(getOrFetch).mockResolvedValue({ decalageUtcS: 7200, jours })
    vi.mocked(fetchOpenMeteoHistory).mockResolvedValue(archive as never)
    return bilan
  }

  it("la pluie vient de la prévision, pas d'un 0 par défaut", async () => {
    const { chargerMeteoBilan } = await preparer([
      jourArchive("2026-10-08", { precipitation: 4 }),
      jourArchive("2026-10-09", { precipitationInconnue: true, et0: 1.5 }),
    ])
    const meteo = await chargerMeteoBilan(43.3, -0.37, MAINTENANT)
    expect(meteo?.aujourdhui.date).toBe("2026-10-10")
    expect(meteo?.historique.at(-1)).toEqual({ date: "2026-10-09", pluie: 9, et0: 2 })
    // Un jour publié garde l'archive (réanalyse, plus juste que la prévision).
    expect(meteo?.historique.at(-2)).toEqual({ date: "2026-10-08", pluie: 4, et0: 2 })
  })

  it("écran Météo : la pluie remplacée n'est plus dite inconnue", async () => {
    const { aligner7DerniersJours } = await preparer([])
    vi.useFakeTimers({ now: MAINTENANT })
    try {
      const archive7j = [
        jourArchive("2026-10-08", { precipitation: 4 }),
        jourArchive("2026-10-09", { precipitationInconnue: true }),
      ]
      const { historique7j, pluie7j } = await aligner7DerniersJours(43.3, -0.37, archive7j as never)
      const neuf = historique7j.find((j) => j.date === "2026-10-09")
      expect(neuf?.precipitation).toBe(9)
      expect(neuf?.precipitationInconnue).toBeUndefined()
      expect(pluie7j).toBe(9)
    } finally {
      vi.useRealTimers()
    }
  })
})
