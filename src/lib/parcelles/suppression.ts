/**
 * Garde de suppression d'une parcelle, PURE.
 *
 * Toutes les relations d'une parcelle sont en `SetNull` : la supprimer
 * détachait en silence ses planches, ses arbres et ses lots, et effaçait la
 * parcelle d'origine des récoltes, des traitements et des observations déjà
 * enregistrés (traçabilité, statut bio). Depuis la carte, un seul clic y
 * suffisait.
 *
 *  - traces (récoltes, bois, traitements, observations) : suppression refusée ;
 *  - rattachements vivants (planches, arbres, lots, animaux, capteurs,
 *    objets) : suppression possible après confirmation explicite.
 */
export type UsagesParcelle = {
  traces: Record<string, number>
  rattachements: Record<string, number>
}

export const LIBELLES_USAGE: Record<string, string> = {
  recoltesArbres: 'récolte(s) de fruits',
  productionsBois: 'production(s) de bois',
  interventionsPhyto: 'traitement(s)',
  observationsPhyto: 'observation(s) sanitaire(s)',
  planches: 'planche(s)',
  arbres: 'arbre(s)',
  lotsArbres: "lot(s) d'arbres",
  lotsAnimaux: "lot(s) d'animaux",
  animaux: 'animal(aux)',
  capteurs: 'capteur(s)',
  objetsJardin: 'objet(s) du plan',
}

export const CLES_TRACES = ['recoltesArbres', 'productionsBois', 'interventionsPhyto', 'observationsPhyto'] as const
export const CLES_RATTACHEMENTS = ['planches', 'arbres', 'lotsArbres', 'lotsAnimaux', 'animaux', 'capteurs', 'objetsJardin'] as const

const nonNuls = (compte: Record<string, number>, cles: readonly string[]) =>
  Object.fromEntries(cles.filter((c) => (compte[c] ?? 0) > 0).map((c) => [c, compte[c]]))

export function usagesParcelle(compte: Record<string, number>): UsagesParcelle {
  return { traces: nonNuls(compte, CLES_TRACES), rattachements: nonNuls(compte, CLES_RATTACHEMENTS) }
}

export function decrireUsages(usages: Record<string, number>): string {
  return Object.entries(usages).map(([cle, n]) => `${n} ${LIBELLES_USAGE[cle] ?? cle}`).join(', ')
}

export type RefusSuppressionParcelle = { code: 'PARCELLE_TRACEE' | 'PARCELLE_RATTACHEE'; error: string }

/** `null` si la suppression peut avoir lieu. */
export function refusSuppressionParcelle(usages: UsagesParcelle, confirme: boolean): RefusSuppressionParcelle | null {
  if (Object.keys(usages.traces).length > 0) {
    return {
      code: 'PARCELLE_TRACEE',
      error: `Cette parcelle porte ${decrireUsages(usages.traces)} : elle est leur origine et ne peut pas être supprimée. Renommez-la ou gardez-la telle quelle.`,
    }
  }
  if (Object.keys(usages.rattachements).length > 0 && !confirme) {
    return {
      code: 'PARCELLE_RATTACHEE',
      error: `Cette parcelle porte ${decrireUsages(usages.rattachements)} : ils seront détachés, pas supprimés. Confirmez pour la supprimer.`,
    }
  }
  return null
}
