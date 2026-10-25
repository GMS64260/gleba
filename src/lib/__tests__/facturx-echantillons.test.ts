import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { genererPdfFacture } from "@/lib/facture-pdf"
import { donneesFactureStructuree, type FacturePourExport } from "@/lib/facture-structuree"
import { buildUblInvoice } from "@/lib/facture-ubl"
import type { EmetteurSnapshot } from "@/lib/facture-utils"
import { PROFIL_CII, buildCiiInvoice } from "@/lib/facturx/cii"

/**
 * Échantillons Factur-X et UBL de bout en bout (données fictives, hors base) :
 * facture standard à deux taux, franchise en base, facture déjà payée avec
 * livraison, avoir. Sert de test d'intégration PDF + CII + UBL et, avec la
 * variable `FACTURX_OUT=<dossier>`, dépose les fichiers pour le validateur
 * externe (`scripts/qa/valider-facturx.sh`, Mustang : veraPDF + XSD +
 * schematron EN 16931 et BR-FR). Chantier facturation électronique.
 */
const SORTIE = process.env.FACTURX_OUT

const emetteur = (regimeTva: string, extra: Partial<EmetteurSnapshot> = {}): EmetteurSnapshot => ({
  raisonSociale: "Ferme des Essais",
  formeJuridique: "EARL",
  territoire: "METROPOLE",
  siret: "73282932000074",
  siren: "732829320",
  identifiantLegal: null,
  devise: "EUR",
  numeroTvaIntracom: "FR44732829320",
  regimeFiscal: "micro-BA",
  regimeTva,
  optionTvaDebits: false,
  adresseSiege: "12 chemin des Vignes",
  codePostal: "64000",
  ville: "Pau",
  pays: "France",
  emailContact: "contact@ferme-essais.example",
  telContact: "0500000000",
  capitalSocial: 10000,
  rib: "FR7630006000011234567890189",
  bic: "AGRIFRPP",
  banqueNom: "Banque",
  logoUrl: null,
  certifBioOrganisme: null,
  tauxPenalitesRetard: "3 fois le taux légal",
  indemniteRecouvrement: 40,
  tauxEscompte: "néant",
  ...extra,
})

const client = () => ({
  id: 1, userId: "u", nom: "Épicerie du Marché", type: "professionnel", email: "achats@epicerie.example", telephone: null,
  adresse: "4 place du Marché", ville: "Bayonne", codePostal: "64100", pays: "France", siret: "55210055400013", siren: "552100554", tvaIntra: "FR40552100554",
  conditionsPaiement: 30, exonererTVA: false, notes: null, actif: true, createdAt: new Date(), updatedAt: new Date(),
})

const ligne = (ordre: number, description: string, quantite: number, unite: string, prixUnitaire: number, tauxTVA: number) => {
  const montantHT = Math.round(quantite * prixUnitaire * 100) / 100
  const montantTVA = Math.round(montantHT * tauxTVA) / 100
  return { id: ordre + 1, factureId: 1, ordre, description, quantite, unite, prixUnitaire, tauxTVA, montantHT, montantTVA, montantTTC: montantHT + montantTVA, statutBio: ordre === 0 ? "AB" : null }
}

const base = (numero: string, type: string, lignes: ReturnType<typeof ligne>[], extra: Record<string, unknown> = {}): FacturePourExport => {
  const totalHT = Math.round(lignes.reduce((s, l) => s + l.montantHT, 0) * 100) / 100
  const totalTVA = Math.round(lignes.reduce((s, l) => s + l.montantTVA, 0) * 100) / 100
  const c = client()
  return {
    id: 1, userId: "u", numero, type, clientId: 1, client: c, clientNom: c.nom, clientAdresse: "4 place du Marché", clientSiret: c.siret, clientSiren: c.siren, clientTvaIntra: c.tvaIntra,
    date: new Date("2026-10-12T00:00:00+02:00"), dateEcheance: new Date("2026-11-11T00:00:00+01:00"), objet: "Légumes de saison, semaine 41",
    categorieOperation: "biens", dateLivraison: null, adresseLivraison: null, codePostalLivraison: null, villeLivraison: null, paysLivraison: null,
    totalHT, totalTVA, totalTTC: Math.round((totalHT + totalTVA) * 100) / 100, totauxParTauxTva: null, statut: "emise", datePaiement: null, modePaiement: null,
    factureOrigineId: null, conditionsPaiement: "Paiement à 30 jours", mentionsSpecifiques: ["escompte", "penalites", "indemnite-40", "ab"], emetteurSnapshot: null,
    notes: null, mentionsLegales: null, createdAt: new Date(), updatedAt: new Date(), lignes, ...extra,
  } as unknown as FacturePourExport
}

