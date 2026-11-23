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

const ORDRE_ETAPES = Object.keys(LIBELLE_ETAPE) as ChampEtape[]

/**
 * Cohérence du cycle : on n'annule pas une étape en laissant une étape
 * postérieure marquée faite, sauf si le même envoi annule aussi celle-ci.
 * Les actions rapides (PATCH) le refusaient ; la fiche (PUT) laissait annuler
 * le semis d'une culture plantée et récoltée (FB-EYRRO5).
 */
export function refusCycleIncoherent(
  etapesAnnulees: readonly ChampEtape[],
  resteraFaite: (etape: ChampEtape) => boolean
): { error: string } | null {
  for (const annulee of etapesAnnulees) {
    const aval = ORDRE_ETAPES.slice(ORDRE_ETAPES.indexOf(annulee) + 1).filter(resteraFaite)
    if (aval.length > 0) {
      return {
        error: `Annulez d'abord ${aval.map((e) => LIBELLE_ETAPE[e]).join(' et ')}`
          + ` : le cycle ne peut pas revenir avant ${LIBELLE_ETAPE[annulee]}`
          + ` tant qu'une étape postérieure reste marquée faite.`,
      }
    }
  }
  return null
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
