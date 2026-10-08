export type DateApiResult =
  | { ok: true; value: Date | null | undefined }
  | { ok: false }

/**
 * Convertit une date reçue par une route API sans laisser Prisma sérialiser
 * une année étendue (par exemple 0120), que JavaScript accepte mais que le
 * connecteur PostgreSQL refuse. Les dates simples sont aussi contrôlées
 * strictement pour ne pas transformer silencieusement un 31 février.
 */
export function normaliserDateApi(value: unknown): DateApiResult {
  if (value === undefined) return { ok: true, value: undefined }
  if (value === null || value === "") return { ok: true, value: null }
  if (typeof value !== "string") return { ok: false }

  const dateSimple = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const date = new Date(dateSimple ? `${value}T00:00:00.000Z` : value)
  if (Number.isNaN(date.getTime())) return { ok: false }

  const annee = date.getUTCFullYear()
  if (annee < 1000 || annee > 9999) return { ok: false }
  if (dateSimple && date.toISOString().slice(0, 10) !== value) return { ok: false }

  return { ok: true, value: date }
}