async function produire(nom: string, facture: FacturePourExport, em: EmetteurSnapshot, origine: { numero: string; date: Date } | null = null) {
  const donnees = donneesFactureStructuree(facture, em, origine)
  const cii = buildCiiInvoice(donnees)
  const ubl = buildUblInvoice(donnees)
  const pdf = await genererPdfFacture(facture, em, { facturX: { xml: cii, profil: PROFIL_CII } })
  expect(pdf.subarray(0, 8).toString("latin1")).toBe("%PDF-1.7")
  expect(pdf.toString("latin1")).toContain("factur-x.xml")
  if (SORTIE) {
    fs.mkdirSync(SORTIE, { recursive: true })
    fs.writeFileSync(path.join(SORTIE, `${nom}.xml`), cii)
    fs.writeFileSync(path.join(SORTIE, `${nom}.ubl.xml`), ubl)
    fs.writeFileSync(path.join(SORTIE, `${nom}.pdf`), pdf)
  }
  return { donnees, cii, ubl, pdf }
}

describe("échantillons Factur-X et UBL de bout en bout", () => {
  it("facture standard à deux taux, régime réel", async () => {
    const lignes = [ligne(0, "Tomates anciennes", 12.5, "kg", 3.2, 5.5), ligne(1, "Livraison", 1, "unité", 15, 20), ligne(2, "Panier de légumes", 3, "unité", 18.9, 5.5)]
    const { donnees, cii } = await produire("facture-standard", base("F-2026-0042", "facture", lignes, { categorieOperation: "mixte" }), emetteur("reel-simplifie"))
    expect(donnees.cadreFacturation).toBe("M1")
    expect(donnees.traitement).toBe("B2B")
    expect(cii).toContain('<udt:DateTimeString format="102">20261012</udt:DateTimeString>')
  })

  it("franchise en base sans numéro de TVA", async () => {
    const lignes = [ligne(0, "Tomates anciennes", 12.5, "kg", 3.2, 0), ligne(1, "Courgettes", 8, "kg", 2.5, 0)]
    const { donnees, cii } = await produire(
      "facture-franchise",
      base("F-2026-0043", "facture", lignes, { mentionsSpecifiques: ["293b", "escompte", "penalites", "indemnite-40"] }),
      emetteur("franchise-293b", { numeroTvaIntracom: null }),
    )
    expect(donnees.exonerationTva?.code).toBe("VATEX-FR-FRANCHISE")
    expect(cii).toContain('schemeID="FC">732829320<')
  })

  it("facture déjà payée, option débits, livraison ailleurs et à une autre date", async () => {
    const lignes = [ligne(0, "Taille de haie", 4, "heure", 45, 20)]
    const { donnees, cii } = await produire(
      "facture-payee-livraison",
      base("F-2026-0044", "facture", lignes, {
        categorieOperation: "services", statut: "payee", datePaiement: new Date("2026-10-12T15:00:00+02:00"), modePaiement: "virement",
        dateLivraison: new Date("2026-10-09T00:00:00+02:00"), adresseLivraison: "Lieu-dit Larrouy", codePostalLivraison: "64160", villeLivraison: "Morlaàs", paysLivraison: "France",
      }),
      emetteur("reel-normal", { optionTvaDebits: true }),
    )
    expect(donnees.cadreFacturation).toBe("S2")
    expect(cii).toContain("<ram:DueDateTypeCode>5</ram:DueDateTypeCode>")
    expect(cii).toContain("<ram:ShipToTradeParty>")
    expect(cii).toContain("<ram:DuePayableAmount>0.00</ram:DuePayableAmount>")
  })

  it("avoir sur la facture standard", async () => {
    const lignes = [ligne(0, "Retour tomates abîmées", 2, "kg", 3.2, 5.5)]
    const { ubl } = await produire(
      "avoir",
      base("AV-2026-0003", "avoir", lignes, { factureOrigineId: 1, objet: "Avoir sur F-2026-0042" }),
      emetteur("reel-simplifie"),
      { numero: "F-2026-0042", date: new Date("2026-10-12T00:00:00+02:00") },
    )
    expect(ubl).toContain("<CreditNote ")
  })

  it("particulier sans SIREN : B2C, courriel comme adresse électronique", async () => {
    const lignes = [ligne(0, "Panier de légumes", 2, "unité", 18.9, 5.5)]
    const particulier = { ...client(), nom: "Jeanne Martin", type: "particulier", siret: null, siren: null, tvaIntra: null, email: "jeanne@exemple.fr" }
    const { donnees } = await produire(
      "facture-particulier",
      base("F-2026-0045", "facture", lignes, { client: particulier, clientNom: particulier.nom, clientSiret: null, clientSiren: null, clientTvaIntra: null }),
      emetteur("reel-simplifie"),
    )
    expect(donnees.traitement).toBe("B2C")
  })

  it("facture émise puis encaissée : reste en cadre x1, net à payer = TTC, échéance d'origine", async () => {
    const lignes = [ligne(0, "Panier de légumes", 2, "unité", 18.9, 5.5)]
    const { donnees, cii, ubl } = await produire(
      "facture-encaissee-apres",
      base("F-2026-0046", "facture", lignes, { statut: "payee", datePaiement: new Date("2026-10-20T10:00:00+02:00"), modePaiement: "virement" }),
      emetteur("reel-simplifie"),
    )
    expect(donnees.cadreFacturation).toBe("B1")
    expect(donnees.paiement).toBeNull()
    expect(cii).toContain(`<ram:DuePayableAmount>${donnees.totalGross.toFixed(2)}</ram:DuePayableAmount>`)
    expect(cii).not.toContain("TotalPrepaidAmount")
    expect(ubl).toContain("<cbc:DueDate>2026-11-11</cbc:DueDate>")
  })

  it("conditions et notes saisies : note libre (BT-22) dans le CII et l'UBL, PDF d'une seule page (ticket cmvflhyyu)", async () => {
    const lignes = [ligne(0, "Panier de légumes", 2, "unité", 18.9, 5.5)]
    const notes = "Paiement à 30 jours par virement.\nRappelez le numéro de facture en référence."
    const { donnees, cii, ubl, pdf } = await produire("facture-notes", base("F-2026-0050", "facture", lignes, { notes }), emetteur("reel-simplifie"))
    expect(donnees.noteLibre).toBe(notes)
    expect(cii).toContain(`<ram:IncludedNote><ram:Content>${notes}</ram:Content></ram:IncludedNote>`)
    expect(ubl).toContain(`<cbc:Note>${notes}</cbc:Note>`)
    // Une seule page : le bloc de notes ne repousse pas le pied sur une page vide.
    expect(pdf.toString("latin1").match(/\/Type \/Page(?!s)/g)?.length).toBe(1)
  })

  it("ligne offerte à 0 € : admise (BR-27 n'interdit que le négatif)", async () => {
    const lignes = [ligne(0, "Tomates anciennes", 5, "kg", 3.2, 5.5), ligne(1, "Sac en toile offert", 1, "unité", 0, 5.5)]
    const { donnees, cii } = await produire("facture-ligne-offerte", base("F-2026-0047", "facture", lignes), emetteur("reel-simplifie"))
    expect(donnees.lines[1].unitPrice).toBe(0)
    expect(cii).toContain("<ram:ChargeAmount>0.00</ram:ChargeAmount>")
  })

  it("vente saisie TTC à PU HT non rond (ticket cmvnuxvax) : PU exact au XML, totaux au centime, PDF produit", async () => {
    // 29 bouquets à 1,20 € TTC, TVA 5,5 %, comme une récolte vendue avec
    // facture automatique (PU HT = 1,20 / 1,055 stocké exact). « pièce » et non
    // « tige » : l'unité tige n'a pas encore de code UN/ECE (export refusé).
    const prixUnitaire = 1.2 / 1.055
    const montantHT = 34.8 / 1.055
    const lignes = [{
      id: 1, factureId: 1, ordre: 0, description: "Bouquet de dahlias", quantite: 29, unite: "pièce",
      prixUnitaire, tauxTVA: 5.5, montantHT, montantTVA: 34.8 - montantHT, montantTTC: 34.8, statutBio: null,
    }]
    const { donnees, cii, ubl } = await produire("facture-pu-non-rond", base("F-2026-0051", "facture", lignes), emetteur("reel-simplifie"))
    expect(donnees.totalNet).toBe(32.99)
    expect(donnees.totalVat).toBe(1.81)
    expect(donnees.totalGross).toBe(34.8)
    expect(cii).toContain("<ram:ChargeAmount>1.137441</ram:ChargeAmount>")
    expect(cii).toContain("<ram:LineTotalAmount>32.99</ram:LineTotalAmount>")
    expect(ubl).toContain(">1.137441</cbc:PriceAmount>")
  })

  it("client professionnel sans SIREN : B2B et export refusé, jamais dégradé en B2C", () => {
    const lignes = [ligne(0, "Panier de légumes", 2, "unité", 18.9, 5.5)]
    const pro = { ...client(), nom: "Restaurant du Port", type: "professionnel", siret: null, siren: null, tvaIntra: null }
    const donnees = donneesFactureStructuree(
      base("F-2026-0048", "facture", lignes, { client: pro, clientNom: pro.nom, clientSiret: null, clientSiren: null, clientTvaIntra: null }),
      emetteur("reel-simplifie"),
    )
    expect(donnees.traitement).toBe("B2B")
    expect(() => buildCiiInvoice(donnees)).toThrow(/SIREN de l'acheteur manquant/)
    expect(() => buildUblInvoice(donnees)).toThrow(/SIREN de l'acheteur manquant/)
  })

  it("particulier sans courriel : export refusé faute d'adresse électronique (BT-49)", () => {
    const lignes = [ligne(0, "Panier de légumes", 2, "unité", 18.9, 5.5)]
    const particulier = { ...client(), nom: "Jeanne Martin", type: "particulier", siret: null, siren: null, tvaIntra: null, email: null }
    const donnees = donneesFactureStructuree(
      base("F-2026-0049", "facture", lignes, { client: particulier, clientNom: particulier.nom, clientSiret: null, clientSiren: null, clientTvaIntra: null }),
      emetteur("reel-simplifie"),
    )
    expect(donnees.traitement).toBe("B2C")
    expect(() => buildCiiInvoice(donnees)).toThrow(/BT-49/)
  })
})
