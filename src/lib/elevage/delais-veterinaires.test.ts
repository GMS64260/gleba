import { describe, expect, it } from "vitest"
import {
  PLANCHER_CASCADE_LAIT_J,
  PLANCHER_CASCADE_VIANDE_J,
  resoudreDelaisVeterinaires,
} from "./delais-veterinaires"

const produit = {
  tempsAttenteLaitJ: 2,
  tempsAttenteViandeJ: 10,
  especesCibles: ["bovin"],
  delaisParEspece: [
    {
      especeAnimaleId: "vache_normande",
      tempsAttenteLaitJ: 4,
      tempsAttenteViandeJ: 12,
      couvertAmm: true,
    },
  ],
}

describe("délais vétérinaires produit × espèce", () => {
  it("préfère la matrice exacte pour une espèce couverte par l'AMM", () => {
    expect(resoudreDelaisVeterinaires(produit, {
      id: "vache_normande",
      categorieReglementaire: "Bovin",
    })).toEqual({
      tempsAttenteLaitJ: 4,
      tempsAttenteViandeJ: 12,
      source: "referentiel_espece",
      couvertAmm: true,
    })
  })

  it("applique les planchers cascade à une chèvre non couverte", () => {
    const delais = resoudreDelaisVeterinaires(produit, {
      id: "chevre_alpine",
      nom: "Chèvre Alpine",
      categorieReglementaire: "Caprin",
    })
    expect(delais).toEqual({
      tempsAttenteLaitJ: PLANCHER_CASCADE_LAIT_J,
      tempsAttenteViandeJ: PLANCHER_CASCADE_VIANDE_J,
      source: "cascade",
      couvertAmm: false,
    })
  })

  it("conserve le fallback produit quand sa cible générique couvre l'espèce", () => {
    const delais = resoudreDelaisVeterinaires(
      { ...produit, especesCibles: ["caprin"], delaisParEspece: [] },
      { id: "chevre_saanen", categorieReglementaire: "Caprin" },
    )
    expect(delais.source).toBe("referentiel_produit")
    expect(delais.couvertAmm).toBe(true)
  })
})
