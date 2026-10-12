import type { Prisma } from "@prisma/client"

import prisma from "@/lib/prisma"
import type { EmetteurSnapshot } from "@/lib/facture-utils"
import type { UblInvoiceData } from "@/lib/facture-ubl"

/**
 * Données structurées d'une facture, communes aux exports UBL 2.1 et Factur-X
 * (CII EN 16931). Une seule lecture de la facture et de son émetteur, deux
 * sérialisations. Chantier facturation électronique (2026-10-12).
 */
export type FacturePourExport = Prisma.FactureGetPayload<{ include: { client: true; lignes: true } }>

/** Codes UNTDID 1001 : facture, avoir, facture d'acompte. */
export const TYPE_CODES_FACTURE = { facture: "380", avoir: "381", acompte: "386" } as const
export type TypeCodeFacture = (typeof TYPE_CODES_FACTURE)[keyof typeof TYPE_CODES_FACTURE]

export interface DonneesFactureStructuree extends UblInvoiceData {
  typeCode: TypeCodeFacture
  /** Franchise en base (art. 293 B CGI) : catégorie E, code VATEX-FR-FRANCHISE. */
  exonerationTva: { code: string; motif: string } | null
  /** Facture d'origine d'un avoir (BG-3). */
  factureOrigine: { numero: string; date: Date } | null
  conditionsPaiement: string | null
}

/**
 * Émetteur figé sur la facture (`emetteurSnapshot`), sinon l'exploitation
 * courante (factures antérieures au snapshot).
 */
export async function emetteurDeFacture(facture: { emetteurSnapshot: unknown }, userId: string): Promise<EmetteurSnapshot | null> {
  if (facture.emetteurSnapshot) return facture.emetteurSnapshot as EmetteurSnapshot
  const exploitation = await prisma.exploitation.findUnique({ where: { userId } })
  if (!exploitation) return null
  return {
    raisonSociale: exploitation.raisonSociale,
    formeJuridique: exploitation.formeJuridique,
    territoire: exploitation.territoire,
    siret: exploitation.siret,
    siren: exploitation.siren,
    identifiantLegal: exploitation.identifiantLegal,
    devise: exploitation.devise,
    numeroTvaIntracom: exploitation.numeroTvaIntracom,
    regimeFiscal: exploitation.regimeFiscal,
    regimeTva: exploitation.regimeTva,
    adresseSiege: exploitation.adresseSiege,
    codePostal: exploitation.codePostal,
    ville: exploitation.ville,
    pays: exploitation.pays,
    emailContact: exploitation.emailContact,
    telContact: exploitation.telContact,
    capitalSocial: exploitation.capitalSocial ? Number(exploitation.capitalSocial) : null,
    rib: exploitation.rib,
    bic: exploitation.bic,
    banqueNom: exploitation.banqueNom,
    logoUrl: exploitation.logoUrl,
    certifBioOrganisme: exploitation.certifBioOrganisme,
    tauxPenalitesRetard: exploitation.tauxPenalitesRetard,
    indemniteRecouvrement: Number(exploitation.indemniteRecouvrement),
    tauxEscompte: exploitation.tauxEscompte,
  }
}

/** La facture a été émise en franchise en base : mention portée, ou régime de l'émetteur sans aucune TVA. */
export function enFranchiseDeTva(facture: Pick<FacturePourExport, "mentionsSpecifiques" | "totalTVA">, emetteur: Pick<EmetteurSnapshot, "regimeTva">): boolean {
  if ((facture.mentionsSpecifiques || []).includes("293b")) return true
  return emetteur.regimeTva === "franchise-293b" && Math.abs(facture.totalTVA) < 0.005
}

export function donneesFactureStructuree(
  facture: FacturePourExport,
  emetteur: EmetteurSnapshot,
  factureOrigine: { numero: string; date: Date } | null = null,
): DonneesFactureStructuree {
  const typeCode = TYPE_CODES_FACTURE[facture.type as keyof typeof TYPE_CODES_FACTURE] ?? TYPE_CODES_FACTURE.facture
  return {
    number: facture.numero,
    issueDate: facture.date,
    dueDate: facture.dateEcheance,
    currency: emetteur.devise || "EUR",
    supplier: {
      name: emetteur.raisonSociale,
      siret: emetteur.siret,
      vatId: emetteur.numeroTvaIntracom,
      email: emetteur.emailContact,
      address: { street: emetteur.adresseSiege, city: emetteur.ville, postalCode: emetteur.codePostal, country: emetteur.pays },
    },
    customer: {
      name: facture.clientNom,
      siret: facture.client?.siret,
      vatId: facture.client?.tvaIntra,
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
    buyerReference: facture.client?.siret,
    typeCode,
    exonerationTva: enFranchiseDeTva(facture, emetteur) ? { code: "VATEX-FR-FRANCHISE", motif: "TVA non applicable, art. 293 B du CGI" } : null,
    factureOrigine,
    conditionsPaiement: facture.conditionsPaiement,
  }
}
