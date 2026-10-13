import type { EmetteurSnapshot } from "@/lib/facture-utils"
import { symboleDevise } from "@/lib/format-utils"
import { CATEGORIES_OPERATION, type CategorieOperation } from "@/lib/validations/facture"

/**
 * Règles de la facturation électronique partagées par le PDF, le Factur-X
 * (CII) et l'UBL : catégorie d'opération et cadre de facturation (BT-23),
 * traitement attendu de la plateforme (note BAR), mentions codifiées
 * obligatoires (BR-FR-05 : PMT, PMD, AAB), option TVA d'après les débits
 * (BT-8) et jour calendaire des dates. Source : norme XP Z12-012 v1.3
 * (schematron BR-FR du 2026-02-16) et table DGFiP des données de facture
 * (août 2026). Chantier facturation électronique, lot 1 (2026-10-13).
 */
export { CATEGORIES_OPERATION }
export type { CategorieOperation }

export const LABELS_CATEGORIE_OPERATION: Record<CategorieOperation, string> = {
  biens: "Livraison de biens",
  services: "Prestation de services",
  mixte: "Livraison de biens et prestation de services",
}

/** Cadres de facturation (BT-23) que Gleba sait produire : dépôt d'une facture (x1) ou d'une facture déjà payée (x2). */
export const CADRES_FACTURATION_GLEBA = ["B1", "S1", "M1", "B2", "S2", "M2"] as const

/**
 * Cadre de facturation BT-23 : première lettre = catégorie (B biens, S
 * services, M mixte), chiffre 1 = dépôt d'une facture, 2 = facture déjà payée
 * au dépôt (BR-FR-CO-09 : montant payé = TTC, net à payer 0, échéance = date
 * de paiement).
 */
export function cadreFacturation(categorie: CategorieOperation, dejaPayee: boolean): string {
  const lettre = categorie === "services" ? "S" : categorie === "mixte" ? "M" : "B"
  return `${lettre}${dejaPayee ? 2 : 1}`
}

export function categorieDuCadre(cadre: string): CategorieOperation {
  if (cadre.startsWith("S")) return "services"
  if (cadre.startsWith("M")) return "mixte"
  return "biens"
}

/**
 * Traitement attendu de la plateforme (note BAR, BR-FR-20) : B2B quand
 * l'acheteur est identifié par un SIREN (facture électronique obligatoire),
 * B2C sinon (particulier : e-reporting, pas de dépôt).
 */
export function traitementFacture(clientSiren?: string | null): "B2B" | "B2C" {
  return /^\d{9}$/.test((clientSiren || "").replace(/\D/g, "")) ? "B2B" : "B2C"
}

export type CodeMentionCodifiee = "PMT" | "PMD" | "AAB" | "TXD"

export interface MentionCodifiee {
  /** Code sujet UNTDID 4451 (BT-21). */
  code: CodeMentionCodifiee
  /** Texte imprimé et transmis (BT-22). */
  texte: string
}

function montantMention(n: number, devise: string): string {
  const decimales = devise === "XPF" ? 0 : 2
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales })} ${symboleDevise(devise as "EUR" | "XPF")}`
}

/**
 * Les trois mentions codifiées exigées sur toute facture française (art.
 * L441-10 C. com., BR-FR-05) : escompte ou son absence (AAB), pénalités de
 * retard (PMD), indemnité forfaitaire de recouvrement (PMT). Mêmes textes dans
 * le PDF et dans le XML.
 */
export function mentionsCodifiees(
  emetteur: Pick<EmetteurSnapshot, "tauxEscompte" | "tauxPenalitesRetard" | "indemniteRecouvrement"> | null,
  devise = "EUR",
): MentionCodifiee[] {
  const escompte = emetteur?.tauxEscompte?.trim() || "néant"
  const penalites = emetteur?.tauxPenalitesRetard?.trim() || "3 × taux légal"
  const indemnite = emetteur?.indemniteRecouvrement ?? 40
  return [
    { code: "AAB", texte: `Escompte pour règlement anticipé : ${escompte}.` },
    { code: "PMD", texte: `Pénalités de retard : ${penalites} en cas de paiement après échéance (art. L441-10 C. com.).` },
    { code: "PMT", texte: `Indemnité forfaitaire pour frais de recouvrement : ${montantMention(indemnite, devise)} (art. L441-10 C. com.).` },
  ]
}

/** Mention obligatoire quand l'émetteur a opté pour la TVA d'après les débits (BT-8 = 5 en CII, 3 en UBL). */
export const MENTION_OPTION_DEBITS = "Option pour le paiement de la TVA d'après les débits (art. 269-2-c du CGI)."

/**
 * Jour calendaire d'une date, en heure de Paris : c'est le jour imprimé sur le
 * PDF et celui des bornes d'exercice (`TZ=Europe/Paris` du conteneur). Le jour
 * UTC décalait d'un jour toute facture émise entre minuit et 2 h en été
 * (constaté le 2026-10-13 sur les exports CII et UBL).
 */
export function jourFacture(d: Date | string): { annee: string; mois: string; jour: string } {
  const parties = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(d))
  const lire = (type: string) => parties.find((p) => p.type === type)?.value || ""
  return { annee: lire("year"), mois: lire("month"), jour: lire("day") }
}

/** AAAA-MM-JJ (UBL). */
export function dateIsoFacture(d: Date | string): string {
  const j = jourFacture(d)
  return `${j.annee}-${j.mois}-${j.jour}`
}

/** AAAAMMJJ (CII, format 102). */
export function date102Facture(d: Date | string): string {
  const j = jourFacture(d)
  return `${j.annee}${j.mois}${j.jour}`
}
