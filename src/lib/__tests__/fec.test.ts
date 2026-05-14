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

  it("équilibre Débit = Crédit sur une facture multi-taux", () => {
    // Note : `genererFec` reconstruit le TTC client à partir de la ventilation
    // HT/TVA fournie (pas du totalTTC fourni). On garde la cohérence interne :
    // si ht=100 et tva=5.5 alors le TTC dérivé = 105.5 ; idem 10% = 110.
    // Total client crédité doit donc être 215.5, donc on règle totalTTC sur la
    // somme des sous-totaux ventilés.
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
          clientNom: "Restaurant Le Coin",
          totalHT: 200,
          totalTVA: 15.5,
          totalTTC: 215.5,
          totauxParTauxTva: {
            "5.5": { ht: 100, tva: 5.5 },
            "10": { ht: 100, tva: 10 },
          },
          modePaiement: "Virement",
        },
      ],
    })
    const v = validerEquilibre(lignes)
    expect(v.equilibre).toBe(true)
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
