type SoinAvecDate = {
  date: string
  datePrevue?: string | null
}

type AttenteAvecRemiseVente = {
  lait?: { remiseVente: string } | null
  viande?: { remiseVente: string } | null
}

function timestamp(value: string | null | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY
}

/** Soins les plus urgents : date planifiée, puis date du soin en repli. */
export function soinsSanitairesPrioritaires<T extends SoinAvecDate>(
  soins: readonly T[],
  limite = 3,
): T[] {
  return [...soins]
    .sort((a, b) => timestamp(a.datePrevue ?? a.date) - timestamp(b.datePrevue ?? b.date))
    .slice(0, Math.max(0, limite))
}

/** Délais les plus proches, en prenant la première remise en vente lait/viande. */
export function attentesSanitairesPrioritaires<T extends AttenteAvecRemiseVente>(
  attentes: readonly T[],
  limite = 3,
): T[] {
  const premiereRemise = (attente: T) =>
    Math.min(
      timestamp(attente.lait?.remiseVente),
      timestamp(attente.viande?.remiseVente),
    )

  return [...attentes]
    .sort((a, b) => premiereRemise(a) - premiereRemise(b))
    .slice(0, Math.max(0, limite))
}
