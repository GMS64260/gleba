import { describe, expect, it } from "vitest"
import { chaleurHoraire, cumulsQuotidiens, heuresDeFroid, portionsDeFroidHoraires, uniteUtah } from "./froid-chaleur"
import { soleilDuJour, temperaturesHoraires, type JourMinMax } from "./heures"

/**
 * Série synthétique de 120 jours à partir du 1er novembre, latitude 43,3° N.
 * Les valeurs attendues viennent d'une transcription ligne à ligne des
 * fonctions `daylength`, `make_hourly_temps` et `chilling` du paquet R chillR
 * (CRAN, version de novembre 2026), exécutée sur la même série.
 */
function serieTemoin(): JourMinMax[] {
  const jours: JourMinMax[] = []
  for (let k = 0; k < 120; k++) {
    const tmin = Math.round((3 + 6 * Math.sin(k / 9) - 4 * Math.cos(k / 31)) * 10) / 10
    const tmax = Math.round((tmin + 7 + 4 * Math.sin(k / 5)) * 10) / 10
    jours.push({ rang: ((305 + k - 1) % 365) + 1, tmin, tmax })
  }
  return jours
}

describe("durée du jour", () => {
  it("retrouve le solstice d'été à 43,3° N", () => {
    const s = soleilDuJour(43.3, 172)
    expect(s.lever).toBeCloseTo(4.299659, 5)
    expect(s.coucher).toBeCloseTo(19.700341, 5)
    expect(s.duree).toBeCloseTo(15.400682, 5)
  })

  it("rend une nuit ou un jour polaire sans lever ni coucher", () => {
    expect(soleilDuJour(80, 355).duree).toBe(0)
    expect(soleilDuJour(80, 172).duree).toBe(24)
  })
})

describe("températures horaires", () => {
  it("reproduit chillR sur le deuxième jour de la série témoin", () => {
    const heures = temperaturesHoraires(43.3, serieTemoin()).slice(24, 48)
    const attendu = [
      0.7015, 0.486091, 0.293797, 0.120134, -0.038191, -0.183669, -0.31823, -0.059947, 1.635668, 3.237973, 4.669726,
      5.861908, 6.757048, 7.311996, 7.5, 7.311996, 6.757048, 5.861908, 4.463546, 3.598228, 2.995164, 2.531828,
      2.155498, 1.838606,
    ]
    heures.forEach((t, h) => expect(t).toBeCloseTo(attendu[h], 5))
  })

  it("reste entre le minimum et le maximum pendant la journée", () => {
    const jours = serieTemoin()
    const heures = temperaturesHoraires(43.3, jours)
    for (let h = 9; h <= 16; h++) {
      const t = heures[24 * 10 + h]
      expect(t).toBeGreaterThanOrEqual(jours[10].tmin)
      expect(t).toBeLessThanOrEqual(jours[10].tmax)
    }
  })

  it("donne le minimum au matin du premier jour et au soir du dernier", () => {
    const jours = serieTemoin().slice(0, 3)
    const heures = temperaturesHoraires(43.3, jours)
    expect(heures[0]).toBe(jours[0].tmin)
    expect(heures[24 * 2 + 23]).toBe(jours[2].tmin)
  })

  it("prend la moyenne du jour sous jour polaire", () => {
    const heures = temperaturesHoraires(80, [{ rang: 172, tmin: 2, tmax: 6 }])
    expect(new Set(heures)).toEqual(new Set([4]))
  })
})

describe("froid et chaleur", () => {
  it("reproduit chillR sur la série témoin", () => {
    const cumuls = cumulsQuotidiens(temperaturesHoraires(43.3, serieTemoin()))
    const fin = cumuls[cumuls.length - 1]
    expect(cumuls).toHaveLength(120)
    expect(fin.heuresFroid).toBe(1384)
    expect(fin.unitesUtah).toBe(1657)
    expect(fin.portionsFroid).toBeCloseTo(77.677472, 5)
    expect(fin.chaleur).toBeCloseTo(8067.804453, 4)
  })

  it("acquiert une portion de froid en 29 heures environ à 6 °C", () => {
    const portions = portionsDeFroidHoraires(new Array(1000).fill(6))
    const total = portions.reduce((s, p) => s + p, 0)
    expect(total).toBeCloseTo(34.204222, 5)
    expect(portions[0]).toBe(0)
  })

  it("n'acquiert aucun froid à 20 °C", () => {
    const total = portionsDeFroidHoraires(new Array(500).fill(20)).reduce((s, p) => s + p, 0)
    expect(total).toBe(0)
  })

  it("ne compte pas le gel dans les heures de froid", () => {
    expect(heuresDeFroid(-0.1)).toBe(0)
    expect(heuresDeFroid(0)).toBe(1)
    expect(heuresDeFroid(7.2)).toBe(1)
    expect(heuresDeFroid(7.3)).toBe(0)
  })

  it("retire du froid aux heures douces dans le modèle Utah", () => {
    expect([1, 2, 5, 10, 14, 17, 20].map(uniteUtah)).toEqual([0, 0.5, 1, 0.5, 0, -0.5, -1])
  })

  it("compte la chaleur entre 4 et 36 °C, avec un optimum à 25 °C", () => {
    expect(chaleurHoraire(3.9)).toBe(0)
    expect(chaleurHoraire(4)).toBeCloseTo(0, 10)
    expect(chaleurHoraire(25)).toBeCloseTo(21, 10)
    expect(chaleurHoraire(36)).toBeCloseTo(0, 10)
    expect(chaleurHoraire(36.1)).toBe(0)
    expect(chaleurHoraire(14.5)).toBeCloseTo(10.5, 10)
  })
})
