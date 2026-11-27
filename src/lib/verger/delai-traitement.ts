/**
 * Un traitement d'arbre réalisé dont le délai avant récolte reste à saisir :
 * l'écran qui le coche « fait » propose alors de le renseigner sur place.
 * Un biostimulant déclaré n'a pas de délai.
 */
export type OperationDelai = {
  id: number
  type: string
  produit?: string | null
  dar?: number | null
  natureProduit?: string | null
}

export function delaiTraitementASaisir(op: OperationDelai): boolean {
  return op.type === 'traitement' && op.dar == null && op.natureProduit !== 'biostimulant'
}

/** Corps du PUT /api/arbres/operations/[id] : champ vide = délai effacé. */
export function corpsDelaiTraitement(saisie: { dar: string; natureProduit: string }) {
  const dar = saisie.dar.trim()
  return { dar: dar === '' ? null : Number(dar), natureProduit: saisie.natureProduit || null }
}

/**
 * Même corps, réduit aux champs changés depuis l'ouverture de la fenêtre : la
 * route garde tel quel un champ absent. Tout renvoyer faisait rétablir par un
 * onglet resté ouvert le délai qu'un autre venait de corriger, alors que seule
 * la nature y avait été modifiée (équipe debug, D164).
 */
export function corpsDelaiModifie(
  lu: Pick<OperationDelai, 'dar' | 'natureProduit'>,
  saisie: { dar: string; natureProduit: string },
): { dar?: number | null; natureProduit?: string | null } {
  const complet = corpsDelaiTraitement(saisie)
  const corps: { dar?: number | null; natureProduit?: string | null } = {}
  if (complet.dar !== (lu.dar ?? null)) corps.dar = complet.dar
  if (complet.natureProduit !== (lu.natureProduit || null)) corps.natureProduit = complet.natureProduit
  return corps
}
