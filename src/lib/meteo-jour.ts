/** Jour des lectures météo, explicite même si le serveur tourne en UTC. */
export function jourMeteoISO(date: Date = new Date(), fuseau = 'Europe/Paris'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
}

/** Une série peut commencer hier ou être incomplète : aucune lecture par position. */
export function previsionDuJour<T extends { date: string }>(
  jours: readonly T[],
  reference: Date = new Date(),
  fuseau = 'Europe/Paris',
): T | undefined {
  const aujourdHui = jourMeteoISO(reference, fuseau)
  return jours.find(jour => jour.date === aujourdHui)
}
