import type { Prisma } from "@prisma/client"

import prisma from "@/lib/prisma"
import { cadreFacturation, mentionsCodifiees, traitementFacture, type CategorieOperation, type MentionCodifiee } from "@/lib/facture-regles"
import { snapshotDepuisExploitation, type EmetteurSnapshot } from "@/lib/facture-utils"
import type { UblAddress, UblInvoiceData } from "@/lib/facture-ubl"
import { sirenFromSiret } from "@/lib/siret"
import { mentionFiscale } from "@/lib/territoires"

/**
 * Données structurées d'une facture, communes aux exports UBL 2.1 et Factur-X
 * (CII EN 16931) : une seule lecture de la facture, de son émetteur et de son
 * acheteur, deux sérialisations. Chantier facturation électronique (lot 0 le
 * 2026-10-12, lot 1 le 2026-10-13 : mentions de la réforme et règles BR-FR).
 */
export type FacturePourExport = Prisma.FactureGetPayload<{ include: { client: true; lignes: true } }>

/** Codes UNTDID 1001 : facture, avoir, facture d'acompte. */
export const TYPE_CODES_FACTURE = { facture: "380", avoir: "381", acompte: "386" } as const
export type TypeCodeFacture = (typeof TYPE_CODES_FACTURE)[keyof typeof TYPE_CODES_FACTURE]

export interface DonneesFactureStructuree extends UblInvoiceData {
  typeCode: TypeCodeFacture
  categorieOperation: CategorieOperation
  /** Cadre de facturation BT-23 (B1, S1, M1 ; B2, S2, M2 si déjà payée). */
  cadreFacturation: string
  /** Traitement attendu de la plateforme (note BAR) : B2B si l'acheteur a un SIREN, B2C sinon. */
  traitement: "B2B" | "B2C"
  /** Mentions codifiées obligatoires (BR-FR-05) : escompte AAB, pénalités PMD, indemnité PMT. */
  mentions: MentionCodifiee[]
  /** Facture sans TVA : catégorie E, code VATEX s'il existe (franchise) et motif imprimé. */
  exonerationTva: { code: string | null; motif: string } | null
  /** Facture d'origine d'un avoir (BG-3). */
  factureOrigine: { numero: string; date: Date } | null
  conditionsPaiement: string | null
  /** Option pour le paiement de la TVA d'après les débits (BT-8 = 5 en CII, 3 en UBL). */
  optionTvaDebits: boolean
  /** Date de livraison ou de fin d'exécution (BT-72), la date de facture à défaut. */
  dateLivraison: Date
  /** Adresse de livraison si différente de celle de l'acheteur (BG-15). */
  adresseLivraison: UblAddress | null
  /** Facture déjà payée au dépôt (cadre x2) : BT-113 = TTC, BT-115 = 0, BT-9 = date de paiement. */
  paiement: { date: Date; montant: number } | null
}

/**
 * Émetteur figé sur la facture (`emetteurSnapshot`), sinon l'exploitation
 * courante (factures antérieures au snapshot).
 */
export async function emetteurDeFacture(facture: { emetteurSnapshot: unknown }, userId: string): Promise<EmetteurSnapshot | null> {
  if (facture.emetteurSnapshot) return facture.emetteurSnapshot as EmetteurSnapshot
  const exploitation = await prisma.exploitation.findUnique({ where: { userId } })
  return exploitation ? snapshotDepuisExploitation(exploitation) : null
}

/** La facture a été émise en franchise en base : mention portée, ou régime de l'émetteur sans aucune TVA. */
export function enFranchiseDeTva(facture: Pick<FacturePourExport, "mentionsSpecifiques" | "totalTVA">, emetteur: Pick<EmetteurSnapshot, "regimeTva">): boolean {
  if ((facture.mentionsSpecifiques || []).includes("293b")) return true
  return emetteur.regimeTva === "franchise-293b" && Math.abs(facture.totalTVA) < 0.005
}

/** Motif d'exonération (BT-120/BT-121) d'une facture sans TVA, selon la mention portée puis le régime de l'émetteur. */
export function exonerationDeFacture(
  facture: Pick<FacturePourExport, "mentionsSpecifiques" | "totalTVA">,
  emetteur: Pick<EmetteurSnapshot, "regimeTva">,
): DonneesFactureStructuree["exonerationTva"] {
  if (enFranchiseDeTva(facture, emetteur)) return { code: "VATEX-FR-FRANCHISE", motif: "TVA non applicable, art. 293 B du CGI" }
  const mentions = facture.mentionsSpecifiques || []
  const sansTva = Math.abs(facture.totalTVA) < 0.005
  if (mentions.includes("rfa") || (emetteur.regimeTva === "rfa" && sansTva)) return { code: null, motif: mentionFiscale("rfa") || "TVA non applicable" }
  if (mentions.includes("exoneration") || (["non-assujetti", "tgc"].includes(emetteur.regimeTva) && sansTva)) return { code: null, motif: "TVA non applicable" }
  return null
}

