import { describe, expect, it } from "vitest"
import { preremplirDelaisDepuisCatalogue } from "./preremplissage-delais-soin"

const catalogue = [{ id: "produit-test", tempsAttenteLaitJ: 4, tempsAttenteViandeJ: 28, tempsAttenteOeufsJ: 0 }]
const soinEnregistre = {
  produitId: "produit-test", notes: "Note d'origine",
  tempsAttenteLaitJ: "0", tempsAttenteOeufsJ: "7", tempsAttenteViandeJ: "10",
}

describe("préremplissage des délais d'un soin depuis le référentiel", () => {
  it("FB-7YARYN : en modification, garde les délais enregistrés sur le soin, délai œufs compris", () => {
    expect(preremplirDelaisDepuisCatalogue(soinEnregistre, catalogue, true)).toBe(soinEnregistre)
  })

  it("à la création, reprend les délais du produit pour l'espèce choisie", () => {
    expect(preremplirDelaisDepuisCatalogue({ ...soinEnregistre, tempsAttenteOeufsJ: "" }, catalogue, false)).toMatchObject({
      notes: "Note d'origine", tempsAttenteLaitJ: "4", tempsAttenteOeufsJ: "", tempsAttenteViandeJ: "28",
    })
    expect(preremplirDelaisDepuisCatalogue(soinEnregistre,
      [{ ...catalogue[0], tempsAttenteOeufsJ: 9 }], false).tempsAttenteOeufsJ).toBe("9")
  })

  it("ne touche à rien en saisie libre ou pour un produit absent du référentiel", () => {
    const libre = { ...soinEnregistre, produitId: "" }
    expect(preremplirDelaisDepuisCatalogue(libre, catalogue, false)).toBe(libre)
    expect(preremplirDelaisDepuisCatalogue(soinEnregistre, [], false)).toBe(soinEnregistre)
  })
})
