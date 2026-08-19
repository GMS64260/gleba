import { describe, expect, it } from "vitest"
import { getMeteoCronExpression, getMeteoIntervalMinutes, getResumeCronExpression, parseHeureResume } from "./config"

describe("parseHeureResume", () => {
  it("accepte HH:MM et H:MM", () => {
    expect(parseHeureResume("07:00")).toEqual({ hour: 7, minute: 0 })
    expect(parseHeureResume("7:30")).toEqual({ hour: 7, minute: 30 })
  })

  it("rejette les valeurs hors bornes ou mal formées", () => {
    expect(parseHeureResume("24:00")).toBeNull()
    expect(parseHeureResume("07:60")).toBeNull()
    expect(parseHeureResume("sept heures")).toBeNull()
    expect(parseHeureResume(undefined)).toBeNull()
  })
})

describe("getResumeCronExpression", () => {
  it("retombe sur 07:00 sans configuration", () => {
    expect(getResumeCronExpression({})).toBe("0 7 * * *")
  })

  it("suit NOTIF_RESUME_HEURE", () => {
    expect(getResumeCronExpression({ NOTIF_RESUME_HEURE: "06:15" })).toBe("15 6 * * *")
  })
})

describe("getMeteoCronExpression", () => {
  it("utilise le champ minutes en dessous d'une heure", () => {
    expect(getMeteoCronExpression({})).toBe("*/30 * * * *")
    expect(getMeteoCronExpression({ NOTIF_METEO_INTERVAL_MIN: "5" })).toBe("*/5 * * * *")
    expect(getMeteoCronExpression({ NOTIF_METEO_INTERVAL_MIN: "45" })).toBe("*/45 * * * *")
  })

  it("bascule sur le champ heures dès 60 min — le champ minutes s'arrête à 59", () => {
    // `*/120 * * * *` n'est pas une expression cron valide : node-cron la
    // rejetait, ce qui empêchait aussi la planification du résumé quotidien.
    expect(getMeteoCronExpression({ NOTIF_METEO_INTERVAL_MIN: "60" })).toBe("0 * * * *")
    expect(getMeteoCronExpression({ NOTIF_METEO_INTERVAL_MIN: "120" })).toBe("0 */2 * * *")
    expect(getMeteoCronExpression({ NOTIF_METEO_INTERVAL_MIN: "1440" })).toBe("0 */24 * * *")
  })

  it("arrondit à l'heure pleine inférieure les pas non exprimables en cron", () => {
    expect(getMeteoCronExpression({ NOTIF_METEO_INTERVAL_MIN: "90" })).toBe("0 * * * *")
    expect(getMeteoCronExpression({ NOTIF_METEO_INTERVAL_MIN: "150" })).toBe("0 */2 * * *")
  })

  it("ne produit jamais un champ minutes hors bornes, quelle que soit l'entrée", () => {
    for (const valeur of ["0", "1", "59", "60", "61", "999", "99999", "abc", ""]) {
      const expression = getMeteoCronExpression({ NOTIF_METEO_INTERVAL_MIN: valeur })
      const minutes = expression.split(" ")[0]
      const pas = minutes.startsWith("*/") ? Number(minutes.slice(2)) : Number(minutes)
      expect(pas).toBeGreaterThanOrEqual(0)
      expect(pas).toBeLessThanOrEqual(59)
    }
  })

  it("borne l'intervalle brut à [5, 1440]", () => {
    expect(getMeteoIntervalMinutes({ NOTIF_METEO_INTERVAL_MIN: "1" })).toBe(5)
    expect(getMeteoIntervalMinutes({ NOTIF_METEO_INTERVAL_MIN: "99999" })).toBe(1440)
  })
})
