import { describe, expect, it } from "vitest"
import { resoudrePlantationEtape } from "./plantation-etape"

const graine = 20261118
const statuts = ["planifiee", "prep_sol", "plantation", "suivi", "terminee", "echec"]
function generateur() {
  let valeur = graine
  return () => {
    valeur = (Math.imul(valeur, 1664525) + 1013904223) >>> 0
    return valeur
  }
}

describe(`Dates de plantation — 400 séquences par propriété, graine ${graine}`, () => {
  it("cocher puis décocher retire les dates et préserve tout statut terminal", () => {
    console.log(`Plantation : graine ${graine}, 400 séquences par propriété`)
    const alea = generateur()
    for (let i = 0; i < 400; i++) {
      const statut = statuts[alea() % statuts.length]
      const date = new Date(Date.UTC(2020, 0, 1) + alea() * 100)
      const initiale = { statut, datePlantationReelle: null }
      const cochee = resoudrePlantationEtape({ type: "plantation", dateRealisation: null }, initiale, { fait: true }, date)
      expect(cochee.dateRealisation).toEqual(date)
      expect(cochee.campagne?.datePlantationReelle).toEqual(date)
      const decochee = resoudrePlantationEtape({ type: "plantation", dateRealisation: date }, cochee.campagne!, { fait: false })
      expect(decochee.dateRealisation).toBeNull()
      expect(decochee.campagne).toEqual({ datePlantationReelle: null, statut: ["terminee", "echec"].includes(statut) ? statut : "planifiee" })
    }
  })

  it("les rejeux ne décalent jamais la date ni ne demandent de régénérer le miroir", () => {
    const alea = generateur()
    for (let i = 0; i < 400; i++) {
      const date = new Date(Date.UTC(2020, 0, 1) + alea() * 100)
      const campagne = { statut: statuts[alea() % statuts.length], datePlantationReelle: null }
      const cochee = resoudrePlantationEtape({ type: "plantation", dateRealisation: null }, campagne, { fait: true, dateRealisation: date })
      const etape = { type: "plantation", dateRealisation: date }
      const rejeu = resoudrePlantationEtape(etape, cochee.campagne!, { fait: true }, new Date(date.getTime() + alea()))
      expect(rejeu).toEqual({ dateRealisation: date, campagne: null })
      const decochee = resoudrePlantationEtape(etape, cochee.campagne!, { fait: false })
      expect(resoudrePlantationEtape({ ...etape, dateRealisation: null }, decochee.campagne!, { fait: false })).toEqual({ dateRealisation: null, campagne: null })
    }
  })

  it("décocher ne touche jamais à une date de campagne indépendante, même séparée d'une milliseconde", () => {
    const alea = generateur()
    for (let i = 0; i < 400; i++) {
      const date = new Date(Date.UTC(2020, 0, 1) + alea() * 100)
      const campagne = { statut: statuts[alea() % statuts.length], datePlantationReelle: new Date(date.getTime() + 1 + alea() % 1000) }
      const resultat = resoudrePlantationEtape({ type: "plantation", dateRealisation: date }, campagne, { fait: false })
      expect(resultat).toEqual({ dateRealisation: null, campagne: null })
    }
  })
})
