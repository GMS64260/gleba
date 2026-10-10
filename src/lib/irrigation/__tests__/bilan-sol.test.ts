/**
 * Moteur de bilan hydrique du sol (itération du 2026-10-10) : scénarios
 * agronomiques de référence.
 */
import { describe, expect, it } from "vitest"
import {
  bilanReserveSol,
  eauDisponibleSol,
  profilEspece,
  pluieUtile,
  type EntreeBilanSol,
  type JourMeteoBilan,
} from "../bilan-sol"

const AUJOURDHUI = "2026-07-20"

function jours(n: number, fin: string, valeur: (i: number) => { pluie: number; et0: number }): JourMeteoBilan[] {
  const t = Date.parse(`${fin}T12:00:00`)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(t - (n - 1 - i) * 86_400_000)
    return { date: d.toISOString().slice(0, 10), ...valeur(i) }
  })
}
function apres(n: number, valeur: (i: number) => { pluie: number; et0: number }): JourMeteoBilan[] {
  const t = Date.parse(`${AUJOURDHUI}T12:00:00`)
  return Array.from({ length: n }, (_, i) => ({
    date: new Date(t + (i + 1) * 86_400_000).toISOString().slice(0, 10),
    ...valeur(i),
  }))
}

function entree(o: Partial<EntreeBilanSol> & { et0?: number } = {}): EntreeBilanSol {
  const et0 = o.et0 ?? 5
  return {
    historique: o.historique ?? jours(30, "2026-07-19", () => ({ pluie: 0, et0 })),
    aujourdhui: o.aujourdhui ?? { date: AUJOURDHUI, pluie: 0, et0 },
    previsions: o.previsions ?? apres(7, () => ({ pluie: 0, et0 })),
    joursArroses: o.joursArroses ?? [],
    sol: o.sol ?? { typeSol: "Limoneux", retentionEau: null },
    culture: {
      espece: "Tomate",
      besoinEau: 5,
      debut: "2026-05-15",
      dureeCycleJours: 140,
      sousAbri: false,
      ...(o.culture ?? {}),
    },
  }
}

const RANG = { critique: 0, haute: 1, moyenne: 2, faible: 3, aucune: 4 } as const

