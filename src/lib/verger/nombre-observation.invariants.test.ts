import { describe, expect, it } from "vitest"
import { lireNombreObservation, NombreObservationInvalide } from "./nombre-observation"

// Graine fixe affichée dans le nom du test pour reproduire toute séquence.
const GRAINE = 20261117

describe("invariants des nombres d'une observation de campagne", () => {
  it(`préserve les nombres et leur forme texte sur 512 entrées (graine ${GRAINE})`, () => {
    let etat = GRAINE
    const aleatoire = () => {
      etat = (Math.imul(etat, 1664525) + 1013904223) >>> 0
      return etat / 2 ** 32
    }
    for (let i = 0; i < 512; i++) {
      const effectif = i === 0 ? 0 : Math.floor(aleatoire() * 100000)
      const taux = i === 0 ? 0 : Math.floor(aleatoire() * 10001) / 100
      const hauteur = i === 0 ? 0 : Math.floor(aleatoire() * 100000) / 100
      for (const champ of ["nbVivants", "nbMorts", "nbManquants"] as const) {
        expect(lireNombreObservation(effectif, champ)).toBe(effectif)
        expect(lireNombreObservation(String(effectif), champ)).toBe(effectif)
        for (const invalide of [-effectif - 1, effectif + 0.5]) {
          expect(() => lireNombreObservation(invalide, champ)).toThrow(NombreObservationInvalide)
          expect(() => lireNombreObservation(String(invalide), champ)).toThrow(NombreObservationInvalide)
        }
      }
      expect(lireNombreObservation(taux, "tauxReprise")).toBe(taux)
      expect(lireNombreObservation(String(taux), "tauxReprise")).toBe(taux)
      expect(() => lireNombreObservation(100 + taux + 0.01, "tauxReprise")).toThrow(NombreObservationInvalide)
      expect(() => lireNombreObservation(-taux - 0.01, "tauxReprise")).toThrow(NombreObservationInvalide)
      expect(lireNombreObservation(hauteur, "hauteurMoyenneCm")).toBe(hauteur)
      expect(lireNombreObservation(String(hauteur), "hauteurMoyenneCm")).toBe(hauteur)
    }
  })

  it("ne fabrique aucun zéro pour une absence, quel que soit le champ", () => {
    for (const champ of ["nbVivants", "nbMorts", "nbManquants", "tauxReprise", "hauteurMoyenneCm"] as const) {
      for (const absence of [undefined, null, "", " \t\n"]) expect(lireNombreObservation(absence, champ)).toBeNull()
      for (const invalide of [NaN, Infinity, -Infinity, "NaN", "Infinity", "-Infinity", "1e999"]) {
        expect(() => lireNombreObservation(invalide, champ)).toThrow(NombreObservationInvalide)
      }
    }
  })
})
