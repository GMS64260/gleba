import { dateIsoFacture } from '@/lib/facture-regles'
import { periodeConsommations } from '@/lib/stocks/periode-consommations'
import { normaliserDateApi } from '@/lib/validations/date-api'

const JOUR_MS = 86_400_000
const JOUR = /^\d{4}-\d{2}-\d{2}$/

/** Bornes civiles inclusives à Paris ; une fin seule conserve tout l'historique. */
export function periodeQualiteLait(params: URLSearchParams, maintenant = new Date()) {
  let start = params.get('start')
  let end = params.get('end')
  const explicite = start !== null || end !== null
  for (const [champ, valeur] of [['start', start], ['end', end]] as const) {
    if (valeur === null) continue
    const date = normaliserDateApi(valeur)
    if (!JOUR.test(valeur) || !date.ok || !date.value) {
      return { ok: false as const, error: `Date de ${champ === 'start' ? 'début' : 'fin'} invalide : renseignez un jour au format AAAA-MM-JJ.`, champ }
    }
  }
  end ??= dateIsoFacture(maintenant)
  let fenetreJours: number | null
  if (!explicite) {
    fenetreJours = Math.min(Math.max(parseInt(params.get('fenetre') || '180', 10) || 180, 30), 730)
    start = new Date(Date.parse(`${end}T12:00:00Z`) - (fenetreJours - 1) * JOUR_MS).toISOString().slice(0, 10)
  } else {
    fenetreJours = start === null ? null : (Date.parse(end) - Date.parse(start)) / JOUR_MS + 1
  }
  const bornes = periodeConsommations(start, end)
  if (!bornes.ok) return bornes
  return {
    ok: true as const,
    date: bornes.date!,
    fenetreJours,
    periode: { mode: explicite ? 'periode' as const : 'fenetre' as const, start, end },
  }
}
