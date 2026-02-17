/**
 * Rate limiting simple pour les API routes Next.js
 * Basé sur un store en mémoire (Map) avec nettoyage automatique
 */

import { NextResponse } from "next/server"

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Nettoyage périodique des entrées expirées (toutes les 5 minutes)
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }
}, 5 * 60 * 1000)

interface RateLimitOptions {
  windowMs?: number // Fenêtre en ms (défaut: 15 min)
  max?: number // Max requêtes par fenêtre (défaut: 100)
}

/**
 * Vérifie le rate limit pour une clé donnée (IP ou userId)
 * Retourne null si OK, ou une NextResponse 429 si limite atteinte
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions = {}
): NextResponse | null {
  const { windowMs = 15 * 60 * 1000, max = 100 } = options
  const now = Date.now()

  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }

  entry.count++

  if (entry.count > max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return NextResponse.json(
      { error: "Trop de requêtes, veuillez réessayer plus tard" },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(max),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
        },
      }
    )
  }

  return null
}

/**
 * Extrait l'IP depuis les headers de la requête
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  return "unknown"
}
