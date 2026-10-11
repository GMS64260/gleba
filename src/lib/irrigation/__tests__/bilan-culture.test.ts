/**
 * Passage culture → bilan : jour d'un arrosage selon sa saisie, mise en place
 * sur la planche (revue du 2026-10-10).
 */
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/cache-helper", () => ({ getOrFetch: vi.fn() }))
vi.mock("@/lib/meteo", () => ({ fetchOpenMeteoHistory: vi.fn() }))

import { bilanCulture, debutSurPlanche, dernierArrosageDuLieu, joursDepuisArrosage, type CultureBilan } from "../bilan-culture"
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

// Ticket QA cmv3ja7nr : planche sans type dans une parcelle « Tunnel
// maraîcher », la pluie extérieure créditait le bilan sans un mot.
describe("bilanCulture, type de planche non renseigné", () => {
  const pluvieuse = (): MeteoBilan => {
    const m = meteoAntilles()
    return { ...m, historique: m.historique.map((j) => ({ ...j, pluie: 10, et0: 4 })), aujourdhui: { ...m.aujourdhui, et0: 4 } }
  }

  it("quand la pluie seule évite l'arrosage, le conseil ne tranche pas et donne les deux réponses", () => {
    const meteo = pluvieuse()
    const plein = bilanCulture(meteo, CULTURE, PLANCHE, { sousAbri: false, arrosages: [] })
    const abri = bilanCulture(meteo, CULTURE, PLANCHE, { sousAbri: true, arrosages: [] })
    expect(plein.urgence).toBe("aucune")
    expect(["critique", "haute"]).toContain(abri.urgence)

    const inconnu = bilanCulture(meteo, CULTURE, PLANCHE, { sousAbri: null, arrosages: [] })
    expect(inconnu.urgence).toBe("moyenne")
    expect(inconnu.doseMm).toBe(0)
    expect(inconnu.raison).toMatch(/^Type de planche à renseigner : sous serre ou tunnel, sans pluie, la planche serait à arroser \([0-9,]+ mm au sol\) ; en plein champ, sol bien pourvu/)
  })

  it("à arroser dans les deux cas : urgence commune, dose la plus forte, pluie non créditée", () => {
    // Pluie passée modeste et 9 mm annoncés : le cas du ticket (C3).
    const m = meteoAntilles()
    const meteo: MeteoBilan = {
      ...m,
      historique: m.historique.map((j, i) => ({ ...j, pluie: i % 6 === 0 ? 8 : 0 })),
      previsions: m.previsions.map((j, i) => ({ ...j, pluie: i < 2 ? 4.5 : 0 })),
    }
    const plein = bilanCulture(meteo, CULTURE, PLANCHE, { sousAbri: false, arrosages: [] })
    const abri = bilanCulture(meteo, CULTURE, PLANCHE, { sousAbri: true, arrosages: [] })
    expect(["critique", "haute"]).toContain(plein.urgence)
    expect(["critique", "haute"]).toContain(abri.urgence)

    const r = bilanCulture(meteo, CULTURE, PLANCHE, { sousAbri: null, arrosages: [] })
    expect(r.doseMm).toBe(Math.max(plein.doseMm, abri.doseMm))
    expect(r.urgence).toBe(plein.urgence === "haute" || abri.urgence === "haute" ? "haute" : "critique")
    expect(r.pluiePrevue48h).toBe(0)
    expect(r.raison).toMatch(
      /^Type de planche à renseigner : à arroser sous abri comme en plein champ\. Sous serre ou tunnel, sans pluie : [0-9,]+ mm au sol ; en plein champ, pluie comptée : [0-9,]+ mm\. Dose retenue : la plus forte\. Aucun arrosage noté\.$/,
    )
    expect(r.raison).not.toMatch(/ne compte que la pluie/)
  })

  it("type connu : rien ne change", () => {
    const r = bilanCulture(pluvieuse(), CULTURE, PLANCHE, { sousAbri: false, arrosages: [] })
    expect(r.raison).not.toMatch(/Type de planche/)
  })
})

// Ticket QA cmv3jatw8 : « Arrosée aujourd'hui » pour un arrosage daté du lendemain.
describe("dernierArrosageDuLieu", () => {
  it("ignore un arrosage daté d'après aujourd'hui dans le jour du lieu", () => {
    const meteo = meteoAntilles() // aujourd'hui 10/10 en Guadeloupe
    const demain = { date: new Date("2026-10-11T00:00:00Z"), calendaire: true, litresParM2: 10 }
    const hier = { date: new Date("2026-10-09T00:00:00Z"), calendaire: true, litresParM2: 10 }
    expect(dernierArrosageDuLieu(meteo, null, [demain, hier])).toEqual({ date: hier.date, jour: "2026-10-09" })
    // Nouméa (UTC+11) à 8 h le 12/10 : l'arrosage du 12/10 compte déjà.
    const noumea: MeteoBilan = { ...meteo, aujourdhui: { ...meteo.aujourdhui, date: "2026-10-12" }, decalageUtcS: 11 * 3600 }
    const duJour = { date: new Date("2026-10-12T00:00:00Z"), calendaire: true, litresParM2: 10 }
    expect(dernierArrosageDuLieu(noumea, null, [duJour])?.jour).toBe("2026-10-12")
  })
})

describe("joursDepuisArrosage", () => {
  it("compte des jours de calendrier du lieu, sans les arrosages à venir", () => {
    const meteo = meteoAntilles()
    // 22 h la veille en Guadeloupe (2 h UTC le 10) : hier, pas aujourd'hui.
    expect(joursDepuisArrosage(meteo, new Date("2026-10-10T02:00:00Z"), [])).toBe(1)
    expect(joursDepuisArrosage(meteo, new Date("2026-10-10T15:00:00Z"), [])).toBe(0)
    const demain = { date: new Date("2026-10-11T00:00:00Z"), calendaire: true, litresParM2: 10 }
    expect(joursDepuisArrosage(meteo, null, [demain])).toBeNull()
    const avantHier = { date: new Date("2026-10-08T00:00:00Z"), calendaire: true, litresParM2: 10 }
    expect(joursDepuisArrosage(meteo, null, [demain, avantHier])).toBe(2)
  })
})
