import PDFDocument from "pdfkit"
import { describe, expect, it } from "vitest"

import {
  decimalesPrixUnitaire,
  formatPrixUnitaire,
  mentionPrixUnitaireTTC,
  prixUnitaireTTCSaisi,
} from "@/lib/comptabilite/prix-unitaire"
import { blocNotesFacture, dessinerFacture } from "@/lib/facture-pdf"
import type { FacturePourExport } from "@/lib/facture-structuree"
import type { EmetteurSnapshot } from "@/lib/facture-utils"

/**
 * Ticket cmvflhyyu (QA 2026-10-19) : le texte saisi dans « Notes / Conditions »
 * n'apparaissait pas sur le PDF de la facture. Il est imprimé dans un bloc
 * « Conditions et notes », retours à la ligne compris, sans régresser le
 * correctif du 2026-10-12 (pas de page vide pour le pied).
 */

const emetteur: EmetteurSnapshot = {
  raisonSociale: "Ferme des Essais",
  formeJuridique: "EARL",
  territoire: "METROPOLE",
  siret: "73282932000074",
  siren: "732829320",
  identifiantLegal: null,
  devise: "EUR",
  numeroTvaIntracom: "FR44732829320",
  regimeFiscal: "micro-BA",
  regimeTva: "reel-simplifie",
  optionTvaDebits: false,
  adresseSiege: "12 chemin des Vignes",
  codePostal: "64000",
  ville: "Pau",
  pays: "France",
  emailContact: "contact@ferme-essais.example",
  telContact: null,
  capitalSocial: null,
  rib: "FR7630006000011234567890189",
  bic: "AGRIFRPP",
  banqueNom: "Banque",
  logoUrl: null,
  certifBioOrganisme: null,
  tauxPenalitesRetard: "3 fois le taux légal",
  indemniteRecouvrement: 40,
  tauxEscompte: "néant",
}

const facture = (extra: Record<string, unknown> = {}): FacturePourExport =>
  ({
    id: 1, userId: "u", numero: "F-2026-0050", type: "facture", clientId: null, client: null,
    clientNom: "Client de test", clientAdresse: "1 rue de l'Essai, 64000 Pau", clientSiret: null, clientSiren: null, clientTvaIntra: null,
    date: new Date("2026-10-19T00:00:00+02:00"), dateEcheance: new Date("2026-11-18T00:00:00+01:00"), objet: "Légumes de saison",
    categorieOperation: "mixte", dateLivraison: null, adresseLivraison: null, codePostalLivraison: null, villeLivraison: null, paysLivraison: null,
    totalHT: 150, totalTVA: 15.5, totalTTC: 165.5, totauxParTauxTva: { "5.5": { ht: 100, tva: 5.5, ttc: 105.5 }, "20": { ht: 50, tva: 10, ttc: 60 } },
    statut: "emise", datePaiement: null, modePaiement: null, factureOrigineId: null, conditionsPaiement: null,
    mentionsSpecifiques: ["escompte", "penalites", "indemnite-40"], emetteurSnapshot: null, notes: null, mentionsLegales: null,
    createdAt: new Date(), updatedAt: new Date(),
    lignes: [
      { id: 1, factureId: 1, ordre: 0, description: "Légumes", quantite: 10, unite: "kg", prixUnitaire: 10, tauxTVA: 5.5, montantHT: 100, montantTVA: 5.5, montantTTC: 105.5, statutBio: null },
      { id: 2, factureId: 1, ordre: 1, description: "Livraison", quantite: 1, unite: "forfait", prixUnitaire: 50, tauxTVA: 20, montantHT: 50, montantTVA: 10, montantTTC: 60, statutBio: null },
    ],
    ...extra,
  }) as unknown as FacturePourExport

type Evenement = { page: true } | { texte: string; y: number }

