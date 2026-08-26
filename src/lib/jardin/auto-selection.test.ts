import { describe, expect, it } from "vitest"
import {
  parcelleAutoSelectionnee,
  parcelleHabitee,
  parcellePorteUsage,
  type ParcelleCandidate,
} from "./auto-selection"

const parcelle = (p: Partial<ParcelleCandidate> & { id: string }): ParcelleCandidate => ({
  usage: "culture",
  plancheCount: 0,
  arbreCount: 0,
  ...p,
})

describe("sélection automatique de la parcelle du plan", () => {
  it("retient la parcelle unique quand elle porte des planches", () => {
    const parcelles = [
      parcelle({ id: "cult", plancheCount: 3 }),
      parcelle({ id: "verger", usage: "verger", arbreCount: 5 }),
    ]
    expect(parcelleAutoSelectionnee(parcelles, "culture")).toBe("cult")
  })

  it("montre tout plutôt qu'un plan vide quand la seule parcelle n'a rien", () => {
    // Le cas vécu le 2026-08-17 : parcelle cadastrale importée, trois planches
    // créées avant elle donc non rattachées. L'ancienne règle la retenait
    // quand même et l'API ne renvoyait aucune planche.
    const parcelles = [parcelle({ id: "cadastre", plancheCount: 0 })]
    expect(parcelleAutoSelectionnee(parcelles, "culture")).toBeNull()
  })

  it("montre tout dès que plusieurs parcelles portent l'usage", () => {
    const parcelles = [
      parcelle({ id: "a", plancheCount: 12 }),
      parcelle({ id: "b", plancheCount: 1 }),
    ]
    expect(parcelleAutoSelectionnee(parcelles, "culture")).toBeNull()
  })

  it("compte les arbres, pas les planches, pour le verger", () => {
    const verger = parcelle({ id: "v", usage: "verger", arbreCount: 4, plancheCount: 0 })
    expect(parcelleHabitee(verger, "verger")).toBe(true)
    expect(parcelleAutoSelectionnee([verger], "verger")).toBe("v")
  })

  it("lit un usage multiple", () => {
    const mixte = parcelle({ id: "m", usage: "culture, verger", arbreCount: 2 })
    expect(parcellePorteUsage(mixte, "verger")).toBe(true)
    expect(parcellePorteUsage(mixte, "culture")).toBe(true)
    expect(parcellePorteUsage(mixte, "paturage")).toBe(false)
  })

  it("montre tout quand aucune parcelle ne porte l'usage", () => {
    expect(parcelleAutoSelectionnee([parcelle({ id: "a" })], "verger")).toBeNull()
    expect(parcelleAutoSelectionnee([], "culture")).toBeNull()
  })
})
