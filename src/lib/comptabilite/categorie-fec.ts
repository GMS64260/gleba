/**
 * Catégorie du plan comptable (clé de `COMPTES_VENTES` / `COMPTES_ACHATS`)
 * d'une écriture d'élevage exportée au FEC.
 *
 * Les miroirs automatiques portent une catégorie d'AFFICHAGE (« achats »,
 * « lait », « animal_vivant ») absente du plan : `compteVente` / `compteAchat`
 * retombaient sur « autre », et l'achat d'un lot de poulettes sortait en
 * 658000 (charges diverses), la paie du lait et les cessions réservées en
 * 708000 (activités annexes). La source, elle, dit sans ambiguïté de quoi il
 * s'agit : on classe d'après elle, sans toucher à la catégorie stockée.
 */

/** Type d'une `VenteProduit` → catégorie du plan. */
export function categorieFecVenteElevage(type: string | null | undefined): string {
  switch (type) {
    case 'oeufs': return 'oeufs'
    case 'viande': return 'viande'
    case 'animal_vivant': return 'animaux_vivants'
    case 'lait': return 'produits_transformes'
    case 'fromage': return 'produits_transformes'
    case 'miel':
    case 'cire':
    case 'propolis':
    case 'pollen':
    case 'gelee_royale':
    case 'autre_ruche':
      return 'produits_ruche'
    case 'autre':
    default: return 'autre'
  }
}

/** Miroir de vente (`VenteManuelle` automatique) : catégorie d'après sa source. */
export function categorieFecMiroirVente(
  sourceType: string | null | undefined,
  categorie: string | null | undefined,
): string | null {
  // Même compte que le lait vendu en direct (`categorieFecVenteElevage('lait')`).
  if (sourceType === 'paie_lait') return 'produits_transformes'
  if (sourceType === 'reservation_elevage') return 'animaux_vivants'
  return categorie ?? null
}

/** Miroir de dépense (`DepenseManuelle` automatique) : catégorie d'après sa source. */
export function categorieFecMiroirDepense(
  sourceType: string | null | undefined,
  categorie: string | null | undefined,
): string | null {
  if (sourceType === 'achat_animal' || sourceType === 'achat_animal_individuel') return 'animaux'
  return categorie ?? null
}

/**
 * Ligne d'une facture née d'une vente d'élevage ou d'un abattage : la facture
 * ne porte alors qu'une ligne, dont le libellé (« animal_vivant - Brebis 1234 »,
 * ou le seul nom de l'animal abattu) ne se devine pas par mots-clés.
 * `null` : facture sans source d'élevage, à classer par son libellé.
 */
export function categorieFecLigneFactureElevage(facture: {
  lignes: unknown[]
  ventesProduits?: Array<{ type: string | null }>
  abattages?: unknown[]
}): string | null {
  if (facture.lignes.length !== 1) return null
  const ventes = facture.ventesProduits ?? []
  const abattages = facture.abattages ?? []
  if (ventes.length === 1 && abattages.length === 0) return categorieFecVenteElevage(ventes[0].type)
  if (abattages.length === 1 && ventes.length === 0) return 'viande'
  return null
}