/** Dessine la facture en relevant chaque texte posé et chaque page ouverte. */
async function dessiner(f: FacturePourExport): Promise<Evenement[]> {
  const doc = new PDFDocument({ size: "A4", margin: 50 })
  const evenements: Evenement[] = []
  doc.on("pageAdded", () => evenements.push({ page: true }))
  const texteOriginal = doc.text.bind(doc) as unknown as (...args: unknown[]) => PDFKit.PDFDocument
  ;(doc as unknown as { text: (...args: unknown[]) => PDFKit.PDFDocument }).text = (...args: unknown[]) => {
    evenements.push({ texte: String(args[0]), y: typeof args[2] === "number" ? args[2] : doc.y })
    return texteOriginal(...args)
  }
  const fin = new Promise<void>((resolve) => doc.on("end", () => resolve()))
  doc.on("data", () => {})
  dessinerFacture(doc, f, emetteur)
  doc.end()
  await fin
  return evenements
}

const textes = (ev: Evenement[]) => ev.flatMap((e) => ("texte" in e ? [e.texte] : []))
const pagesAjoutees = (ev: Evenement[]) => ev.filter((e) => "page" in e).length

describe("PDF de facture : conditions et notes saisies", () => {
  it("imprime le texte de « Notes / Conditions » avec ses retours à la ligne, sur une seule page", async () => {
    const notes = "Paiement à 30 jours par virement.\nRéférence à rappeler : F-2026-0050."
    const ev = await dessiner(facture({ notes }))
    expect(textes(ev)).toContain("Conditions et notes")
    expect(textes(ev)).toContain(notes)
    expect(pagesAjoutees(ev)).toBe(0)
  })

  it("n'imprime aucun bloc quand les notes sont vides ou ne répètent que l'objet", async () => {
    expect(blocNotesFacture({ type: "facture", notes: "  ", objet: null })).toBeNull()
    expect(blocNotesFacture({ type: "facture", notes: "Légumes de saison", objet: "Légumes de saison" })).toBeNull()
    const ev = await dessiner(facture())
    expect(textes(ev)).not.toContain("Conditions et notes")
    expect(pagesAjoutees(ev)).toBe(0)
  })

  it("titre le bloc « Motif de l'avoir » sur un avoir", () => {
    expect(blocNotesFacture({ type: "avoir", notes: "Retour de marchandise", objet: "Avoir sur facture F-2026-0001 — Retour de marchandise" })).toEqual({
      titre: "Motif de l'avoir",
      texte: "Retour de marchandise",
    })
  })

  it("de longues notes repoussent le pied sur une page qui a un contenu, jamais sur une page vide", async () => {
    const notes = Array.from({ length: 30 }, (_, i) => `Ligne de condition ${i + 1} : règlement par virement à réception.`).join("\n")
    const ev = await dessiner(facture({ notes }))
    expect(textes(ev)).toContain(notes)
    expect(textes(ev)).toContain("Mentions légales")
    // Au plus une page de plus, et la dernière porte autre chose que la seule
    // ligne « Document généré le… ».
    expect(pagesAjoutees(ev)).toBeLessThanOrEqual(1)
    const dernierePage = ev.slice(ev.map((e) => "page" in e).lastIndexOf(true) + 1)
    const contenus = textes(dernierePage).filter((t) => !t.startsWith("Document généré le"))
    expect(contenus.length).toBeGreaterThan(0)
    // Aucun texte posé sous la marge basse (hors pied « Document généré »), ce
    // qui ferait ouvrir une page en cascade par pdfkit.
    for (const e of ev) {
      if ("texte" in e && !e.texte.startsWith("Document généré le")) expect(e.y).toBeLessThan(842 - 50)
    }
  })
})

/**
 * Ticket cmvnuxvax (QA 2026-10-25) — 40 tiges de dahlia vendues 1,20 € TTC la
 * tige avec facture automatique (TVA 5,5 %) : le PDF F-2026-0012 affichait
 * « PU HT 1,14 » pour un total HT de 45,50 € (40 × 1,14 = 45,60). Le PU HT
 * stocké est exact (1,20 / 1,055) ; seul son affichage l'arrondissait. À
 * 4 décimales il reste un arrondi (29 × 1,1374 = 32,98 pour 32,99 exacts) :
 * la mention « soit 1,20 € TTC » donne la référence exacte.
 */