describe("bilanReserveSol", () => {
  it("canicule sans pluie ni arrosage depuis 30 jours : critique, dose pour remplir la réserve", () => {
    const r = bilanReserveSol(entree())
    expect(r.urgence).toBe("critique")
    expect(r.joursAvantSeuil).toBe(0)
    expect(r.doseMm).toBeGreaterThan(30)
    expect(r.raison).toMatch(/^À arroser/)
  })

  it("arrosé hier : rien à faire aujourd'hui, seuil dans quelques jours", () => {
    const r = bilanReserveSol(entree({ joursArroses: ["2026-07-19"] }))
    expect(["aucune", "faible"]).toContain(r.urgence)
    // Seuil au-delà de l'horizon (null) ou dans plusieurs jours.
    expect(r.joursAvantSeuil === null || r.joursAvantSeuil > 1).toBe(true)
    expect(r.dernierApport).toEqual({ type: "arrosage", date: "2026-07-19", mm: null })
  })

  it("forte pluie avant-hier sur un sol régulièrement arrosé par la pluie : réserve rechargée", () => {
    const historique = jours(30, "2026-07-19", (i) => ({ pluie: i === 28 ? 40 : i % 4 === 0 ? 15 : 0, et0: 5 }))
    const r = bilanReserveSol(entree({ historique }))
    expect(RANG[r.urgence]).toBeGreaterThanOrEqual(RANG.faible)
    expect(r.dernierApport).toEqual({ type: "pluie", date: "2026-07-18", mm: 40 })
  })

  it("après un mois de canicule, une seule pluie de 40 mm ne remplit pas une réserve profonde", () => {
    const historique = jours(30, "2026-07-19", (i) => ({ pluie: i === 28 ? 40 : 0, et0: 5 }))
    const r = bilanReserveSol(entree({ historique }))
    // 34 mm utiles pour une réserve de plus de 100 mm presque vide.
    expect(r.reserveUtileMm).toBeGreaterThan(100)
    expect(RANG[r.urgence]).toBeLessThanOrEqual(RANG.haute)
  })

  it("une bruine de 2 mm n'apporte rien", () => {
    expect(pluieUtile(2)).toBe(0)
    expect(pluieUtile(12)).toBeCloseTo(9)
  })

  it("une pluie annoncée qui remplit la réserve dispense d'arroser une réserve entamée", () => {
    // Arrosé il y a 6 jours : réserve facile presque consommée.
    const base = entree({ joursArroses: ["2026-07-14"] })
    const sansPluie = bilanReserveSol(base)
    const avecPluie = bilanReserveSol({ ...base, previsions: apres(7, (i) => ({ pluie: i === 0 ? 30 : 0, et0: 5 })) })
    expect(RANG[avecPluie.urgence]).toBeGreaterThan(RANG[sansPluie.urgence])
    expect(avecPluie.raison).toMatch(/pluie prévus/)
  })

  it("un sol sableux s'épuise plus vite qu'un sol argileux", () => {
    const parSol = (typeSol: string) => bilanReserveSol(entree({ joursArroses: ["2026-07-15"], sol: { typeSol, retentionEau: null } }))
    expect(eauDisponibleSol({ typeSol: "Sableux", retentionEau: null })).toBeLessThan(eauDisponibleSol({ typeSol: "Argileux", retentionEau: null }))
    expect(parSol("Sableux").tauxEpuisement).toBeGreaterThan(parSol("Argileux").tauxEpuisement)
  })

  it("une espèce gourmande (besoin 5) n'est jamais moins urgente qu'une sobre (besoin 1)", () => {
    for (const et0 of [0.6, 1.5, 3, 5]) {
      const r = (besoinEau: number) =>
        bilanReserveSol(entree({ et0, joursArroses: ["2026-07-12"], culture: { espece: "Espèce inconnue", besoinEau } as never }))
      expect(r(5).tauxEpuisement).toBeGreaterThanOrEqual(r(1).tauxEpuisement)
      expect(RANG[r(5).urgence]).toBeLessThanOrEqual(RANG[r(1).urgence])
    }
  })

  it("hiver (ET0 0,6 mm/j, pluie hebdomadaire) : rien à arroser", () => {
    const historique = jours(30, "2026-07-19", (i) => ({ pluie: i % 7 === 0 ? 8 : 0, et0: 0.6 }))
    const r = bilanReserveSol(entree({ et0: 0.6, historique, culture: { espece: "Poireau", besoinEau: 3 } as never }))
    expect(RANG[r.urgence]).toBeGreaterThanOrEqual(RANG.faible)
  })

  it("sous abri, la pluie ne compte pas et l'ET est réduite", () => {
    const pluvieux = jours(30, "2026-07-19", () => ({ pluie: 10, et0: 4 }))
    const dehors = bilanReserveSol(entree({ et0: 4, historique: pluvieux }))
    const abri = bilanReserveSol(entree({ et0: 4, historique: pluvieux, culture: { sousAbri: true } as never }))
    expect(dehors.urgence).toBe("aucune")
    expect(RANG[abri.urgence]).toBeLessThanOrEqual(RANG.haute)
    expect(abri.etcJour).toBeCloseTo(dehors.etcJour * 0.8, 1)
    expect(abri.raison).toMatch(/^Sous abri/)
  })

  it("une culture pas encore en terre ne consomme rien", () => {
    const r = bilanReserveSol(entree({ culture: { debut: "2026-07-20" } as never }))
    expect(r.depletionMm).toBeLessThan(5)
  })

  it("les racines d'une jeune culture limitent sa réserve", () => {
    const jeune = bilanReserveSol(entree({ culture: { debut: "2026-07-10" } as never }))
    const adulte = bilanReserveSol(entree({ culture: { debut: "2026-04-15" } as never }))
    expect(jeune.profondeurRacinesM).toBeLessThan(adulte.profondeurRacinesM)
    expect(jeune.reserveUtileMm).toBeLessThan(adulte.reserveUtileMm)
  })

  it("reconnaît une espèce par son premier mot et retombe sur le besoin en eau sinon", () => {
    expect(profilEspece("Tomate cerise", 3).racinesM).toBe(0.7)
    expect(profilEspece("tomate", 3).p).toBe(0.4)
    expect(profilEspece("Inconnue", 5).p).toBeLessThan(profilEspece("Inconnue", 1).p)
  })
})
