import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  fetchNappeInfo: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({
  requireAuthApi: mocks.requireAuthApi,
}))

vi.mock("@/lib/hubeau", () => ({
  fetchNappeInfo: mocks.fetchNappeInfo,
  RAYON_RECHERCHE_NAPPE_KM: 100,
}))

import { GET } from "./route"

function requete(url = "https://gleba.test/api/meteo/nappe?lat=43.6&lng=1.4") {
  return new Request(url) as never
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({
    error: null,
    session: { user: { id: "user-1" } },
  })
})

describe("GET /api/meteo/nappe", () => {
  it("dégrade un timeout Hub'Eau en indisponibilité temporaire sans erreur serveur", async () => {
    const timeout = new Error("The operation was aborted due to timeout")
    timeout.name = "TimeoutError"
    mocks.fetchNappeInfo.mockRejectedValue(timeout)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    const response = await GET(requete())

    await expect(response.json()).resolves.toEqual({
      error: "Données nappe temporairement indisponibles",
    })
    expect(response.status).toBe(503)
    expect(error).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(1)
    error.mockRestore()
    warn.mockRestore()
  })

  it("conserve le 500 et le journal d'erreur pour une vraie panne applicative", async () => {
    mocks.fetchNappeInfo.mockRejectedValue(new Error("réponse Hub'Eau invalide"))
    const error = vi.spyOn(console, "error").mockImplementation(() => {})

    const response = await GET(requete())

    expect(response.status).toBe(500)
    expect(error).toHaveBeenCalledTimes(1)
    error.mockRestore()
  })

  // Revue du 2026-11-11 : seule l'expiration du délai était dégradée ; une
  // réponse 502 de Hub'Eau ou une coupure réseau sortait en 500, que l'écran
  // ne sait pas présenter.
  it("dégrade une panne HTTP ou réseau de Hub'Eau en 503, sans erreur serveur", async () => {
    const panne = new Error("Hub'Eau stations API error: 502")
    panne.name = "HubEauIndisponibleError"
    mocks.fetchNappeInfo.mockRejectedValue(panne)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    const response = await GET(requete())

    expect(response.status).toBe(503)
    expect(error).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(1)
    error.mockRestore()
    warn.mockRestore()
  })

  it("sans station : 404, et le message cite le rayon réellement cherché", async () => {
    mocks.fetchNappeInfo.mockResolvedValue(null)

    const response = await GET(requete())

    expect(response.status).toBe(404)
    const corps = await response.json()
    expect(corps.error).toContain("100 km")
    expect(corps.error).not.toContain("50 km")
  })

  it("refuse des coordonnées qui ne sont pas des nombres", async () => {
    const response = await GET(requete("https://gleba.test/api/meteo/nappe?lat=43.6abc&lng=Infinity"))

    expect(response.status).toBe(400)
    expect(mocks.fetchNappeInfo).not.toHaveBeenCalled()
  })
})
