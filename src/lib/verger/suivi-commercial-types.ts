export interface VenteCommercialeVerger {
  cle: string
  date: string
  quantiteLivree: number
  quantiteRetournee: number
  quantiteNette: number
  unite: string
  devise: string
  montantLivre: number
  /** Null si un avoir ne peut pas être attribué à ce lot sans supposition. */
  revenuTTC: number | null
  montantAvoirs: number
  documents: Array<{ id: string; numero: string }>
  facture: { id: number; numero: string; statut: string } | null
  clientNom: string
}
