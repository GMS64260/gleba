/**
 * Annulation d'une récolte faite (POST /api/cultures/[id]/annuler-recolte) :
 * message qui nomme les récoltes qui la retiennent. Hors du fichier de route,
 * qui ne peut exporter que ses gestionnaires HTTP.
 */

const LIBELLE_STATUT: Record<string, [string, string]> = {
  vendu: ['vendue', 'vendues'],
  consomme: ['consommée', 'consommées'],
  perte: ['perdue', 'perdues'],
  a_completer: ['à compléter', 'à compléter'],
}

/** « 2 récoltes vendues et 1 récolte perdue » : ce qui retient l'annulation. */
export function messageRecoltesRetenues(statuts: string[]): string {
  const parStatut = new Map<string, number>()
  for (const s of statuts) parStatut.set(s, (parStatut.get(s) ?? 0) + 1)
  const morceaux = [...parStatut].map(([statut, n]) => {
    const [un, plusieurs] = LIBELLE_STATUT[statut] ?? [statut, statut]
    return `${n} récolte${n > 1 ? 's' : ''} ${n > 1 ? plusieurs : un}`
  })
  return (
    `Cette culture porte ${morceaux.join(' et ')} : la récolte ne peut pas être annulée sans contredire ` +
    `le registre de récolte. Rien n'a été supprimé. Corrigez d'abord ces récoltes dans Maraîchage > Récoltes.`
  )
}
