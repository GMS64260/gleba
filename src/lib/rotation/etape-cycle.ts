/**
 * Position dans un cycle de rotation — module sans dépendance serveur pour
 * qu'un écran client puisse EXPLIQUER la phase qu'il affiche.
 */
/**
 * Ancrage de phase utilisé quand la planche n'a pas d'année de départ. Epoch
 * FIXE : la phase est alors arbitraire, mais elle progresse correctement d'une
 * année sur l'autre (audit 2026-07, #26).
 */
export const EPOCH_ROTATION_SANS_ANCRAGE = 2000

/**
 * Étape courante du cycle de rotation d'une planche (1..nbAnnees).
 *
 * Ancrée sur `Planche.annee` — l'année où cette planche est à l'étape 1. C'est
 * ce qui permet d'étaler un même cycle sur plusieurs planches : deux planches
 * de la même rotation peuvent légitimement être à des étapes différentes.
 *
 * QA cmswy9fyr puis cmsx6348h : le calcul vivait en un seul endroit, mais les
 * écrans qui devaient l'EXPLIQUER n'y avaient pas accès. Un seul helper pour
 * tous, sinon deux écrans annoncent deux étapes.
 */
export function etapeCycleRotation(
  anneeCible: number,
  ancrage: number | null | undefined,
  nbAnnees: number,
): number {
  if (!nbAnnees || nbAnnees < 1) return 1
  const anneeRef = ancrage ?? EPOCH_ROTATION_SANS_ANCRAGE
  return ((((anneeCible - anneeRef) % nbAnnees) + nbAnnees) % nbAnnees) + 1
}
