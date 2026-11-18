/**
 * Décision B13-1 : un paiement de commande boutique reçu pendant un délai
 * avant récolte est enregistré, mais la livraison reste refusée. Texte affiché
 * par l'écran Boutique > Commandes à partir de `avertissementDar` renvoyé par
 * POST /api/boutique/commandes/[id]/confirmer-paiement. Sans dépendance : lu
 * côté client.
 */
export type AvertissementDarPaiement = { blocages: string[] }

export function messageAvertissementDarPaiement(avertissement: AvertissementDarPaiement | null | undefined): string | null {
  if (!avertissement?.blocages?.length) return null
  return `Paiement enregistré. Livraison impossible tant que le délai avant récolte n’est pas respecté : ${avertissement.blocages.join(' ')}`
}
