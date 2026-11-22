/**
 * Préremplissage des délais d'attente du formulaire de soin depuis le
 * référentiel vétérinaire, rechargé à chaque changement d'espèce.
 *
 * FB-7YARYN : ce préremplissage tournait aussi à l'ouverture d'un soin
 * existant (l'espèce de l'animal ou du lot est connue juste après). Il
 * remplaçait les délais enregistrés par ceux du catalogue, dont le délai œufs
 * est vide : enregistrer une simple note effaçait le délai œufs et la fin
 * d'attente, et les œufs redevenaient vendables. En modification, les délais
 * du soin font foi ; seul un changement de produit les remplace.
 */
export type DelaisFormulaireSoin = {
  produitId: string
  tempsAttenteLaitJ: string
  tempsAttenteOeufsJ: string
  tempsAttenteViandeJ: string
}

type ProduitCatalogue = {
  id: string
  tempsAttenteLaitJ: number
  tempsAttenteViandeJ: number
  tempsAttenteOeufsJ?: number | null
}

export function preremplirDelaisDepuisCatalogue<T extends DelaisFormulaireSoin>(
  formulaire: T,
  catalogue: readonly ProduitCatalogue[],
  enModification: boolean
): T {
  if (enModification || !formulaire.produitId) return formulaire
  const produit = catalogue.find((item) => item.id === formulaire.produitId)
  if (!produit) return formulaire
  return {
    ...formulaire,
    tempsAttenteLaitJ: String(produit.tempsAttenteLaitJ),
    tempsAttenteOeufsJ: produit.tempsAttenteOeufsJ ? String(produit.tempsAttenteOeufsJ) : "",
    tempsAttenteViandeJ: String(produit.tempsAttenteViandeJ),
  }
}
