import { finJourLivraison } from '@/lib/commercial/dates-stock'
import { normaliserDateApi } from '@/lib/validations/date-api'

type FiltreDate = { gte?: Date; lt?: Date; lte?: Date }
type PeriodeConsommations =
  | { ok: true; date?: FiltreDate }
  | { ok: false; error: string; champ: 'start' | 'end' }

const JOUR = /^\d{4}-\d{2}-\d{2}$/
const INSTANT = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/

function lireBorne(value: string): { date: Date; jourSeul: boolean } | null {
  const jourSeul = JOUR.test(value)
  const instant = INSTANT.exec(value)
  if (!jourSeul && !instant) return null
  // Contrôler aussi le calendrier d'un instant : Date corrige sinon le 30 février.
  const jour = normaliserDateApi(jourSeul ? value : instant![1])
  const date = normaliserDateApi(value)
  if (!jour.ok || !jour.value || !date.ok || !date.value) return null
  return { date: date.value, jourSeul }
}

/**
 * Jours simples inclusifs à Paris (même convention que les mouvements de
 * stock commerciaux). Les ISO complets conservent leurs instants inclusifs.
 * La fin d'un jour est exclusive au début du lendemain, même sur 23 ou 25 h.
 */
export function periodeConsommations(start: string | null, end: string | null): PeriodeConsommations {
  const date: FiltreDate = {}
  if (start !== null) {
    const borne = lireBorne(start)
    if (!borne) return { ok: false, error: 'Date de début invalide : renseignez un jour au format AAAA-MM-JJ ou une date ISO avec fuseau.', champ: 'start' }
    // Partir de la veille civile, pas soustraire 24 h au début du lendemain.
    const veilleMidi = new Date(borne.date.getTime() - 12 * 3_600_000)
    date.gte = borne.jourSeul
      ? new Date(finJourLivraison(veilleMidi).getTime() + 1)
      : borne.date
  }
  if (end !== null) {
    const borne = lireBorne(end)
    if (!borne) return { ok: false, error: 'Date de fin invalide : renseignez un jour au format AAAA-MM-JJ ou une date ISO avec fuseau.', champ: 'end' }
    if (borne.jourSeul) {
      const midi = new Date(borne.date.getTime() + 12 * 3_600_000)
      date.lt = new Date(finJourLivraison(midi).getTime() + 1)
    } else date.lte = borne.date
  }
  if (date.gte && ((date.lt && date.gte >= date.lt) || (date.lte && date.gte > date.lte))) {
    return { ok: false, error: 'La date de fin doit être postérieure ou égale à la date de début.', champ: 'end' }
  }
  return { ok: true, ...(start !== null || end !== null ? { date } : {}) }
}
