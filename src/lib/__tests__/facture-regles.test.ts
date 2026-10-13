import { describe, expect, it } from "vitest"
import { cadreFacturation, date102Facture, dateIsoFacture, mentionsCodifiees, traitementFacture } from "@/lib/facture-regles"
import { createClientSchema, updateClientSchema } from "@/lib/validations/client"
import { createFactureSchema, mentionsFactureSchema } from "@/lib/validations/facture"

describe("règles de facturation électronique", () => {
  it("cadre de facturation BT-23 : lettre de la catégorie, 1 ou 2 selon le paiement", () => {
    expect(cadreFacturation("biens", false)).toBe("B1")
    expect(cadreFacturation("services", true)).toBe("S2")
    expect(cadreFacturation("mixte", false)).toBe("M1")
  })

  it("traitement BAR : B2B avec un SIREN ou un client professionnel, B2C sinon", () => {
    expect(traitementFacture("552 100 554")).toBe("B2B")
    expect(traitementFacture(null)).toBe("B2C")
    expect(traitementFacture("1234")).toBe("B2C")
    // Un professionnel sans SIREN reste B2B : l'export sera refusé (BR-FR-11) au lieu de partir en e-reporting.
    expect(traitementFacture(null, "professionnel")).toBe("B2B")
    expect(traitementFacture("", "Professionnel")).toBe("B2B")
    expect(traitementFacture(null, "amap")).toBe("B2C")
    expect(traitementFacture(null, "association")).toBe("B2C")
    expect(traitementFacture("552100554", "particulier")).toBe("B2B")
  })

  it("mentions codifiées AAB, PMD, PMT avec les valeurs de l'émetteur et des repli", () => {
    const m = mentionsCodifiees({ tauxEscompte: "1 %", tauxPenalitesRetard: "10 %", indemniteRecouvrement: 40 }, "EUR")
    expect(m.map((x) => x.code)).toEqual(["AAB", "PMD", "PMT"])
    expect(m[0].texte).toBe("Escompte pour règlement anticipé : 1 %.")
    expect(m[1].texte).toContain("10 %")
    expect(m[2].texte).toContain("40,00 €")
    expect(mentionsCodifiees(null)[0].texte).toContain("néant")
  })

  it("dates au jour calendaire de Paris", () => {
    const minuitParisEte = new Date("2026-10-12T00:00:00+02:00")
    expect(dateIsoFacture(minuitParisEte)).toBe("2026-10-12")
    expect(date102Facture(minuitParisEte)).toBe("20261012")
    expect(dateIsoFacture(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-16")
  })
})

describe("validations lot 1", () => {
  it("un client professionnel exige un SIRET ou un SIREN, un particulier non", () => {
    expect(createClientSchema.safeParse({ nom: "Épicerie", type: "professionnel" }).success).toBe(false)
    expect(createClientSchema.safeParse({ nom: "Épicerie", type: "professionnel", siren: "552100554" }).success).toBe(true)
    expect(createClientSchema.safeParse({ nom: "Épicerie", type: "professionnel", siret: "55210055400013" }).success).toBe(true)
    expect(createClientSchema.safeParse({ nom: "Jean", type: "particulier" }).success).toBe(true)
    expect(createClientSchema.safeParse({ nom: "AMAP", type: "amap" }).success).toBe(true)
    expect(updateClientSchema.safeParse({ id: 3, notes: "ok" }).success).toBe(true)
  })

  it("la facture accepte la catégorie d'opération et la livraison, biens par défaut", () => {
    const base = { totalHT: 20, totalTVA: 1.1, totalTTC: 21.1, lignes: [{ description: "Légumes", quantite: 2, unite: "kg", prixUnitaire: 10, tauxTVA: 5.5, montantHT: 20, montantTVA: 1.1, montantTTC: 21.1 }] }
    const sansCategorie = createFactureSchema.safeParse(base)
    expect(sansCategorie.success && sansCategorie.data.categorieOperation).toBe("biens")
    const services = createFactureSchema.safeParse({ ...base, categorieOperation: "Services", dateLivraison: "2026-10-12", adresseLivraison: "9 route du Marché", codePostalLivraison: "64100", villeLivraison: "Bayonne" })
    expect(services.success && services.data.categorieOperation).toBe("services")
    expect(services.success && services.data.dateLivraison instanceof Date).toBe(true)
    expect(createFactureSchema.safeParse({ ...base, categorieOperation: "autre" }).success).toBe(false)
    expect(mentionsFactureSchema.safeParse({ categorieOperation: "mixte" }).success).toBe(true)
    expect(mentionsFactureSchema.safeParse({ categorieOperation: "x" }).success).toBe(false)
  })
})
