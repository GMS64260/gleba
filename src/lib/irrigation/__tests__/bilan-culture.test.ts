/**
 * Passage culture → bilan : jour d'un arrosage selon sa saisie, mise en place
 * sur la planche (revue du 2026-10-10).
 */
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/cache-helper", () => ({ getOrFetch: vi.fn() }))
vi.mock("@/lib/meteo", () => ({ fetchOpenMeteoHistory: vi.fn() }))

import { bilanCulture, debutSurPlanche, type CultureBilan } from "../bilan-culture"
import type { MeteoBilan } from "../meteo-bilan"

const AUJOURDHUI = "2026-10-10"
function meteoAntilles(): MeteoBilan {
  const jour = (n: number) => new Date(Date.UTC(2026, 9, 10 + n)).toISOString().slice(0, 10)
  return {
    historique: Array.from({ length: 30 }, (_, i) => ({ date: jour(i - 30), pluie: 0, et0: 5 })),
    aujourdhui: { date: AUJOURDHUI, pluie: 0, et0: 5 },
    previsions: Array.from({ length: 7 }, (_, i) => ({ date: jour(i + 1), pluie: 0, et0: 5 })),
    decalageUtcS: -4 * 3600,
  }
}

const CULTURE: CultureBilan = {
  espece: "Tomate",
  besoinEau: 4,
  vivace: false,
  dateSemis: new Date("2026-04-01T00:00:00Z"),
  datePlantation: new Date("2026-05-15T00:00:00Z"),
  semisFait: true,
  plantationFaite: true,
  dateRecolte: null,
  finRecolte: new Date("2026-11-30T00:00:00Z"),
  derniereIrrigation: null,
}
const PLANCHE = { typeSol: "Limoneux", retentionEau: null, irrigation: null }

describe("bilanCulture", () => {
  it("un arrosage horodaté (assistant) le soir aux Antilles compte pour le jour du lieu", () => {
    // 18 h 30 en Guadeloupe = 0 h 30 le lendemain à Paris.
    const soir = new Date("2026-10-10T22:30:00.000Z")
    const r = bilanCulture(meteoAntilles(), CULTURE, PLANCHE, {
      sousAbri: false,
      arrosages: [{ date: soir, calendaire: true, litresParM2: null }],
    })
    expect(r.dernierApport).toEqual({ type: "arrosage", date: AUJOURDHUI, mm: null })
    expect(r.urgence).toBe("aucune")
  })

  it("une date de calendrier (minuit UTC) garde son jour", () => {
    const r = bilanCulture(meteoAntilles(), CULTURE, PLANCHE, {
      sousAbri: false,
      arrosages: [{ date: new Date("2026-10-09T00:00:00.000Z"), calendaire: true, litresParM2: null }],
    })
    expect(r.dernierApport?.date).toBe("2026-10-09")
  })

  it("un volume connu passe par l'efficacité du système", () => {
    const meteo = meteoAntilles()
    const arrosages = [{ date: new Date("2026-10-10T00:00:00.000Z"), calendaire: true, litresParM2: 10 }]
    const goutte = bilanCulture(meteo, CULTURE, { ...PLANCHE, irrigation: "Goutte-a-goutte" }, { sousAbri: false, arrosages })
    const arrosoir = bilanCulture(meteo, CULTURE, { ...PLANCHE, irrigation: "Manuel" }, { sousAbri: false, arrosages })
    expect(goutte.dernierApport?.mm).toBe(9)
    expect(arrosoir.dernierApport?.mm).toBe(8)
  })
})

describe("debutSurPlanche", () => {
  it("plant en pépinière : pas encore sur la planche ; coché en avance : le jour du lieu", () => {
    const pepiniere = { ...CULTURE, datePlantation: new Date("2026-10-20T00:00:00Z"), plantationFaite: false }
    expect(debutSurPlanche(pepiniere, AUJOURDHUI)).toBe("2026-10-20")
    const enAvance = { ...pepiniere, plantationFaite: true }
    expect(debutSurPlanche(enAvance, AUJOURDHUI)).toBe(AUJOURDHUI)
    const semisDirect = { ...CULTURE, datePlantation: null }
    expect(debutSurPlanche(semisDirect, AUJOURDHUI)).toBe("2026-04-01")
  })
})
