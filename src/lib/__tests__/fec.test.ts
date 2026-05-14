import { describe, it, expect } from "vitest"
import { genererFec, serialiserFec, validerEquilibre } from "../comptabilite/fec"

describe("fec", () => {
  it("génère une écriture équilibrée pour une vente manuelle en espèces", () => {
    const lignes = genererFec({
      ventes: [
        {
          id: 1,
          date: new Date("2026-03-15"),
          description: "Vente courgettes marché",
          categorie: "legumes",
          modeReglement: "Espèces",
          numeroPiece: null,
          tauxTVA: 5.5,
          montant: 100,
          montantHT: 94.79,
          montantTVA: 5.21,
          clientNom: "Marché place",
          paye: true,
        },
      ],
      depenses: [],
      factures: [],
    })
    // 3 lignes attendues : Débit Caisse 100, Crédit Ventes 94.79, Crédit TVA 5.21
    expect(lignes).toHaveLength(3)
    const v = validerEquilibre(lignes)
    expect(v.equilibre).toBe(true)
    expect(v.totalDebit).toBeCloseTo(v.totalCredit, 1)
  })

  it("équilibre Débit = Crédit sur une facture multi-catégories (POSTREVIEW)", () => {
    // POSTREVIEW : la facture ventile désormais ses lignes par catégorie
    // → on doit retrouver les comptes 701100 (legumes), 701300 (œufs),
    // 701400 (viande) au lieu d'un seul 701100 forcé.
    const lignes = genererFec({
      ventes: [],
      depenses: [],
      factures: [
        {
          id: 1,
          numero: "F-2026-0001",
          type: "facture",
          date: new Date("2026-03-15"),
          statut: "emise",
          clientId: 42,
          clientNom: "Restaurant Le Coin",
          totalHT: 200,
          totalTVA: 11,
          totalTTC: 211,
          totauxParTauxTva: null,
          modePaiement: "Virement",
          lignes: [
            { description: "Carottes", categorie: "legumes", montantHT: 100, montantTVA: 5.5, tauxTVA: 5.5 },
            { description: "Œufs frais", categorie: "oeufs", montantHT: 50, montantTVA: 2.75, tauxTVA: 5.5 },
            { description: "Poulet fermier", categorie: "viande", montantHT: 50, montantTVA: 2.75, tauxTVA: 5.5 },
          ],
        },
      ],
    })
    const v = validerEquilibre(lignes)
    expect(v.equilibre).toBe(true)
    const comptesVentes = new Set(
      lignes.filter((l) => l.CompteNum.startsWith("701")).map((l) => l.CompteNum)
    )
    expect(comptesVentes.size).toBe(3)
    expect(comptesVentes.has("701100")).toBe(true)
    expect(comptesVentes.has("701300")).toBe(true)
    expect(comptesVentes.has("701400")).toBe(true)
  })

  it("compte auxiliaire client basé sur clientId, pas factureId (POSTREVIEW)", () => {
    // 2 factures pour le MÊME client doivent partager le même tiers 411XXX
    // pour permettre le lettrage et la balance âgée.
    const lignes = genererFec({
      ventes: [],
      depenses: [],
      factures: [
        {
          id: 1,
          numero: "F-2026-0001",
          type: "facture",
          date: new Date("2026-03-15"),
          statut: "emise",
          clientId: 42,
          clientNom: "Client X",
          totalHT: 100,
          totalTVA: 5.5,
          totalTTC: 105.5,
          totauxParTauxTva: null,
          modePaiement: null,
          lignes: [{ description: "Carottes", categorie: "legumes", montantHT: 100, montantTVA: 5.5, tauxTVA: 5.5 }],
        },
        {
          id: 99,
          numero: "F-2026-0099",
          type: "facture",
          date: new Date("2026-04-15"),
          statut: "emise",
          clientId: 42, // même client
          clientNom: "Client X",
          totalHT: 200,
          totalTVA: 11,
          totalTTC: 211,
          totauxParTauxTva: null,
          modePaiement: null,
          lignes: [{ description: "Tomates", categorie: "legumes", montantHT: 200, montantTVA: 11, tauxTVA: 5.5 }],
        },
      ],
    })
    const tiers = lignes.filter((l) => l.CompAuxNum.startsWith("411"))
    const uniqueAuxNum = new Set(tiers.map((l) => l.CompAuxNum))
    expect(uniqueAuxNum.size).toBe(1)
  })

  it("ignore les factures annulées", () => {
    const lignes = genererFec({
      ventes: [],
      depenses: [],
      factures: [
        {
          id: 1,
          numero: "F-2026-0001",
          type: "facture",
          date: new Date("2026-03-15"),
          statut: "annulee",
          clientNom: "X",
          totalHT: 100,
          totalTVA: 5.5,
          totalTTC: 105.5,
          totauxParTauxTva: null,
          modePaiement: null,
        },
      ],
    })
    expect(lignes).toHaveLength(0)
  })

  it("avoir inverse le sens des débits/crédits", () => {
    const lignes = genererFec({
      ventes: [],
      depenses: [],
      factures: [
        {
          id: 1,
          numero: "AV-2026-0001",
          type: "avoir",
          date: new Date("2026-03-15"),
          statut: "emise",
          clientNom: "X",
          totalHT: 50,
          totalTVA: 2.75,
          totalTTC: 52.75,
          totauxParTauxTva: { "5.5": { ht: 50, tva: 2.75 } },
          modePaiement: null,
        },
      ],
    })
    const v = validerEquilibre(lignes)
    expect(v.equilibre).toBe(true)
    // Sur un avoir le client est crédité (et non débité)
    // Le montant facial doit être négatif au débit du compte client
    const ligneClient = lignes.find((l) => l.CompteNum.startsWith("411"))
    expect(ligneClient).toBeTruthy()
    // Débit négatif = -52,75
    expect(ligneClient!.Debit).toContain("-52,75")
  })

  it("TSV : 18 colonnes obligatoires + tabulation", () => {
    const lignes = genererFec({
      ventes: [
        {
          id: 1,
          date: new Date("2026-03-15"),
          description: "Test",
          categorie: "legumes",
          modeReglement: "Espèces",
          numeroPiece: null,
          tauxTVA: 5.5,
          montant: 100,
          montantHT: 94.79,
          montantTVA: 5.21,
          clientNom: null,
          paye: true,
        },
      ],
      depenses: [],
      factures: [],
    })
    const tsv = serialiserFec(lignes)
    const header = tsv.split("\n")[0].split("\t")
    expect(header).toHaveLength(18)
    expect(header[0]).toBe("JournalCode")
    expect(header[3]).toBe("EcritureDate")
    expect(header[11]).toBe("Debit")
    expect(header[12]).toBe("Credit")
  })
})
