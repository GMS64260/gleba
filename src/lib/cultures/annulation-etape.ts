/**
 * Annulation d'une étape faite (semis, plantation, récolte) : le registre de
 * récolte fait foi. Règle commune aux actions rapides (PATCH) et au formulaire
 * de la fiche culture (PUT), qui l'ignorait (FB-S9UM9T).
 */
import type { ChampEtape } from '@/lib/cultures/execution'

export const LIBELLE_ETAPE: Record<ChampEtape, string> = {
  semisFait: 'le semis',
  plantationFaite: 'la plantation',
  recolteFaite: 'la récolte',
}

/** Corps du refus 409, ou null quand rien n'est annulé ou qu'aucune récolte n'existe. */
export function refusAnnulationEtapes(
  etapesAnnulees: readonly ChampEtape[],
  nombreRecoltes: number
): { error: string; recoltes: number } | null {
  if (etapesAnnulees.length === 0 || nombreRecoltes <= 0) return null
  const n = nombreRecoltes
  return {
    error: `Cette culture porte ${n} récolte${n > 1 ? 's' : ''} enregistrée${n > 1 ? 's' : ''}`
      + ` : ${etapesAnnulees.map((e) => LIBELLE_ETAPE[e]).join(' et ')} ne peut pas être annulé`
      + ` sans contredire le registre de récolte. Supprimez d'abord les récoltes concernées.`,
    recoltes: n,
  }
}
