import { describe, expect, it } from "vitest"

import {
  interventionCorrespond,
  libellesEmplacement,
  termesRecherche,
  texteContientTermes,
  texteRechercheIntervention,
  type InterventionRecherchable,
} from "./recherche"

const ligne = (champs: Partial<InterventionRecherchable> = {}): InterventionRecherchable => ({
  type: "arrosage",
  description: null,
  cultureNom: null,
  plancheNom: null,
  plancheId: null,
  intrantNom: null,
  produitPhyto: null,
  notes: null,
  ...champs,
})

// Arrosage tel que le renvoie GET /api/interventions pour une intervention
// manuelle rattachée à une culture : la colonne affiche `cultureNom`.
const ARROSAGE_COURGE = ligne({
  description: "Apport du matin, contrôle du tour d'eau",
  cultureNom: "Courge butternut - Courge butternut-Waltham",
  plancheNom: "B5",
  plancheId: "cme000000000000000000005",
})

describe("recherche du registre des interventions (ticket QA du 2026-10-19)", () => {
  it("retrouve une ligne par le nom de culture affiché", () => {
    expect(interventionCorrespond(ARROSAGE_COURGE, "Courge")).toBe(true)
    expect(interventionCorrespond(ARROSAGE_COURGE, "butternut")).toBe(true)
    expect(interventionCorrespond(ARROSAGE_COURGE, "Waltham")).toBe(true)
  })

  it("retrouve une ligne par le nom de planche, pas seulement par son identifiant", () => {
    expect(interventionCorrespond(ARROSAGE_COURGE, "b5")).toBe(true)
  })

  it("cherche toujours dans la description, le type et les notes", () => {
    expect(interventionCorrespond(ARROSAGE_COURGE, "tour d'eau")).toBe(true)
    expect(interventionCorrespond(ARROSAGE_COURGE, "Arrosage")).toBe(true)
    expect(interventionCorrespond(ligne({ notes: "Paillage refait" }), "paillage")).toBe(true)
    expect(interventionCorrespond(ligne({ type: "traitement_phyto", produitPhyto: "Bouillie bordelaise" }), "bordelaise")).toBe(true)
  })

  it("ignore la casse, les accents et les tirets", () => {
    const desherbage = ligne({ type: "desherbage", cultureNom: "Pomme de terre - Bintje" })
    expect(interventionCorrespond(desherbage, "désherbage")).toBe(true)
    expect(interventionCorrespond(desherbage, "DESHERBAGE")).toBe(true)
    expect(interventionCorrespond(ARROSAGE_COURGE, "butternut-waltham")).toBe(true)
    expect(interventionCorrespond(ligne({ cultureNom: "Épinard" }), "epinard")).toBe(true)
  })

  it("exige chaque mot saisi, dans n'importe quel champ et n'importe quel ordre", () => {
    expect(interventionCorrespond(ARROSAGE_COURGE, "butternut B5")).toBe(true)
    expect(interventionCorrespond(ARROSAGE_COURGE, "B5 matin")).toBe(true)
    expect(interventionCorrespond(ARROSAGE_COURGE, "courge tomate")).toBe(false)
  })

  it("une saisie vide ou blanche ne filtre rien", () => {
    expect(interventionCorrespond(ARROSAGE_COURGE, "")).toBe(true)
    expect(interventionCorrespond(ARROSAGE_COURGE, "   ")).toBe(true)
    expect(termesRecherche("  Courge   butternut ")).toEqual(["courge", "butternut"])
  })

  it("le libellé cherché est celui de la colonne, culture chargée à côté comprise", () => {
    const sansNom = ligne({ cultureNom: null, plancheId: "A3" })
    const culture = { espece: { nom: "Tomate" }, variete: { nom: "Noire de Crimée" }, planche: { nom: "A3" } }
    expect(libellesEmplacement(sansNom, culture)).toEqual({ culture: "Tomate (Noire de Crimée) — A3", planche: "A3" })
    expect(interventionCorrespond(sansNom, "crimee", culture)).toBe(true)
    expect(interventionCorrespond(sansNom, "tomate")).toBe(false)
  })

  it("une ligne sans rien de commun n'est pas retenue", () => {
    expect(interventionCorrespond(ARROSAGE_COURGE, "Carotte")).toBe(false)
  })

  it("le texte replié se calcule une fois par ligne et se confronte aux mots", () => {
    const texte = texteRechercheIntervention(ARROSAGE_COURGE)
    expect(texte).toContain("courge butternut courge butternut waltham")
    expect(texteContientTermes(texte, termesRecherche("Courge B5"))).toBe(true)
    expect(texteContientTermes(texte, termesRecherche("Carotte"))).toBe(false)
    expect(texteContientTermes(texte, [])).toBe(true)
  })
})
