/**
 * « Quantité versée » d'un arrosage noté (ticket QA cmv3japsf) : mêmes
 * chiffres et mêmes mots sur le conseiller, les Tâches et le Calendrier.
 */
import { describe, expect, it } from "vitest"

import { aideQuantite, detailArrosageNote, lireLitres, litresConseilles } from "../quantite-versee"

// Espace insécable fine d'Intl fr-FR entre les milliers.
const fr = (s: string) => s.replace(/[  ]/g, " ")

describe("quantité versée", () => {
  it("prérempli : L/m² × surface, arrondi ; rien sans dose ni surface", () => {
    expect(litresConseilles(29.9, 16)).toBe(478)
    expect(litresConseilles(0, 16)).toBeNull()
    expect(litresConseilles(null, 16)).toBeNull()
    expect(litresConseilles(29.9, 0)).toBeNull()
  })

  it("lit la virgule comme le point ; un champ vide n'est pas une quantité", () => {
    expect(lireLitres("12,5")).toBe(12.5)
    expect(lireLitres(" 40 ")).toBe(40)
    expect(lireLitres("1 200")).toBe(1200)
    expect(lireLitres("1\u202f200,5")).toBe(1200.5)
    expect(lireLitres("")).toBeNaN()
    expect(lireLitres("abc")).toBeNaN()
    expect(lireLitres("12abc")).toBeNaN()
    expect(lireLitres("1e9")).toBeNaN()
    expect(lireLitres("-5")).toBeNaN()
  })

  it("l'aide dit le conseil, la surface et ce que vaut « Quantité inconnue »", () => {
    expect(fr(aideQuantite(29.9, 57.6))).toBe(
      "Conseil : 29,9 L/m², soit 1 722 L. Le conseil est recalculé avec l’eau versée sur 57,6 m². « Quantité inconnue » compte un arrosage complet (réserve du sol remplie).",
    )
    expect(aideQuantite(null, 0)).toBe(
      "Surface inconnue : l’arrosage comptera comme complet. « Quantité inconnue » compte un arrosage complet (réserve du sol remplie).",
    )
  })

  it("le toast dit la quantité, ou l'arrosage complet", () => {
    expect(detailArrosageNote("A3", 20)).toBe("A3 · 20 L versés, consigné dans les interventions.")
    expect(detailArrosageNote("A3", null)).toBe("A3 · arrosage complet, consigné dans les interventions.")
  })
})
