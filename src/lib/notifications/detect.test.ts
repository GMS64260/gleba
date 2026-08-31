import { describe, expect, it } from "vitest"
import {
  deciderIrrigationInutile,
  detecterAlertesMeteo,
  SEUILS_METEO,
  detecterStocksAlimentsBas,
  detecterStocksFertilisantsBas,
  detecterStocksVarietesBas,
  formaterTemporaliteAlerte,
  indicationHoraireAlerte,
} from "./detect"
import type { MeteoActuelle, MeteoPrevision } from "@/lib/meteo"

function jour(overrides: Partial<MeteoPrevision> & { date: string }): MeteoPrevision {
  return {
    tempMin: 10,
    tempMax: 20,
    tempMoy: 15,
    precipitation: 0,
    precipitationProba: 0,
    et0: 2,
    radiation: 20,
    sunshine: 6,
    humidityMin: 50,
    humidityMax: 80,
    windSpeedMax: 10,
    ...overrides,
  }
}

describe("detecterAlertesMeteo", () => {
  it("signale un gel (tempMin <= 0), danger si sévère", () => {
    const alertes = detecterAlertesMeteo([jour({ date: "2026-08-10", tempMin: -2 })])
    expect(alertes).toHaveLength(1)
    expect(alertes[0].type).toBe("gel")
    expect(alertes[0].niveau).toBe("attention")
    expect(alertes[0].key).toBe("gel:2026-08-10")

    const severes = detecterAlertesMeteo([jour({ date: "2026-08-11", tempMin: -4 })])
    expect(severes[0].niveau).toBe("danger")
  })

  it("signale une canicule (tempMax >= 35), danger si >= 40", () => {
    const alertes = detecterAlertesMeteo([jour({ date: "2026-08-10", tempMax: 36 })])
    expect(alertes).toHaveLength(1)
    expect(alertes[0].type).toBe("canicule")
    expect(alertes[0].niveau).toBe("attention")

    const severes = detecterAlertesMeteo([jour({ date: "2026-08-11", tempMax: 41 })])
    expect(severes[0].niveau).toBe("danger")
  })

  it("signale un vent fort (>= 50 km/h)", () => {
    const alertes = detecterAlertesMeteo([jour({ date: "2026-08-10", windSpeedMax: 55 })])
    expect(alertes).toHaveLength(1)
    expect(alertes[0].type).toBe("vent")
  })

  it("ne signale pas un vent modéré (ex. 25 km/h)", () => {
    const alertes = detecterAlertesMeteo([jour({ date: "2026-08-10", windSpeedMax: 25 })])
    expect(alertes).toHaveLength(0)
  })

  it("signale une pluie abondante (>= 20 mm)", () => {
    const alertes = detecterAlertesMeteo([jour({ date: "2026-08-10", precipitation: 22 })])
    expect(alertes).toHaveLength(1)
    expect(alertes[0].type).toBe("pluie")
    expect(alertes[0].niveau).toBe("attention")
  })

  it("signale un orage à partir du code WMO courant (95/96/99)", () => {
    const orage: MeteoActuelle = {
      temperature: 22,
      humidity: 80,
      windSpeed: 15,
      windDirection: 200,
      precipitation: 2,
      weatherCode: 95,
      weatherDescription: "Orage",
    }
    const alertes = detecterAlertesMeteo([jour({ date: "2026-08-10" })], orage)
    expect(alertes.some((a) => a.type === "orage")).toBe(true)
    expect(alertes.find((a) => a.type === "orage")?.niveau).toBe("attention")

    const grele: MeteoActuelle = { ...orage, weatherCode: 99, weatherDescription: "Orage avec grêle forte" }
    const avecGrele = detecterAlertesMeteo([jour({ date: "2026-08-10" })], grele)
    expect(avecGrele.find((a) => a.type === "orage")?.niveau).toBe("danger")
  })

  it("n'émet aucune alerte par beau temps", () => {
    const alertes = detecterAlertesMeteo([
      jour({ date: "2026-08-10", tempMin: 12, tempMax: 24, windSpeedMax: 15, precipitation: 2 }),
    ])
    expect(alertes).toHaveLength(0)
  })

  it("respecte l'horizon demandé (pas d'alerte au-delà)", () => {
    const previsions = [
      jour({ date: "2026-08-10", tempMax: 20 }),
      jour({ date: "2026-08-11", tempMax: 38 }),
      jour({ date: "2026-08-12", tempMax: 38 }),
    ]
    const alertes = detecterAlertesMeteo(previsions, null, { horizonJours: 2 })
    expect(alertes.filter((a) => a.type === "canicule")).toHaveLength(1)
    expect(alertes[0].date).toBe("2026-08-11")
  })

  it("utilise les seuils principaux personnalisés sans modifier le niveau danger", () => {
    const prevision = jour({ date: "2026-08-10", tempMax: 30 })
    expect(detecterAlertesMeteo([prevision])).toHaveLength(0)
    expect(
      detecterAlertesMeteo([prevision], null, { seuils: { canicule: 30 } })
    ).toEqual([
      expect.objectContaining({ type: "canicule", niveau: "attention" }),
    ])
    expect(
      detecterAlertesMeteo(
        [jour({ date: "2026-08-11", tempMax: 40 })],
        null,
        { seuils: { canicule: 30 } }
      )[0].niveau
    ).toBe("danger")
  })

  it("conserve les seuils par défaut sans options.seuils", () => {
    const previsions = [
      jour({ date: "2026-08-10", tempMin: 0, tempMax: 35, windSpeedMax: 50, precipitation: 20 }),
    ]
    const avecSeuilsExplicites = detecterAlertesMeteo(previsions, null, {
      seuils: {
        gel: SEUILS_METEO.gel.tempMin,
        canicule: SEUILS_METEO.canicule.tempMax,
        ventFort: SEUILS_METEO.ventFort.vitesse,
        pluieAbondante: SEUILS_METEO.pluieAbondante.mm,
      },
    })
    expect(detecterAlertesMeteo(previsions)).toEqual(avecSeuilsExplicites)
  })
})

