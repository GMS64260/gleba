/** Fin du cumul réalisé : jamais après maintenant ni après l’année choisie. */
export function finRecoltesYtd(year: number, asOf: Date): Date {
  const finAnnee = new Date(year, 11, 31, 23, 59, 59, 999)
  return asOf < finAnnee ? asOf : finAnnee
}
