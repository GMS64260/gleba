import { describe, expect, it } from "vitest"
import { formulaireConsommationVierge, reduireFormulaireConsommation, type ConsommationAEditer } from "./consommation-formulaire"

const GRAINE = 0x20261119

describe(`abandon des consommations — graine 0x${GRAINE.toString(16)}`, () => {
  it("320 historiques synthétiques repartent entièrement vierges à chaque création", () => {
    let graine = GRAINE
    const suivant = () => { graine = (Math.imul(graine, 1664525) + 1013904223) >>> 0; return graine }
    for (let i = 0; i < 320; i++) {
      const contexte = `graine=0x${GRAINE.toString(16)}, historique=${i}`
      let etat = formulaireConsommationVierge("2020-01-01")
      for (let n = 0, longueur = 2 + suivant() % 12; n < longueur; n++) {
        const id = suivant() % 100000 + 1
        const cible = suivant() % 3
        const ligne: ConsommationAEditer = {
          id, aliment: { id: `aliment-${suivant()}` },
          lot: cible === 1 ? { id: suivant() % 100000 + 1 } : null,
          animal: cible === 2 ? { id: suivant() % 100000 + 1 } : null,
          date: `2024-02-${String(1 + suivant() % 28).padStart(2, "0")}T12:00:00Z`,
          quantite: suivant() / 1000, notes: suivant() % 2 ? `notes-${suivant()}` : null,
        }
        etat = reduireFormulaireConsommation(etat, { type: "modifier", consommation: ligne })
        expect(etat.editingConsoId, contexte).toBe(id)
        expect(etat.formData.alimentId, contexte).toBe(ligne.aliment.id)
        etat = reduireFormulaireConsommation(etat, { type: "saisir", champs: {
          alimentId: `modifie-${suivant()}`, quantite: String(suivant() / 100), notes: `brouillon-${suivant()}`,
          lotId: String(suivant()), animalId: String(suivant()), date: "2023-01-01",
        } })
        etat = reduireFormulaireConsommation(etat, { type: "fermer", jour: "2026-11-19" })
        expect(etat.isDialogOpen, contexte).toBe(false)
        const jour = `2027-${String(1 + suivant() % 12).padStart(2, "0")}-${String(1 + suivant() % 28).padStart(2, "0")}`
        etat = reduireFormulaireConsommation(etat, { type: "creer", jour })
        expect(etat, contexte).toEqual({ isDialogOpen: true, editingConsoId: null, formData: {
          alimentId: "", cible: "tous", lotId: "", animalId: "", date: jour, quantite: "", notes: "",
        } })
        // Création partielle abandonnée, avec une seconde ouverture le lendemain.
        etat = reduireFormulaireConsommation(etat, { type: "saisir", champs: {
          alimentId: `creation-${suivant()}`, cible: cible === 1 ? "lot" : "animal",
          lotId: String(id), animalId: String(id + 1), quantite: String(suivant()), notes: `notes-${suivant()}`,
        } })
        etat = reduireFormulaireConsommation(etat, { type: "fermer", jour })
        etat = reduireFormulaireConsommation(etat, { type: "creer", jour: "2028-01-01" })
        expect(etat, contexte).toEqual({ isDialogOpen: true, editingConsoId: null, formData: {
          alimentId: "", cible: "tous", lotId: "", animalId: "", date: "2028-01-01", quantite: "", notes: "",
        } })
      }
    }
  })
})
