import { describe, expect, it } from "vitest"
import {
  estTypeProductionBois,
  libellePoidsBois,
  libellesVenteBois,
  libelleTypeBois,
  libelleVolumeBois,
  refusTypeProductionBois,
  resumeLotBois,
  TYPES_PRODUCTION_BOIS,
} from "../production-bois"

/**
 * QA cmvnp0dm9 (2026-10-25) : un lot d'élagage de 0,2 m³ vendu 24 € portait
 * « elagage - 0.2 m³ » dans le dialogue de vente et « Vente de bois - elagage
 * (0.2 m³) » sur la facture F-2026-0009, alors que le tableau Bois affichait
 * « Élagage ».
 */
describe("libellés d'un lot de bois", () => {
  it("affiche le libellé accentué de chaque type, jamais la valeur technique", () => {
    expect(TYPES_PRODUCTION_BOIS.map((t) => libelleTypeBois(t.value))).toEqual([
      "Élagage",
      "Abattage",
      "Branchage",
    ])
  })

  it("reconnaît une saisie accentuée ou en capitales, et rend lisible un type hors liste", () => {
    expect(libelleTypeBois("Élagage")).toBe("Élagage")
    expect(libelleTypeBois(" ELAGAGE ")).toBe("Élagage")
    expect(libelleTypeBois("éclaircie")).toBe("Éclaircie")
    expect(libelleTypeBois("")).toBe("Bois")
    expect(libelleTypeBois(null)).toBe("Bois")
  })

  it("n'accepte à l'écriture que les types de la liste", () => {
    expect(estTypeProductionBois("elagage")).toBe(true)
    expect(estTypeProductionBois("Élagage")).toBe(false)
    expect(estTypeProductionBois("coupe")).toBe(false)
    expect(refusTypeProductionBois("elagage")).toBeNull()
    expect(refusTypeProductionBois(undefined)).toBe("Le type de production est requis")
    expect(refusTypeProductionBois("coupe")).toBe("Type de production inconnu : choisissez Élagage, Abattage, Branchage.")
  })

  it("écrit le volume à la française", () => {
    expect(libelleVolumeBois(0.2)).toBe("0,2 m³")
    expect(libelleVolumeBois(1.01)).toBe("1,01 m³")
    expect(libelleVolumeBois(3)).toBe("3 m³")
    // Totaux des cartes En stock / Vendu : pas de bavure du flottant.
    expect(libelleVolumeBois(0.1 + 0.2)).toBe("0,3 m³")
    expect(libellePoidsBois(35.5)).toBe("35,5 kg")
  })

  it("résume le lot du ticket dans le dialogue de vente", () => {
    expect(resumeLotBois({ type: "elagage", volumeM3: 0.2 })).toBe("Élagage - 0,2 m³")
    // Lot pesé sans volume (données d'exemple) : plus de « null m³ ».
    expect(resumeLotBois({ type: "branchage", volumeM3: null, poidsKg: 35 })).toBe("Branchage - 35 kg")
    expect(resumeLotBois({ type: "abattage" })).toBe("Abattage")
  })

  it("compose l'objet et la ligne de facture et la description de la vente", () => {
    expect(libellesVenteBois({ type: "elagage", volumeM3: 0.2, arbreNom: "Noyer 2" })).toEqual({
      objetFacture: "Vente de bois - Élagage (0,2 m³)",
      ligneFacture: "Élagage - Noyer 2",
      description: "Vente bois - Élagage - Noyer 2 - 0,2 m³",
    })
    expect(libellesVenteBois({ type: "branchage", volumeM3: null, arbreNom: null })).toEqual({
      objetFacture: "Vente de bois - Branchage",
      ligneFacture: "Branchage",
      description: "Vente bois - Branchage",
    })
  })
})