function chiffres(value?: string | null): string {
  return (value || "").replace(/\D/g, "")
}

export function donneesFactureStructuree(
  facture: FacturePourExport,
  emetteur: EmetteurSnapshot,
  factureOrigine: { numero: string; date: Date } | null = null,
): DonneesFactureStructuree {
  const typeCode = TYPE_CODES_FACTURE[facture.type as keyof typeof TYPE_CODES_FACTURE] ?? TYPE_CODES_FACTURE.facture
  const devise = emetteur.devise || "EUR"
  const categorieOperation = (facture.categorieOperation as CategorieOperation) || "biens"

  // Identité de l'acheteur : figée sur la facture (lot 1), sinon la fiche client.
  const clientSiret = facture.clientSiret || facture.client?.siret || null
  const clientSiren = facture.clientSiren || facture.client?.siren || (clientSiret && chiffres(clientSiret).length === 14 ? sirenFromSiret(clientSiret) : null)
  const clientTvaIntra = facture.clientTvaIntra || facture.client?.tvaIntra || null

  // Facture déjà payée au dépôt (BR-FR-CO-09) : jamais pour un avoir.
  const paiement = facture.statut === "payee" && typeCode !== "381" ? { date: facture.datePaiement || facture.date, montant: facture.totalTTC } : null

  return {
    number: facture.numero,
    issueDate: facture.date,
    dueDate: paiement ? paiement.date : facture.dateEcheance,
    currency: devise,
    supplier: {
      name: emetteur.raisonSociale,
      siret: emetteur.siret,
      siren: emetteur.siren || (emetteur.siret ? sirenFromSiret(emetteur.siret) : null),
      vatId: emetteur.numeroTvaIntracom,
      email: emetteur.emailContact,
      address: { street: emetteur.adresseSiege, city: emetteur.ville, postalCode: emetteur.codePostal, country: emetteur.pays },
    },
    customer: {
      name: facture.clientNom,
      siret: clientSiret,
      siren: clientSiren,
      vatId: clientTvaIntra,
      email: facture.client?.email,
      address: {
        street: facture.clientAdresse || facture.client?.adresse,
        city: facture.client?.ville,
        postalCode: facture.client?.codePostal,
        country: facture.client?.pays,
      },
    },
    lines: facture.lignes.map((line) => ({
      id: line.ordre + 1,
      description: line.description,
      quantity: line.quantite,
      unit: line.unite,
      unitPrice: line.prixUnitaire,
      netAmount: line.montantHT,
      vatRate: line.tauxTVA,
    })),
    totalNet: facture.totalHT,
    totalVat: facture.totalTVA,
    totalGross: facture.totalTTC,
    paymentReference: facture.numero,
    paymentIban: emetteur.rib,
    notes: facture.objet,
    buyerReference: null,
    typeCode,
    categorieOperation,
    cadreFacturation: cadreFacturation(categorieOperation, paiement !== null),
    traitement: traitementFacture(clientSiren),
    mentions: mentionsCodifiees(emetteur, devise),
    exonerationTva: exonerationDeFacture(facture, emetteur),
    factureOrigine,
    conditionsPaiement: facture.conditionsPaiement,
    optionTvaDebits: emetteur.optionTvaDebits === true,
    dateLivraison: facture.dateLivraison || facture.date,
    adresseLivraison: facture.adresseLivraison
      ? {
          street: facture.adresseLivraison,
          postalCode: facture.codePostalLivraison,
          city: facture.villeLivraison,
          country: facture.paysLivraison || facture.client?.pays || "FR",
        }
      : null,
    paiement,
  }
}

export type PreparationExport = { ok: true; donnees: DonneesFactureStructuree; emetteur: EmetteurSnapshot } | { ok: false; status: number; error: string }

/**
 * Prépare l'export structuré d'une facture : refuse un brouillon (pas de numéro
 * définitif), exige l'identité de l'exploitation, charge la facture d'origine
 * d'un avoir. Commun aux routes UBL et Factur-X.
 */
export async function preparerExportFacture(facture: FacturePourExport, userId: string, format: "UBL" | "Factur-X"): Promise<PreparationExport> {
  if (facture.statut === "brouillon") {
    return { ok: false, status: 400, error: `Un brouillon n'a pas de numéro définitif : émettez la facture avant l'export ${format}` }
  }
  const emetteur = await emetteurDeFacture(facture, userId)
  if (!emetteur) return { ok: false, status: 422, error: `Configurez l'identité de l'exploitation avant l'export ${format}` }

  let origine: { numero: string; date: Date } | null = null
  if (facture.type === "avoir" && facture.factureOrigineId) {
    origine = await prisma.facture.findFirst({ where: { id: facture.factureOrigineId, userId }, select: { numero: true, date: true } })
  }
  return { ok: true, donnees: donneesFactureStructuree(facture, emetteur, origine), emetteur }
}
