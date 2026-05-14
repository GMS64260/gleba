/**
 * DEV1 Ticket 2 — Tests du fetchWithRetry (cold start 503 mitigation).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { fetchWithRetry } from "../fetch-retry"

describe("fetchWithRetry", () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    // Tests rapides : on neutralise les délais (les setTimeout sont mockables
    // via vi.useFakeTimers mais ici on accepte le ~0.5s pour 3 retries).
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("retourne la première réponse OK sans retry", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }))
    globalThis.fetch = mockFetch as typeof globalThis.fetch
    const res = await fetchWithRetry("/api/test")
    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("retry sur 503 puis succès au 2e essai", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("cold", { status: 503 }))
      .mockResolvedValueOnce(new Response("warm", { status: 200 }))
    globalThis.fetch = mockFetch as typeof globalThis.fetch
    const res = await fetchWithRetry("/api/test", { baseDelayMs: 1 })
    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it("retry sur 502/504/429 aussi", async () => {
    for (const status of [502, 504, 429]) {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(new Response("", { status }))
        .mockResolvedValueOnce(new Response("ok", { status: 200 }))
      globalThis.fetch = mockFetch as typeof globalThis.fetch
      const res = await fetchWithRetry("/api/test", { baseDelayMs: 1 })
      expect(res.status).toBe(200)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    }
  })

  it("ne retry PAS sur 4xx hors 429 (erreurs client définitives)", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("bad", { status: 400 }))
    globalThis.fetch = mockFetch as typeof globalThis.fetch
    const res = await fetchWithRetry("/api/test", { baseDelayMs: 1 })
    expect(res.status).toBe(400)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("ne retry PAS sur 500 (erreur serveur définitive, non transitoire)", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("err", { status: 500 }))
    globalThis.fetch = mockFetch as typeof globalThis.fetch
    const res = await fetchWithRetry("/api/test", { baseDelayMs: 1 })
    expect(res.status).toBe(500)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("retourne le dernier 503 après 3 tentatives ratées", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("cold", { status: 503 }))
    globalThis.fetch = mockFetch as typeof globalThis.fetch
    const res = await fetchWithRetry("/api/test", { baseDelayMs: 1 })
    expect(res.status).toBe(503)
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it("retry sur erreur réseau (fetch rejette)", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }))
    globalThis.fetch = mockFetch as typeof globalThis.fetch
    const res = await fetchWithRetry("/api/test", { baseDelayMs: 1 })
    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it("throw si toutes tentatives en erreur réseau", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    globalThis.fetch = mockFetch as typeof globalThis.fetch
    await expect(fetchWithRetry("/api/test", { baseDelayMs: 1 })).rejects.toThrow()
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it("appelle onRetry à chaque retry", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response("", { status: 504 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }))
    globalThis.fetch = mockFetch as typeof globalThis.fetch
    const onRetry = vi.fn()
    await fetchWithRetry("/api/test", { baseDelayMs: 1, onRetry })
    expect(onRetry).toHaveBeenCalledTimes(2) // 2 retries entre les 3 essais
    expect(onRetry.mock.calls[0][0]).toBe(1)
    expect(onRetry.mock.calls[1][0]).toBe(2)
  })

  it("respecte le paramètre retries personnalisé", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("", { status: 503 }))
    globalThis.fetch = mockFetch as typeof globalThis.fetch
    await fetchWithRetry("/api/test", { baseDelayMs: 1, retries: 5 })
    expect(mockFetch).toHaveBeenCalledTimes(5)
  })
})
