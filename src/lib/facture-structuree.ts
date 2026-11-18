import type { Prisma } from "@prisma/client"

import prisma from "@/lib/prisma"
import { monnaieFacture } from "@/lib/comptabilite/devise-reglement"
import { acheteurDeFacture, AVERTISSEMENT_ACHETEUR_NON_FIGE } from "@/lib/comptabilite/rattachement-client"
import { cadreFacturation, dateIsoFacture, mentionsCodifiees, traitementFacture, type CategorieOperation, type MentionCodifiee } from "@/lib/facture-regles"
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
  /**
   * Conditions et notes saisies sur la facture (champ `notes`, BT-22 sans
   * code sujet), imprimées aussi sur le PDF ; null si vides ou identiques à
   * l'objet (déjà porté par la première note). Ticket cmvflhyyu.
   */
  noteLibre: string | null
  /** Option pour le paiement de la TVA d'après les débits (BT-8 = 5 en CII, 3 en UBL). */
  optionTvaDebits: boolean
  /** Date de livraison ou de fin d'exécution (BT-72), la date de facture à défaut. */
  dateLivraison: Date
  /** Adresse de livraison si différente de celle de l'acheteur (BG-15). */
  adresseLivraison: UblAddress | null
  /** Facture payée à l'émission (cadre x2) : BT-113 = TTC, BT-115 = 0, BT-9 = date de paiement. Null si payée après l'émission. */
  paiement: { date: Date; montant: number } | null
}

export class ErreurDeviseFacture extends Error {
  constructor() {
    super("La devise historique de cette facture est inconnue. Faites vérifier la facture avant de l’exporter ou de l’envoyer.")
    this.name = "ErreurDeviseFacture"
  }
}

/** Les brouillons prennent l'identité en cours ; une pièce émise garde sa monnaie datée. */
export function deviseEditionFacture(
  facture: Pick<FacturePourExport, "emetteurSnapshot" | "date" | "statut">,
  emetteur: EmetteurSnapshot | null,
) {
  const devise = monnaieFacture(facture.statut === "brouillon" ? emetteur : facture.emetteurSnapshot, facture.date)
  if (!devise) throw new ErreurDeviseFacture()
  return devise
}

