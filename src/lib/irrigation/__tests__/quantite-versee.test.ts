/**
 * « Quantité versée » d'un arrosage noté (ticket QA cmv3japsf) : mêmes
 * chiffres et mêmes mots sur le conseiller, les Tâches et le Calendrier.
 */
import { describe, expect, it } from "vitest"

import {
  aideQuantite,
  contexteQuantiteVersee,
  detailArrosageNote,
  lireLitres,
  litresConseilles,
  phraseLitresPlanche,
} from "../quantite-versee"

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

  // Ticket QA du 2026-10-19 : la page Irriguer notait un plein sans demander
  // les litres. Son dialogue part du même contexte que les Tâches.
  it("contexte de saisie d'une culture : dose conseillée et surface de la PLANCHE entière", () => {
    const culture = {
      longueur: 5, // la culture n'occupe que 5 m de la planche
      reserve: { litresParM2: 29.9 },
      planche: { nom: "A3", largeur: 1.2, longueur: 15, surface: null },
    }
    const contexte = contexteQuantiteVersee(culture)
    expect(contexte).toEqual({ litresParM2: 29.9, surfaceM2: 18, plancheNom: "A3" })
    // Prérempli du dialogue : 29,9 L/m² × 18 m².
    expect(litresConseilles(contexte.litresParM2, contexte.surfaceM2)).toBe(538)
  })

  it("sans météo ni planche : rien à préremplir, l'aide le dit", () => {
    expect(contexteQuantiteVersee({ reserve: null, planche: null })).toEqual({
      litresParM2: null,
      surfaceM2: 0,
      plancheNom: null,
    })
    expect(contexteQuantiteVersee({ planche: { nom: "B2", surface: 12 } })).toEqual({
      litresParM2: null,
      surfaceM2: 12,
      plancheNom: "B2",
    })
  })

  it("un nom de planche vide n'est pas un nom", () => {
    expect(contexteQuantiteVersee({ planche: { nom: "", surface: 12 } }).plancheNom).toBeNull()
  })

  // Revue du 2026-10-19 : la ligne de la page Irriguer annonçait le volume de
  // la portion cultivée (179 L), le dialogue préremplissait la planche (538 L).
  it("la ligne annonce le chiffre que le dialogue préremplit, pour la planche", () => {
    const contexte = contexteQuantiteVersee({
      reserve: { litresParM2: 29.9 },
      planche: { nom: "A3", largeur: 1.2, longueur: 15, surface: null },
    })
    expect(phraseLitresPlanche(contexte)).toBe("soit 538 L pour la planche A3")
    expect(phraseLitresPlanche({ ...contexte, plancheNom: null })).toBe("soit 538 L pour la planche")
    expect(phraseLitresPlanche({ litresParM2: 29.9, surfaceM2: 0, plancheNom: null })).toBeNull()
    expect(phraseLitresPlanche({ litresParM2: null, surfaceM2: 18, plancheNom: "A3" })).toBeNull()
  })
})
