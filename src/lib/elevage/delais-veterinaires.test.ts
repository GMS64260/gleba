import { describe, expect, it } from "vitest"
import {
  PLANCHER_CASCADE_LAIT_J,
  PLANCHER_CASCADE_OEUFS_J,
  PLANCHER_CASCADE_VIANDE_J,
  codesEspeceVeterinaire,
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
      tempsAttenteOeufsJ: 0,
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
      // QA 2026-07-30 — Pas de plancher œufs inventé pour une chèvre : ce serait
      // le miroir du délai lait attribué à des pondeuses.
      tempsAttenteOeufsJ: 0,
      source: "cascade",
      couvertAmm: false,
    })
  })

  it("applique le plancher cascade œufs seulement si un délai œufs existe", () => {
    const produitAvicole = {
      tempsAttenteLaitJ: 0,
      tempsAttenteViandeJ: 10,
      tempsAttenteOeufsJ: 3,
      especesCibles: ["volaille"],
      delaisParEspece: [],
    }
    const delais = resoudreDelaisVeterinaires(produitAvicole, {
      id: "caille_japonaise",
      nom: "Caille japonaise",
      categorieReglementaire: "Volaille de ponte",
    })

    // Espèce non couverte par la cible générique « volaille » ? Elle l'est ici,
    // donc on reste sur le référentiel produit sans plancher.
    expect(delais.tempsAttenteOeufsJ).toBe(3)
    expect(delais.source).toBe("referentiel_produit")
  })

  it("majore le délai œufs au plancher cascade hors AMM", () => {
    const produitHorsAmm = {
      tempsAttenteLaitJ: 0,
      tempsAttenteViandeJ: 10,
      tempsAttenteOeufsJ: 3,
      especesCibles: ["bovin"],
      delaisParEspece: [],
    }
    const delais = resoudreDelaisVeterinaires(produitHorsAmm, {
      id: "poule_pondeuse",
      nom: "Poule pondeuse",
      categorieReglementaire: "Volaille de ponte",
    })

    expect(delais.source).toBe("cascade")
    expect(delais.tempsAttenteOeufsJ).toBe(PLANCHER_CASCADE_OEUFS_J)
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

describe("espèces cibles reconnues par mot entier (revue du 2026-11-04)", () => {
  const ovinCaprin = { tempsAttenteLaitJ: 7, tempsAttenteViandeJ: 14, especesCibles: ["ovin", "caprin"] }
  const equin = { tempsAttenteLaitJ: 0, tempsAttenteViandeJ: 0, especesCibles: ["equin"] }

  it("une vache n'est pas couverte par un produit autorisé chez les ovins : plancher cascade", () => {
    const vache = { id: "vache_normande", nom: "Vache Normande", categorieReglementaire: "Bovin" }
    expect(codesEspeceVeterinaire(vache)).not.toContain("ovin")
    const delais = resoudreDelaisVeterinaires(ovinCaprin, vache)
    expect(delais.couvertAmm).toBe(false)
    expect(delais.source).toBe("cascade")
    expect(delais.tempsAttenteViandeJ).toBe(PLANCHER_CASCADE_VIANDE_J)
  })

  it("une chèvre Saanen n'est pas couverte par un produit équin : 7 j lait, 28 j viande au minimum", () => {
    const saanen = { id: "chevre_saanen", nom: "Chèvre Saanen", categorieReglementaire: "Caprin" }
    expect(codesEspeceVeterinaire(saanen)).not.toContain("equin")
    const delais = resoudreDelaisVeterinaires(equin, saanen)
    expect(delais.couvertAmm).toBe(false)
    expect(delais.tempsAttenteLaitJ).toBe(PLANCHER_CASCADE_LAIT_J)
    expect(delais.tempsAttenteViandeJ).toBe(PLANCHER_CASCADE_VIANDE_J)
  })

  it("« Romane », « Manech » et « Cane » ne sont pas des équidés", () => {
    for (const nom of ["Brebis Romane", "Brebis Manech tête rousse", "Cane de Rouen"]) {
      expect(codesEspeceVeterinaire({ id: nom.toLowerCase().replace(/ /g, "_"), nom })).not.toContain("equin")
    }
  })

  it("reconnaît toujours les espèces par début de mot", () => {
    expect(codesEspeceVeterinaire({ id: "brebis_lacaune", nom: "Brebis Lacaune" })).toContain("ovin")
    expect(codesEspeceVeterinaire({ id: "chevreau", nom: "Chevreau" })).toContain("caprin")
    expect(codesEspeceVeterinaire({ id: "ane_provence", nom: "Âne de Provence" })).toContain("equin")
    expect(codesEspeceVeterinaire({ id: "porcelet", nom: "Porcelet" })).toContain("porcin")
    expect(codesEspeceVeterinaire({ id: "x", nom: "Lot", categorieReglementaire: "Ovins/Caprins" })).toEqual(
      expect.arrayContaining(["ovin", "caprin"]),
    )
    // Le produit ovin couvre bien la brebis.
    expect(resoudreDelaisVeterinaires(ovinCaprin, { id: "brebis_lacaune", nom: "Brebis Lacaune" }).couvertAmm).toBe(true)
  })
})
