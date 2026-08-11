import { describe, expect, it } from "vitest"
import { construireResume, grouperTachesParType, nombreTachesAFaire } from "./resume"
import { getMeteoIntervalMinutes, getResumeCronExpression, parseHeureResume } from "./config"
import type { TacheJour } from "./types"

const tacheSemis: TacheJour = {
  id: 1,
  type: "semis",
  especeNom: "Carotte",
  varieteNom: null,
  plancheName: "S1",
  ilot: "A",
  date: "2026-08-10T08:00:00.000Z",
  fait: false,
  couleur: "#22c55e",
}

const tacheIrrigation: TacheJour = {
  id: 2,
  type: "irrigation",
  especeNom: "Tomate + Laitue",
  varieteNom: null,
  plancheName: "S4",
  ilot: "A",
  date: "2026-08-10T06:00:00.000Z",
  fait: false,
  couleur: "#0ea5e9",
  pluiePrevue: 8,
  probablementInutile: true,
}

const tacheRecolteFait: TacheJour = {
  id: 3,
  type: "recolte",
  especeNom: "Courgette",
  varieteNom: null,
  plancheName: null,
  ilot: null,
  date: "2026-08-10T10:00:00.000Z",
  fait: true,
  couleur: null,
}

describe("construireResume", () => {
  it("assemble un résumé avec date par défaut", () => {
    const resume = construireResume([tacheSemis], [])
    expect(resume.taches).toHaveLength(1)
    expect(resume.alertesMeteo).toHaveLength(0)
    expect(resume.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("trie les tâches par date puis par type", () => {
    const resume = construireResume([tacheSemis, tacheIrrigation, tacheRecolteFait], [])
    expect(resume.taches.map((t) => t.id)).toEqual([2, 1, 3])
  })

  it("trie les alertes météo par date", () => {
    const resume = construireResume([], [
      { type: "canicule", date: "2026-08-12", niveau: "attention", message: "x", details: "y", key: "canicule:2026-08-12" },
      { type: "gel", date: "2026-08-10", niveau: "attention", message: "x", details: "y", key: "gel:2026-08-10" },
    ])
    expect(resume.alertesMeteo.map((a) => a.date)).toEqual(["2026-08-10", "2026-08-12"])
  })
})

describe("grouperTachesParType / nombreTachesAFaire", () => {
  it("regroupe par type", () => {
    const groupes = grouperTachesParType([tacheSemis, tacheIrrigation, tacheRecolteFait])
    expect(groupes.get("semis")).toHaveLength(1)
    expect(groupes.get("irrigation")).toHaveLength(1)
    expect(groupes.get("recolte")).toHaveLength(1)
  })

  it("compte les tâches restant à faire", () => {
    expect(nombreTachesAFaire([tacheSemis, tacheIrrigation, tacheRecolteFait])).toBe(2)
  })
})

describe("config du scheduler", () => {
  it("parse HH:MM valide", () => {
    expect(parseHeureResume("07:00")).toEqual({ hour: 7, minute: 0 })
    expect(parseHeureResume("23:59")).toEqual({ hour: 23, minute: 59 })
  })

  it("rejette les heures invalides", () => {
    expect(parseHeureResume("24:00")).toBeNull()
    expect(parseHeureResume("07:60")).toBeNull()
    expect(parseHeureResume("abc")).toBeNull()
    expect(parseHeureResume(undefined)).toBeNull()
  })

  it("génère l'expression cron du résumé (défaut 07:00)", () => {
    expect(getResumeCronExpression({})).toBe("0 7 * * *")
    expect(getResumeCronExpression({ NOTIF_RESUME_HEURE: "06:45" })).toBe("45 6 * * *")
    expect(getResumeCronExpression({ NOTIF_RESUME_HEURE: "invalide" })).toBe("0 7 * * *")
  })

  it("borne l'intervalle météo (défaut 30, min 5)", () => {
    expect(getMeteoIntervalMinutes({})).toBe(30)
    expect(getMeteoIntervalMinutes({ NOTIF_METEO_INTERVAL_MIN: "10" })).toBe(10)
    expect(getMeteoIntervalMinutes({ NOTIF_METEO_INTERVAL_MIN: "2" })).toBe(5)
    expect(getMeteoIntervalMinutes({ NOTIF_METEO_INTERVAL_MIN: "99999" })).toBe(1440)
    expect(getMeteoIntervalMinutes({ NOTIF_METEO_INTERVAL_MIN: "abc" })).toBe(30)
  })
})
