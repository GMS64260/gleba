/**
 * fetchWithRetry — wrapper fetch avec retry exponentiel sur erreurs transitoires.
 *
 * DEV1 Ticket 2 (audit QA 2026-05-14) : au premier chargement de
 * /comptabilite/clients, GET /api/comptabilite/clients?actif=true répondait
 * 503 (cold start serveur). Refresh manuel → 200. Sans retry, l'utilisateur
 * voit une page d'erreur alors que le serveur est juste en train de chauffer.
 *
 * Codes considérés transitoires (retry) :
 *   - 502 Bad Gateway (proxy temporairement injoignable)
 *   - 503 Service Unavailable (cold start / scaling)
 *   - 504 Gateway Timeout (worker pas prêt)
 *   - 429 Too Many Requests (rate limit) — backoff aide à éviter le hammering
 *   - Network errors (fetch rejette : DNS, TCP, TLS)
 *
 * Backoff exponentiel : 200ms → 400ms → 800ms (jitter ±25%) sur 3 tentatives.
 * Total worst case : ~1.5s avant abandon.
 */

const RETRY_STATUS = new Set([429, 502, 503, 504])
const DEFAULT_RETRIES = 3
const BASE_DELAY_MS = 200

export interface FetchRetryOptions extends RequestInit {
  /** Nombre total de tentatives. Défaut : 3. */
  retries?: number
  /** Délai initial en ms. Défaut : 200. */
  baseDelayMs?: number
  /** Callback appelé à chaque retry (utile pour logs / toast). */
  onRetry?: (attempt: number, lastError: Error | null, lastStatus: number | null) => void
}

function jittered(ms: number): number {
  return Math.round(ms * (0.75 + Math.random() * 0.5))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: FetchRetryOptions = {}
): Promise<Response> {
  const { retries = DEFAULT_RETRIES, baseDelayMs = BASE_DELAY_MS, onRetry, ...fetchInit } = init
  let lastError: Error | null = null
  let lastResponse: Response | null = null

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(input, fetchInit)
      // Succès franc → on retourne immédiatement.
      if (!RETRY_STATUS.has(res.status)) {
        return res
      }
      lastResponse = res
      lastError = new Error(`HTTP ${res.status}`)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      lastResponse = null
    }

    if (attempt === retries - 1) break

    const delay = jittered(baseDelayMs * Math.pow(2, attempt))
    onRetry?.(attempt + 1, lastError, lastResponse?.status ?? null)
    await sleep(delay)
  }

  // Si la dernière tentative a renvoyé un Response 5xx, on le retourne au
  // caller (sémantique fetch standard : c'est à lui de tester res.ok).
  if (lastResponse) return lastResponse
  throw lastError ?? new Error("Échec fetch inconnu")
}
