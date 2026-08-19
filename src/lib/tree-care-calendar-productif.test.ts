import { afterEach, describe, expect, it, vi } from "vitest"
import { productifParDefaut } from "./tree-care-calendar"

/**
 * Friction du 2026-08-12 : un arbre saisi sans espèce et planté le jour même
 * ressortait « Productif : Oui » et gonflait le KPI « fruitiers productifs ».
 * `checkProductifCoherence` ne peut rien affirmer d'une espèce hors barème et
 * renvoie `null` — le défaut `!null?.tooYoung` valait donc `true`.
 */

const ANCRAGE = new Date("2026-08-12T10:00:00Z")

function ilYaAns(ans: number): Date {
  const d = new Date(ANCRAGE)
  d.setFullYear(d.getFullYear() - ans)
  return d
}

afterEach(() => {
  vi.useRealTimers()
})

function fige() {
  vi.useFakeTimers()
  vi.setSystemTime(ANCRAGE)
}

describe("productifParDefaut", () => {
  it("refuse le statut productif à un arbre planté le jour même, espèce inconnue", () => {
    fige()
    // Le cas exact remonté : espèce vide, plantation du jour.
    expect(productifParDefaut("", ANCRAGE)).toBe(false)
    expect(productifParDefaut(null, ANCRAGE)).toBe(false)
    // Espèce renseignée mais absente du barème (ornemental).
    expect(productifParDefaut("Lilas des Indes", ANCRAGE)).toBe(false)
  })

  it("refuse le statut productif sous l'âge d'entrée en production de l'espèce", () => {
    fige()
    // Pommier : 3 ans. Deux ans ne suffisent pas.
    expect(productifParDefaut("Pommier", ilYaAns(2))).toBe(false)
    // Noyer : 6 ans.
    expect(productifParDefaut("Noyer", ilYaAns(4))).toBe(false)
  })

  it("accorde le statut productif quand l'âge d'entrée en production est atteint", () => {
    fige()
    expect(productifParDefaut("Pommier", ilYaAns(5))).toBe(true)
    expect(productifParDefaut("Framboisier", ilYaAns(2))).toBe(true)
  })

  it("applique le plancher d'un an aux espèces hors barème, puis les laisse productives", () => {
    fige()
    // Le plancher ne dépend d'aucun référentiel : il ne dit rien au-delà d'un an.
    expect(productifParDefaut("Lilas des Indes", ilYaAns(3))).toBe(true)
    expect(productifParDefaut("", ilYaAns(3))).toBe(true)
  })

  it("laisse le comportement d'origine quand la date de plantation manque ou est illisible", () => {
    fige()
    // `POST /api/arbres` exige la date, mais les autres chemins d'écriture non :
    // sans date, aucun âge n'est calculable et on ne présume rien.
    expect(productifParDefaut("Pommier", null)).toBe(true)
    expect(productifParDefaut("Pommier", undefined)).toBe(true)
    expect(productifParDefaut("Pommier", "pas-une-date")).toBe(true)
  })

  it("accepte une date ISO comme chaîne", () => {
    fige()
    expect(productifParDefaut("Pommier", "2026-08-12")).toBe(false)
    expect(productifParDefaut("Pommier", "2015-03-01")).toBe(true)
  })
})
