import { describe, expect, it } from "vitest"
import { getISOWeek, getISOWeekYear } from "date-fns"

import {
  calculerDateDepuisSemaine,
  dateSemaineChrono,
  getSemaineDepuisDate,
} from "@/lib/assistant-helpers"
import { anneesMaraichage } from "@/lib/dashboard-year"

/**
 * QA cmswxqnaz — invariant d'aller-retour de la semaine.
 *
 * `calculerDateDepuisSemaine` écrit des dates en base (creer-cultures,
 * assistant) que la planification relit en semaine ISO. Les deux sens doivent
 * donner le même numéro, y compris les années dont le 1er janvier tombe un
 * vendredi, samedi ou dimanche : là, la convention « semaine contenant le
 * 1er janvier » décalait tout d'une semaine (culture 2028 créée en S31 relue
 * en S30, culture en S01 exclue de la vue annuelle).
 */

// 2026 : jeudi · 2027 : vendredi · 2028 : samedi · 2029 : lundi · 2033 : samedi
const ANNEES = [2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]

// Reproduit la lecture de `dateVersSemaine` (src/lib/planification.ts) :
// midi pour neutraliser le décalage de fuseau des dates persistées.
const semaineRelue = (d: Date) => getISOWeek(new Date(d.getTime() + 12 * 3_600_000))
const anneeRelue = (d: Date) => getISOWeekYear(new Date(d.getTime() + 12 * 3_600_000))

describe("aller-retour semaine ↔ date", () => {
  it("relit la semaine écrite, pour toute année et toute semaine", () => {
    for (const annee of ANNEES) {
      for (let semaine = 1; semaine <= 52; semaine++) {
        const date = calculerDateDepuisSemaine(annee, semaine)
        expect(semaineRelue(date), `${annee} S${semaine}`).toBe(semaine)
      }
    }
  })

  it("garde la culture dans son année, dès la semaine 1", () => {
    for (const annee of ANNEES) {
      expect(anneeRelue(calculerDateDepuisSemaine(annee, 1)), `${annee} S01`).toBe(annee)
    }
  })

  it("renvoie toujours un lundi", () => {
    for (const annee of ANNEES) {
      expect(calculerDateDepuisSemaine(annee, 31).getDay(), `${annee}`).toBe(1)
    }
  })

  it("reporte à l'année suivante une étape antérieure à sa référence", () => {
    // Semis S40, récolte S02 → la récolte tombe en janvier de l'année suivante.
    const recolte = dateSemaineChrono(2027, 2, 40)
    expect(anneeRelue(recolte)).toBe(2028)
    expect(semaineRelue(recolte)).toBe(2)
  })

  it("expose la même convention en lecture directe", () => {
    for (const annee of ANNEES) {
      const date = calculerDateDepuisSemaine(annee, 18)
      expect(getSemaineDepuisDate(date), `${annee}`).toBe(18)
    }
  })
})

/**
 * QA cmswwx0nj — le sélecteur d'année du module Maraîchage s'arrêtait à N+1 :
 * une culture 2028 matérialisée depuis une rotation était persistée mais
 * inaccessible depuis la liste Cultures. La plage couvre l'horizon des
 * rotations, à l'identique sur le dashboard et les écrans de planification.
 */
describe("plage d'années du module Maraîchage", () => {
  it("couvre N−5 … N+5, de la plus récente à la plus ancienne", () => {
    const annees = anneesMaraichage(2026)
    expect(annees[0]).toBe(2031)
    expect(annees[annees.length - 1]).toBe(2021)
    expect(annees).toHaveLength(11)
    expect(annees).toContain(2028)
  })

  it("garde la même plage pour toute année de référence", () => {
    expect(anneesMaraichage(2030)).toContain(2035)
    expect(anneesMaraichage(2030)).not.toContain(2036)
  })
})
