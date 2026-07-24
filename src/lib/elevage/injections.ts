export type InjectionEtat = {
  numero: number
  datePrevue: Date
  dateRealisee?: Date | null
  statut: string
}

export function calendrierInjections(
  debut: Date,
  nombre: number,
  intervalleHeures: number | null,
  premiereRealisee: boolean,
): InjectionEtat[] {
  const n = Math.max(1, Math.min(30, nombre))
  const intervalle = n > 1 ? intervalleHeures : null
  if (n > 1 && (!intervalle || intervalle < 1 || intervalle > 2160)) {
    throw new Error("Un intervalle valide est requis pour plusieurs injections")
  }
  return Array.from({ length: n }, (_, index) => {
    const datePrevue = new Date(debut.getTime() + index * (intervalle ?? 0) * 3_600_000)
    const realisee = index === 0 && premiereRealisee
    return {
      numero: index + 1,
      datePrevue,
      dateRealisee: realisee ? new Date(debut) : null,
      statut: realisee ? "realisee" : "a_faire",
    }
  })
}

/** Dernière administration prévue ou réalisée, en excluant les annulations. */
export function derniereInjectionActive(injections: InjectionEtat[]): Date | null {
  const actives = injections.filter((i) => i.statut !== "annulee")
  if (actives.length === 0) return null
  return new Date(Math.max(...actives.map((i) => (i.dateRealisee ?? i.datePrevue).getTime())))
}

export function ajouterJours(date: Date, jours: number | null): Date | null {
  if (!jours || jours <= 0) return null
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + jours)
  return result
}
