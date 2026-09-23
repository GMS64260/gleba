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
})
