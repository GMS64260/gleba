import type { UniteQuantite } from '@/lib/recolte/projection'

/** L’unité historique ne dépend jamais du rendement courant de l’espèce. */
export function uniteConsommation(ligne: { unite?: string | null }): UniteQuantite {
  return (ligne.unite ?? 'kg') as UniteQuantite
}
