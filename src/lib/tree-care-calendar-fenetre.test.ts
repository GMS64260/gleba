import { describe, expect, it } from "vitest"
import {
  fenetreOperationCare,
  findTreeCareProfile,
  generateCareOperations,
} from "./tree-care-calendar"

const POMMIER = findTreeCareProfile("Pommier")!

describe("fenetreOperationCare", () => {
  it("expose les deux bornes de la fenêtre agronomique", () => {
    const fenetre = fenetreOperationCare(
      { type: "taille", moisDebut: 6, moisFin: 7 },
      2026
    )
    expect(fenetre.debut).toEqual(new Date(2026, 5, 1))
    expect(fenetre.fin).toEqual(new Date(2026, 6, 31))
  })

  it("prolonge sur l'année suivante une fenêtre à cheval", () => {
    const fenetre = fenetreOperationCare(
      { type: "recolte", moisDebut: 11, moisFin: 3 },
      2026
    )
    expect(fenetre.debut).toEqual(new Date(2026, 10, 1))
    expect(fenetre.fin).toEqual(new Date(2027, 2, 31))
    // Ancrage en janvier : celui de 2027, sinon la récolte précédait
    // l'ouverture de sa propre fenêtre (défaut du générateur historique).
    expect(fenetre.moisAncrage).toBe(1)
    expect(fenetre.anneeAncrage).toBe(2027)
  })

  it("garde le calage des variétés tardives sur la récolte", () => {
    const recolte = POMMIER.operations.find((op) => op.type === "recolte")!
    const standard = fenetreOperationCare(recolte, 2026)
    const tardive = fenetreOperationCare(recolte, 2026, "Belle de Boskoop")
    expect(standard.moisAncrage).toBe(9)
    expect(tardive.moisAncrage).toBe(10)
    // La fenêtre elle-même ne bouge pas : seule la date conseillée se décale.
    expect(tardive.debut).toEqual(standard.debut)
    expect(tardive.fin).toEqual(standard.fin)
  })
})

describe("generateCareOperations", () => {
  it("étale les dates conseillées entre arbres au lieu de les empiler", () => {
    // Le défaut corrigé : 86 arbres produisaient 79 tâches au 15/06.
    const dates = [101, 102, 103, 104, 105].map((arbreId) => {
      const ops = generateCareOperations(POMMIER, 2026, arbreId, "u1")
      const taille = ops.find((op) => op.description.startsWith("Taille en vert"))!
      return taille.datePrevue.getTime()
    })
    expect(new Set(dates).size).toBe(5)
  })

  it("place la date conseillée dans sa fenêtre et renseigne les bornes", () => {
    const ops = generateCareOperations(POMMIER, 2026, 42, "u1")
    for (const op of ops) {
      expect(op.fenetreDebut).toBeInstanceOf(Date)
      expect(op.dateLimite).toBeInstanceOf(Date)
      expect(op.datePrevue.getTime()).toBeGreaterThanOrEqual(op.fenetreDebut.getTime())
      expect(op.datePrevue.getTime()).toBeLessThanOrEqual(op.dateLimite.getTime())
    }
  })

  it("est déterministe : régénérer ne déplace pas les dates", () => {
    const premier = generateCareOperations(POMMIER, 2026, 77, "u1")
    const second = generateCareOperations(POMMIER, 2026, 77, "u1")
    expect(second.map((op) => op.datePrevue.getTime())).toEqual(
      premier.map((op) => op.datePrevue.getTime())
    )
  })

  it("omet les fenêtres déjà refermées mais garde celles encore ouvertes", () => {
    // Au 3 août : la taille en vert (juin-juillet) est hors saison, la récolte
    // de septembre est à venir, la taille d'hiver (janv-mars) est passée.
    const from = new Date(2026, 7, 3)
    const ops = generateCareOperations(POMMIER, 2026, 42, "u1", null, from)
    const libelles = ops.map((op) => op.description.split(" — ")[0])
    expect(libelles).not.toContain("Taille en vert")
    expect(libelles).not.toContain("Taille de formation/fructification")
    expect(libelles).toContain("Récolte des pommes")
    expect(libelles).toContain("Bouillie bordelaise (chancre)")
  })

  it("ne fait jamais naître une opération avant le plancher", () => {
    // Fenêtre ouverte dont la date conseillée est passée : on conserve
    // l'opération (le travail est faisable) en ramenant la date au plancher.
    const from = new Date(2026, 8, 20)
    const ops = generateCareOperations(POMMIER, 2026, 42, "u1", null, from)
    const recolte = ops.find((op) => op.description.startsWith("Récolte des pommes"))
    expect(recolte).toBeDefined()
    expect(recolte!.datePrevue.getTime()).toBeGreaterThanOrEqual(from.getTime())
    for (const op of ops) {
      expect(op.datePrevue.getTime()).toBeGreaterThanOrEqual(from.getTime())
    }
  })
})

describe("couverture des espèces", () => {
  it("couvre les espèces réellement plantées, fruit ou arbre", () => {
    // Trous mesurés en production le 2026-08-03 : les 9 feijoas d'un compte
    // n'avaient aucun calendrier, et « Poire » / « Brugnonnier » ne
    // résolvaient pas (« poirier ».includes(« poire ») est faux).
    const attendus: Array<[string, string]> = [
      ["Feijoa", "Feijoa"],
      ["feijoas", "Feijoa"],
      ["Acca sellowiana", "Feijoa"],
      ["Noisetier", "Noisetier"],
      ["Rhubarbe", "Rhubarbe"],
      ["Brugnonnier", "Pêcher"],
      ["Nectarinier", "Pêcher"],
      ["Poire", "Poirier"],
      ["Pomme", "Pommier"],
      ["Chataignier", "Châtaignier"],
    ]
    for (const [saisie, profilAttendu] of attendus) {
      expect(findTreeCareProfile(saisie)?.espece, saisie).toBe(profilAttendu)
    }
  })

  it("reste franc sur une espèce hors périmètre fruitier", () => {
    // Le chêne est un arbre forestier sans conduite fruitière : mieux vaut un
    // 404 explicite qu'un calendrier inventé.
    expect(findTreeCareProfile("Chene")).toBeNull()
  })

  it("génère un calendrier cohérent pour les nouveaux profils", () => {
    for (const espece of ["Feijoa", "Noisetier", "Rhubarbe"]) {
      const profil = findTreeCareProfile(espece)!
      const ops = generateCareOperations(profil, 2026, 42, "u1")
      expect(ops.length, espece).toBeGreaterThan(0)
      expect(ops.some((op) => op.type === "recolte"), `${espece} : récolte`).toBe(true)
      for (const op of ops) {
        expect(op.datePrevue.getTime()).toBeGreaterThanOrEqual(op.fenetreDebut.getTime())
        expect(op.datePrevue.getTime()).toBeLessThanOrEqual(op.dateLimite.getTime())
      }
    }
  })
})
