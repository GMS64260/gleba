import { monnaieFacture } from "./devise-reglement"
import { formatMontantDevise } from "@/lib/format-utils"
import type { Devise } from "@/lib/territoires"

export interface PieceAvecDevise {
  monnaie?: Devise | null
  factureId?: number | null
  emetteurSnapshot?: unknown
  date?: string
}

/** Une facture sans identité monétaire fournie ne prend jamais la devise courante. */
export function devisePieceAffichage(piece: PieceAvecDevise, deviseCourante: Devise | null): Devise | null {
  if (piece.monnaie !== undefined) return piece.monnaie === "EUR" || piece.monnaie === "XPF" ? piece.monnaie : null
  if (piece.factureId != null || piece.emetteurSnapshot !== undefined) {
    return monnaieFacture(piece.emetteurSnapshot)
  }
  return deviseCourante
}

export function formatMontantPiece(montant: number, piece: PieceAvecDevise, deviseCourante: Devise | null): string {
  const devise = devisePieceAffichage(piece, deviseCourante)
  return devise === null ? "—" : formatMontantDevise(montant, devise)
}

/** Un agrégat non ventilé ne s'affiche que si ses lignes ont toutes la devise annoncée. */
export function totalDansDeviseCourante(pieces: readonly PieceAvecDevise[], deviseCourante: Devise | null): boolean {
  return deviseCourante !== null && pieces.every(piece => devisePieceAffichage(piece, deviseCourante) === deviseCourante)
}