/** Complément légal courant pour les pièces sans instantané, monnaie historique indépendante. */
export async function emetteurDeFacture(
  facture: Pick<FacturePourExport, "emetteurSnapshot" | "date" | "statut">,
  userId: string,
): Promise<EmetteurSnapshot | null> {
  let emetteur = facture.emetteurSnapshot as EmetteurSnapshot | null
  if (!emetteur) {
    const exploitation = await prisma.exploitation.findUnique({ where: { userId } })
    emetteur = exploitation ? snapshotDepuisExploitation(exploitation) : null
  }
  const devise = deviseEditionFacture(facture, emetteur)
  return emetteur ? { ...emetteur, devise } : null
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

/** Note libre de la facture pour l'export structuré (même texte que le bloc « Conditions et notes » du PDF). */
export function noteLibreDeFacture(facture: Pick<FacturePourExport, "notes" | "objet">): string | null {
  const note = (facture.notes ?? "").replace(/\r\n?/g, "\n").trim()
  if (!note || note === (facture.objet ?? "").trim()) return null
  return note
}

export function donneesFactureStructuree(
  facture: FacturePourExport,
  emetteur: EmetteurSnapshot,
  factureOrigine: { numero: string; date: Date } | null = null,
): DonneesFactureStructuree {
  const typeCode = TYPE_CODES_FACTURE[facture.type as keyof typeof TYPE_CODES_FACTURE] ?? TYPE_CODES_FACTURE.facture
  const devise = deviseEditionFacture(facture, emetteur)
  const categorieOperation = (facture.categorieOperation as CategorieOperation) || "biens"

  // Identité archivée seule ; l'absence d'instantané complet est signalée.
  // Aucune donnée de la fiche actuelle ne reconstitue l'acheteur historique.
  const acheteur = acheteurDeFacture(facture)

  // Facture déjà payée au dépôt (cadre x2, BR-FR-CO-09, cas d'usage AFNOR n° 2) :
  // seulement si le paiement date du jour de l'émission ou d'avant (vente
  // comptant). Une facture émise puis encaissée reste en cadre x1, sinon son
  // export changerait après coup sous le même numéro. Jamais pour un avoir.
  const datePaiement = facture.datePaiement || facture.date
  const payeeALEmission = facture.statut === "payee" && typeCode !== "381" && dateIsoFacture(datePaiement) <= dateIsoFacture(facture.date)
  const paiement = payeeALEmission ? { date: datePaiement, montant: facture.totalTTC } : null

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
      name: acheteur.nom,
      siret: acheteur.siret,
      siren: acheteur.siren,
      vatId: acheteur.tvaIntra,
      email: acheteur.email,
      address: {
        street: acheteur.adresse,
        city: acheteur.ville,
        postalCode: acheteur.codePostal,
        country: acheteur.pays,
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
    traitement: traitementFacture(acheteur.siren, acheteur.type),
    mentions: mentionsCodifiees(emetteur, devise),
    exonerationTva: exonerationDeFacture(facture, emetteur),
    factureOrigine,
    conditionsPaiement: facture.conditionsPaiement,
    noteLibre: noteLibreDeFacture(facture),
    optionTvaDebits: emetteur.optionTvaDebits === true,
    dateLivraison: facture.dateLivraison || facture.date,
    adresseLivraison: facture.adresseLivraison
      ? {
          street: facture.adresseLivraison,
          postalCode: facture.codePostalLivraison,
          city: facture.villeLivraison,
          country: facture.paysLivraison || acheteur.pays || "FR",
        }
      : null,
    paiement,
  }
}

export type PreparationExport =
  | {
      ok: true
      donnees: DonneesFactureStructuree
      emetteur: EmetteurSnapshot
      /** Rapport d'export : ce que l'utilisateur doit savoir de la pièce (ex. acheteur non figé). */
      avertissements: string[]
    }
  | { ok: false; status: number; error: string }

/** En-tête HTTP (ASCII) qui signale, sur un export, un acheteur non figé. */
export const ENTETE_ACHETEUR_FIGE = "X-Gleba-Acheteur-Fige"

/** En-têtes du rapport d'export à joindre à la réponse d'un PDF, UBL ou Factur-X. */
export function entetesRapportExport(facture: Parameters<typeof acheteurDeFacture>[0]): Record<string, string> {
  return { [ENTETE_ACHETEUR_FIGE]: acheteurDeFacture(facture).fige ? "oui" : "non" }
}

/**
 * Prépare l'export structuré d'une facture : refuse un brouillon (pas de numéro
 * définitif), exige l'identité de l'exploitation, charge la facture d'origine
 * d'un avoir. Commun aux routes UBL et Factur-X.
 */
export async function preparerExportFacture(facture: FacturePourExport, userId: string, format: "UBL" | "Factur-X"): Promise<PreparationExport> {
  if (facture.statut === "brouillon") {
    return { ok: false, status: 400, error: `Un brouillon n'a pas de numéro définitif : émettez la facture avant l'export ${format}` }
  }
  let emetteur: EmetteurSnapshot | null
  try {
    emetteur = await emetteurDeFacture(facture, userId)
  } catch (error) {
    if (error instanceof ErreurDeviseFacture) return { ok: false, status: 422, error: error.message }
    throw error
  }
  if (!emetteur) return { ok: false, status: 422, error: `Configurez l'identité de l'exploitation avant l'export ${format}` }

  let origine: { numero: string; date: Date } | null = null
  if (facture.type === "avoir" && facture.factureOrigineId) {
    origine = await prisma.facture.findFirst({ where: { id: facture.factureOrigineId, userId }, select: { numero: true, date: true } })
  }
  const avertissements = acheteurDeFacture(facture).fige ? [] : [AVERTISSEMENT_ACHETEUR_NON_FIGE]
  return { ok: true, donnees: donneesFactureStructuree(facture, emetteur, origine), emetteur, avertissements }
}