const PU_HT_EXACT = 1.2 / 1.055
const TOTAL_HT = 48 / 1.055

describe("prix unitaire de facture : une seule règle d'affichage", () => {
  it("2 décimales quand elles suffisent, sinon jusqu'à 4", () => {
    expect(formatPrixUnitaire(10)).toBe("10,00")
    expect(formatPrixUnitaire(1.5)).toBe("1,50")
    expect(formatPrixUnitaire(1.125)).toBe("1,125")
    expect(formatPrixUnitaire(PU_HT_EXACT)).toBe("1,1374")
    expect(decimalesPrixUnitaire(PU_HT_EXACT)).toBe(4)
    // Franc Pacifique : pas de centimes, sauf si le prix en a besoin.
    expect(formatPrixUnitaire(150, "XPF")).toBe("150")
    expect(formatPrixUnitaire(142.5, "XPF")).toBe("142,5")
  })

  it("rappelle le PU TTC d'une vente saisie TTC, et seulement d'elle", () => {
    expect(prixUnitaireTTCSaisi({ prixUnitaire: PU_HT_EXACT, tauxTVA: 5.5 })).toBe(1.2)
    expect(mentionPrixUnitaireTTC({ prixUnitaire: PU_HT_EXACT, tauxTVA: 5.5 })).toBe("soit 1,20 € TTC")
    // PU saisi HT (exact en centimes, ou à 4 décimales qui ne retombent pas sur un TTC rond).
    expect(mentionPrixUnitaireTTC({ prixUnitaire: 10, tauxTVA: 5.5 })).toBeNull()
    expect(mentionPrixUnitaireTTC({ prixUnitaire: 1.1374, tauxTVA: 5.5 })).toBeNull()
    // Sans taxe, le PU est déjà le prix payé.
    expect(mentionPrixUnitaireTTC({ prixUnitaire: PU_HT_EXACT, tauxTVA: 0 })).toBeNull()
  })

  it("le PDF de la vente de 40 tiges imprime 1,1374, le PU TTC saisi, et des totaux inchangés", async () => {
    const ev = await dessiner(
      facture({
        numero: "F-2026-0012",
        totalHT: TOTAL_HT,
        totalTVA: 48 - TOTAL_HT,
        totalTTC: 48,
        totauxParTauxTva: { "5.5": { ht: 45.5, tva: 2.5, ttc: 48 } },
        lignes: [
          {
            id: 1, factureId: 1, ordre: 0, description: "Dahlia", quantite: 40, unite: "tige",
            prixUnitaire: PU_HT_EXACT, tauxTVA: 5.5,
            montantHT: TOTAL_HT, montantTVA: 48 - TOTAL_HT, montantTTC: 48, statutBio: null,
          },
        ],
      }),
    )
    const t = textes(ev)
    expect(t).toContain("40 tige")
    expect(t).toContain("1,1374")
    expect(t).not.toContain("1,14")
    expect(t).toContain("soit 1,20 € TTC")
    // Total de ligne et totaux légaux : calculés sur la valeur exacte, pas sur le PU affiché.
    expect(t).toContain("45,50")
    expect(t).toContain("45,50 €")
    expect(t).toContain("2,50 €")
    expect(t).toContain("48,00 €")
    // Le PU HT affiché reste un arrondi : la référence exacte est le côté TTC,
    // quantité × PU TTC = total TTC (40 × 1,20 = 48,00).
    expect(Math.round(40 * 1.2 * 100) / 100).toBe(48)
    expect(pagesAjoutees(ev)).toBe(0)
  })

  it("une ligne à prix rond reste à 2 décimales, sans mention TTC", async () => {
    const t = textes(await dessiner(facture()))
    expect(t).toContain("10,00")
    expect(t).toContain("50,00")
    expect(t.some((x) => x.startsWith("soit "))).toBe(false)
  })
})
