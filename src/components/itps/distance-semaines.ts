/**
 * Distance, en semaines et vers l'avant, entre la semaine ISO courante et une
 * semaine cible d'ITP (1–52).
 *
 * Le calcul « modulo 52 » de l'encart lunaire supposait une année de 52
 * semaines. Dans une année ISO qui en compte 53 (2026, 2032, 2037), les semis
 * de début d'année suivante paraissaient une semaine trop proches dès la fin
 * décembre, et en semaine 53 un semis de S1 était annoncé « cette semaine ».
 */
export function distanceSemainesAvant(
  courante: number,
  cible: number,
  semainesDansAnnee: number
): number {
  return cible >= courante ? cible - courante : cible + semainesDansAnnee - courante
}