describe("formaterTemporaliteAlerte", () => {
  // Jeudi 13 août 2026 — référence fixe pour des tests déterministes.
  const reference = new Date(2026, 7, 13)

  it("indique « Aujourd'hui » avec le jour et la date en français", () => {
    expect(formaterTemporaliteAlerte("2026-08-13", reference)).toBe("Aujourd'hui (jeudi 13 août)")
  })

  it("indique « Demain » pour le lendemain", () => {
    expect(formaterTemporaliteAlerte("2026-08-14", reference)).toBe("Demain (vendredi 14 août)")
  })

  it("indique « le <jour> » au-delà de J+1", () => {
    expect(formaterTemporaliteAlerte("2026-08-15", reference)).toBe("le samedi 15 août")
  })

  it("retourne la date brute si le format est invalide", () => {
    expect(formaterTemporaliteAlerte("invalide", reference)).toBe("invalide")
  })
})

describe("indicationHoraireAlerte", () => {
  it("fournit une indication de moment pour chaque type d'alerte", () => {
    expect(indicationHoraireAlerte("gel")).toMatch(/fin de nuit/)
    expect(indicationHoraireAlerte("canicule")).toMatch(/début d'après-midi/)
    expect(indicationHoraireAlerte("vent")).toMatch(/l'après-midi/)
    expect(indicationHoraireAlerte("pluie")).toMatch(/journée/)
    expect(indicationHoraireAlerte("orage")).toMatch(/proximité immédiate/)
  })
})

describe("détection des stocks bas", () => {
  it("détecte les graines et plants sous leur seuil, y compris un stock nul", () => {
    const stocks = detecterStocksVarietesBas([
      {
        id: 1,
        varieteId: "carotte",
        varieteNom: "Carotte nantaise",
        stockGraines: 40,
        stockPlants: 0,
        stockMinGraines: 100,
        stockMinPlants: 5,
        uniteStock: "g",
      },
    ])

    expect(stocks).toHaveLength(2)
    expect(stocks.map((stock) => stock.ratio)).toEqual([0, 0.4])
    expect(stocks[0].quantite).toBe(0)
  })

  it("ignore une quantité égale ou supérieure au seuil et un seuil nul ou absent", () => {
    const stocks = detecterStocksVarietesBas([
      {
        id: 1,
        varieteId: "tomate",
        varieteNom: "Tomate",
        stockGraines: 100,
        stockPlants: 10,
        stockMinGraines: 100,
        stockMinPlants: 0,
        uniteStock: null,
      },
      {
        id: 2,
        varieteId: "laitue",
        varieteNom: "Laitue",
        stockGraines: 0,
        stockPlants: null,
        stockMinGraines: null,
        stockMinPlants: null,
        uniteStock: null,
      },
    ])

    expect(stocks).toEqual([])
  })

  it("détecte les fertilisants et aliments sous seuil", () => {
    const fertilisants = detecterStocksFertilisantsBas([
      { id: 1, fertilisantId: "compost", fertilisantNom: "compost", stock: 2, stockMin: 5 },
    ])
    const aliments = detecterStocksAlimentsBas([
      { id: 2, alimentId: "foin", alimentNom: "Foin", stock: 4, stockMin: 10 },
    ])

    expect(fertilisants[0].ratio).toBe(0.4)
    expect(aliments[0].ratio).toBe(0.4)
  })
})

describe("deciderIrrigationInutile", () => {
  it("inutile si >= 5 mm de pluie prévus le jour J", () => {
    expect(deciderIrrigationInutile({ pluiePrevue: 6, pluieRecente3j: 0, joursAvant: 0 })).toBe(true)
  })

  it("inutile si pluie récente >= 5 mm et échéance dans les 3 jours", () => {
    expect(deciderIrrigationInutile({ pluiePrevue: null, pluieRecente3j: 12, joursAvant: 1 })).toBe(true)
    // Échéance plus lointaine → la pluie récente ne couvre plus
    expect(deciderIrrigationInutile({ pluiePrevue: null, pluieRecente3j: 12, joursAvant: 5 })).toBe(false)
  })

  it("nécessaire si ni pluie prévue ni pluie récente", () => {
    expect(deciderIrrigationInutile({ pluiePrevue: 1, pluieRecente3j: 2, joursAvant: 0 })).toBe(false)
    expect(deciderIrrigationInutile({ pluiePrevue: null, pluieRecente3j: 0, joursAvant: 0 })).toBe(false)
  })
})
