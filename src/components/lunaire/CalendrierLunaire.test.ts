/**
 * Calendrier lunaire : une réponse d'erreur de `/api/lunaire` ne doit pas
 * devenir un calendrier (revue du 2026-10-28, témoin lune-erreur-http).
 */
import { afterEach, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ index: 0, valeurs: [] as unknown[], callbacks: [] as ((...a: unknown[]) => unknown)[] }))
// Banc minimal des hooks : exécuter le vrai chargement, puis le vrai rendu,
// sans navigateur, serveur applicatif ou compte de production.
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState: (initiale: unknown) => {
    const i = m.index++
    if (!(i in m.valeurs)) m.valeurs[i] = initiale
    return [m.valeurs[i], (v: unknown) => { m.valeurs[i] = v }]
  },
  useRef: (v: unknown) => ({ current: v }),
  useEffect: () => {},
  useCallback: (fn: (...a: unknown[]) => unknown) => { m.callbacks.push(fn); return fn },
}))
import { CalendrierLunaire } from './CalendrierLunaire'

afterEach(() => vi.unstubAllGlobals())

async function chargerAvec(reponse: { ok: boolean; status: number; json: () => Promise<unknown> }) {
  const fetch = vi.fn(async () => reponse)
  vi.stubGlobal('fetch', fetch)
  // aujourdhui, jourLu, todayStr, mois, calData, calLoading, selectedDay
  m.valeurs = [null, true, '2026-10-28', { annee: 2026, mois: 10 }, null, true, null]
  m.index = 0
  m.callbacks = []
  CalendrierLunaire({ variante: 'page' })
  m.callbacks[0](2026, 10)
  await vi.waitFor(() => expect(m.valeurs[5]).toBe(false))
  return fetch
}

it('une réponse HTTP 503 JSON du calendrier doit afficher une indisponibilité, pas faire planter le rendu', async () => {
  await chargerAvec({ ok: false, status: 503, json: async () => ({ error: 'Service momentanément indisponible' }) })
  m.index = 0
  expect(() => CalendrierLunaire({ variante: 'page' })).not.toThrow()
  // Rien n'est gardé comme calendrier : l'écran dit « Calendrier indisponible ».
  expect(m.valeurs[4]).toBeNull()
})

it('un 200 sans calendrier exploitable est aussi une indisponibilité', async () => {
  await chargerAvec({ ok: true, status: 200, json: async () => ({ calendrier: { year: 2026, month: 10 } }) })
  m.index = 0
  expect(() => CalendrierLunaire({ variante: 'page' })).not.toThrow()
  expect(m.valeurs[4]).toBeNull()
})
