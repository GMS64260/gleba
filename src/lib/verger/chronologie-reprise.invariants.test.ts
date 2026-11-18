import { describe, expect, it } from "vitest"
import { calculerResumeReprise } from "./chronologie-reprise"

const GRAINE = 20261118
describe(`Chronologie de reprise — 300 permutations, graine ${GRAINE}`, () => {
  it("ne dépend pas de l'arrivée, sauf du dernier id à date égale, et distingue zéro de l'absence", () => {
    console.info(`Chronologie de reprise : graine ${GRAINE}, 300 permutations`)
    let etat = GRAINE
    const aleatoire = () => {
      etat = (Math.imul(etat, 1664525) + 1013904223) >>> 0
      return etat / 4294967296
    }
    for (let essai = 0; essai < 300; essai++) {
      const observations = Array.from({ length: 12 + Math.floor(aleatoire() * 30) }, (_, i) => ({
        date: new Date(Date.UTC(2026, 0, i + 1)),
        tauxReprise: i % 5 === 0 ? null : Math.floor(aleatoire() * 101),
      }))
      // Le taux le plus récent est explicitement nul une fois sur deux.
      observations[observations.length - 1].tauxReprise = essai % 2 === 0 ? 0 : 100
      const attendue = observations[observations.length - 1]
      const melange = [...observations]
      for (let i = melange.length - 1; i > 0; i--) {
        const j = Math.floor(aleatoire() * (i + 1))
        ;[melange[i], melange[j]] = [melange[j], melange[i]]
      }
      if (melange.every((o, i) => o === observations[i])) melange.reverse()
      const arrivees = melange.map((o, i) => ({ ...o, id: i + 1 }))
      expect(calculerResumeReprise(arrivees)).toEqual({
        tauxReprise: attendue.tauxReprise, dateDernObservation: attendue.date,
      })
      expect(calculerResumeReprise([...arrivees].reverse())).toEqual(calculerResumeReprise(arrivees))

      const sansTaux = { id: arrivees.length + 1, date: new Date("2027-01-01"), tauxReprise: null }
      expect(calculerResumeReprise([...arrivees, sansTaux])).toEqual(calculerResumeReprise(arrivees))
      expect(calculerResumeReprise([sansTaux])).toEqual({ tauxReprise: null, dateDernObservation: null })

      // Une arrivée à la même date est autorisée à remplacer le taux : id supérieur.
      const egalite = { id: arrivees.length + 2, date: attendue.date, tauxReprise: 37 }
      const avecEgalite = [...arrivees, sansTaux, egalite]
      expect(calculerResumeReprise(avecEgalite)).toEqual({ tauxReprise: 37, dateDernObservation: attendue.date })
      expect(calculerResumeReprise(avecEgalite.reverse())).toEqual({ tauxReprise: 37, dateDernObservation: attendue.date })
    }
  })
})
