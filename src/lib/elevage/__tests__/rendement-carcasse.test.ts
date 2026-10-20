import { describe, expect, it } from "vitest"

import {
  RENDEMENT_CARCASSE_ERREUR_API,
  RENDEMENT_CARCASSE_ERREUR_SAISIE,
  rendementCarcasseDepuisSaisie,
  rendementCarcasseEnRatio,
  rendementCarcassePourSaisie,
  validerRendementCarcasseApi,
} from "../rendement-carcasse"

// QA cmvgeif10 — « Rendement carc. (%) » refusait 65 et exigeait 0,65.
describe("rendement carcasse : ratio stocké, pourcentage saisi", () => {
  it("convertit la saisie en pourcentage en ratio pour l'API", () => {
    expect(rendementCarcasseDepuisSaisie("65")).toEqual({ ok: true, ratio: 0.65 })
    expect(rendementCarcasseDepuisSaisie("72,5")).toEqual({ ok: true, ratio: 0.725 })
    expect(rendementCarcasseDepuisSaisie("100")).toEqual({ ok: true, ratio: 1 })
    expect(rendementCarcasseDepuisSaisie("  ")).toEqual({ ok: true, ratio: null })
  })

  it("refuse une saisie hors [1, 100] en nommant le champ et l'unité", () => {
    for (const saisie of ["0", "-3", "120", "abc", "0,99"]) {
      expect(rendementCarcasseDepuisSaisie(saisie)).toEqual({ ok: false, erreur: RENDEMENT_CARCASSE_ERREUR_SAISIE })
    }
    expect(rendementCarcasseDepuisSaisie("1")).toEqual({ ok: true, ratio: 0.01 })
    expect(RENDEMENT_CARCASSE_ERREUR_SAISIE).toContain("Rendement carcasse")
    expect(RENDEMENT_CARCASSE_ERREUR_SAISIE).toContain("pourcentage entre 1 et 100")
  })

  // Revue du 2026-10-20 — l'ancien champ exigeait un ratio (placeholder
  // « 0.72 ») et le ticket a créé son profil en saisissant 0,65 : la même
  // saisie ne doit pas devenir 0,65 % (ratio 0,0065) en silence.
  it("refuse « 0,65 » tapé par habitude de l'ancien ratio au lieu de l'enregistrer comme 0,65 %", () => {
    expect(rendementCarcasseDepuisSaisie("0,65").ok).toBe(false)
    expect(rendementCarcasseDepuisSaisie("0.72").ok).toBe(false)
  })

  it("affiche le ratio stocké en pourcentage, sans bavure du flottant", () => {
    expect(rendementCarcassePourSaisie(0.72)).toBe("72")
    expect(rendementCarcassePourSaisie(0.65)).toBe("65")
    expect(rendementCarcassePourSaisie(0.725)).toBe("72.5")
    expect(rendementCarcassePourSaisie(null)).toBe("")
    expect(rendementCarcassePourSaisie(0)).toBe("")
  })

  it("ramène en ratio les anciennes entrées du catalogue saisies en pourcentage", () => {
    expect(rendementCarcasseEnRatio(75)).toBe(0.75)
    expect(rendementCarcasseEnRatio(45)).toBe(0.45)
    expect(rendementCarcasseEnRatio(0.72)).toBe(0.72)
    expect(rendementCarcasseEnRatio(1)).toBe(1)
    expect(rendementCarcasseEnRatio(null)).toBeNull()
    expect(rendementCarcassePourSaisie(75)).toBe("75")
  })

  it("la règle de route n'accepte qu'un ratio dans ]0, 1]", () => {
    expect(validerRendementCarcasseApi(undefined)).toEqual({ ok: true, ratio: undefined })
    expect(validerRendementCarcasseApi(null)).toEqual({ ok: true, ratio: null })
    expect(validerRendementCarcasseApi(0.65)).toEqual({ ok: true, ratio: 0.65 })
    expect(validerRendementCarcasseApi(0.01)).toEqual({ ok: true, ratio: 0.01 })
    for (const valeur of [65, 0, 0.0065, -0.1, 1.01, "0.65", Number.NaN]) {
      expect(validerRendementCarcasseApi(valeur)).toEqual({ ok: false, erreur: RENDEMENT_CARCASSE_ERREUR_API })
    }
    expect(RENDEMENT_CARCASSE_ERREUR_API).toContain("rendementCarcasse")
    expect(RENDEMENT_CARCASSE_ERREUR_API).toContain("ratio")
  })
})
