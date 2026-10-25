/**
 * Lot de bois du verger (Productions > Bois) : une seule source pour le
 * libellé du type et pour les textes de vente, partagée par l'écran, la route
 * de vente (facture), l'écriture de vente automatique et la liste des
 * transactions.
 *
 * QA cmvnp0dm9 (2026-10-25) : le tableau affichait déjà « Élagage » (QA
 * cmsjhmi58), mais le résumé du dialogue de vente, l'objet et la ligne de la
 * facture, la vente comptable et la liste des transactions recomposaient leur
 * texte à partir de la valeur technique : « Vente de bois - elagage (0.2 m³) ».
 */

import { formatNombre } from "@/lib/format-utils"

/** Types de production de bois : valeur enregistrée et libellé affiché. */
export const TYPES_PRODUCTION_BOIS = [
  { value: "elagage", label: "Élagage" },
  { value: "abattage", label: "Abattage" },
  { value: "branchage", label: "Branchage" },
] as const

export type TypeProductionBois = (typeof TYPES_PRODUCTION_BOIS)[number]["value"]

export function estTypeProductionBois(valeur: unknown): valeur is TypeProductionBois {
  return TYPES_PRODUCTION_BOIS.some((t) => t.value === valeur)
}

/**
 * Refus d'un type à l'écriture (création et modification d'un lot), ou null
 * s'il est accepté. Renvoyé en 400 avec `champ: "type"`.
 */
export function refusTypeProductionBois(type: unknown): string | null {
  if (type === undefined || type === null || type === "") return "Le type de production est requis"
  if (estTypeProductionBois(type)) return null
  return `Type de production inconnu : choisissez ${TYPES_PRODUCTION_BOIS.map((t) => t.label).join(", ")}.`
}

/**
 * Libellé d'un type de production de bois (« elagage » → « Élagage »).
 * Une valeur hors liste (saisie ancienne) est rendue lisible telle quelle,
 * jamais en minuscules techniques ; sans type, « Bois ».
 */
export function libelleTypeBois(type: string | null | undefined): string {
  const brut = (type ?? "").trim()
  if (!brut) return "Bois"
  const cle = brut.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr-FR")
  const connu = TYPES_PRODUCTION_BOIS.find((t) => t.value === cle)
  if (connu) return connu.label
  return brut.charAt(0).toLocaleUpperCase("fr-FR") + brut.slice(1)
}

/** Volume d'un lot en écriture française : « 0,2 m³ ». */
export function libelleVolumeBois(volumeM3: number): string {
  return `${formatNombre(volumeM3, 3)} m³`
}

/** Poids d'un lot en écriture française : « 35,5 kg ». */
export function libellePoidsBois(poidsKg: number): string {
  return `${formatNombre(poidsKg, 2)} kg`
}

export interface LotBoisLibelle {
  type: string | null | undefined
  volumeM3?: number | null
  poidsKg?: number | null
  arbreNom?: string | null
}

/** Quantité d'un lot : le volume s'il est connu, sinon le poids. */
function quantiteLotBois(lot: LotBoisLibelle): string | null {
  if (lot.volumeM3) return libelleVolumeBois(lot.volumeM3)
  if (lot.poidsKg) return libellePoidsBois(lot.poidsKg)
  return null
}

/** Résumé d'un lot dans les dialogues : « Élagage - 0,2 m³ ». */
export function resumeLotBois(lot: LotBoisLibelle): string {
  return [libelleTypeBois(lot.type), quantiteLotBois(lot)].filter(Boolean).join(" - ")
}

/**
 * Textes d'une vente de bois :
 * - `objetFacture` : « Vente de bois - Élagage (0,2 m³) » ;
 * - `ligneFacture` : « Élagage - Noyer 2 » ;
 * - `description` (écriture de vente et liste des transactions) :
 *   « Vente bois - Élagage - Noyer 2 - 0,2 m³ ».
 */
export function libellesVenteBois(lot: LotBoisLibelle): {
  objetFacture: string
  ligneFacture: string
  description: string
} {
  const type = libelleTypeBois(lot.type)
  const quantite = quantiteLotBois(lot)
  const arbre = lot.arbreNom?.trim() || null
  return {
    objetFacture: `Vente de bois - ${type}${quantite ? ` (${quantite})` : ""}`,
    ligneFacture: [type, arbre].filter(Boolean).join(" - "),
    description: [`Vente bois - ${type}`, arbre, quantite].filter(Boolean).join(" - "),
  }
}
