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
