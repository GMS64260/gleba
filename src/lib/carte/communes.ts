import { getOrFetch } from '@/lib/cache-helper'

const GEO_API_URL = 'https://geo.api.gouv.fr/communes'
const CHAMPS = 'nom,code,codesPostaux,centre'
const LIMITE = '10'
// Référentiel public partagé : aucune donnée d’exploitation dans cette clé.
const CACHE_TTL_MS = 24 * 60 * 60_000
const TIMEOUT_MS = 10_000

export interface Commune {
  nom: string
  code: string
  codesPostaux: string[]
  centre?: { type: 'Point'; coordinates: [number, number] }
}

export class GeoApiHttpError extends Error {
  constructor(public readonly status: number) {
    super(`API Geo erreur ${status}`)
    this.name = 'GeoApiHttpError'
  }
}

/** Le délai couvre la connexion ET la lecture du corps, sans reprise automatique. */
async function chargerCommunes(nom: string): Promise<Commune[]> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const erreur = new DOMException('Délai de recherche de communes dépassé', 'TimeoutError')
      reject(erreur)
      controller.abort(erreur)
    }, TIMEOUT_MS)
  })

  try {
    return await Promise.race([
      timeout,
      (async () => {
        const params = new URLSearchParams({ nom, fields: CHAMPS, limit: LIMITE })
        const response = await fetch(`${GEO_API_URL}?${params}`, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
          signal: controller.signal,
        })
        // Ne jamais lire le corps d’erreur (souvent une page HTML de maintenance).
        if (!response.ok) throw new GeoApiHttpError(response.status)
        let communes: unknown
        try {
          communes = await response.json()
        } catch {
          // Une SyntaxError de JSON peut contenir le corps : ne pas la propager au journal.
          throw new Error('API Geo : réponse JSON illisible')
        }
        if (!Array.isArray(communes)) throw new Error('API Geo : tableau de communes attendu')
        return communes as Commune[]
      })(),
    ])
  } finally {
    clearTimeout(timer)
  }
}

/** Lecteur unique du référentiel : cache persistant, grâce et recul du helper commun. */
export function rechercherCommunes(q: string): Promise<Commune[]> {
  const nom = q.trim().normalize('NFC').toLowerCase()
  // Version des champs et limite incluses : une évolution du format isole ses entrées.
  const key = `geo:communes:v1:${CHAMPS}:${LIMITE}:${encodeURIComponent(nom)}`
  return getOrFetch(key, () => chargerCommunes(nom), CACHE_TTL_MS)
}
