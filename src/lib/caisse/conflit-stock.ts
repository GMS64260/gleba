/**
 * Stub public. La caisse de marché n'est pas distribuée : sur gleba.fr, ce
 * module traduit les refus de ses contrôles de stock en messages lisibles
 * (voir docs/private-stubs.md). Sans elle, seul le conflit d'écriture
 * concurrente, commun à toute instance, a un message.
 */
export function messageConflitStockCaisse(erreur: unknown): string | null {
  if (!(erreur instanceof Error)) return null
  if (('code' in erreur && erreur.code === 'P2034') || /deadlock detected/.test(erreur.message))
    return 'Le stock a été modifié au même moment. Actualisez les quantités et réessayez.'
  return null
}
