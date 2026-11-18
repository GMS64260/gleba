import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ auth: vi.fn(), etat: vi.fn() }))
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/compte-actif", () => ({ lireEtatSession: mocks.etat }))

import { GET } from "./route"

describe("GET /api/session-etat (MC3)", () => {
  beforeEach(() => vi.clearAllMocks())

  it("relit la session avec sa version et la dit caduque après un changement de mot de passe", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1", impersonatedBy: null, sessionVersion: 0 } })
    mocks.etat.mockResolvedValue({ actif: false, motif: "session_revoquee" })
    const res = await GET()
    expect(mocks.etat).toHaveBeenCalledWith({ id: "u1", impersonatedBy: null, sessionVersion: 0 })
    expect(await res.json()).toEqual({ valide: false })
    expect(res.headers.get("cache-control")).toBe("no-store")
  })

  it("dit valide une session à jour", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1", impersonatedBy: "a1", sessionVersion: 2, adminSessionVersion: 4 } })
    mocks.etat.mockResolvedValue({ actif: true, role: "USER" })
    expect(await (await GET()).json()).toEqual({ valide: true })
    expect(mocks.etat).toHaveBeenCalledWith({ id: "u1", impersonatedBy: "a1", sessionVersion: 2, adminSessionVersion: 4 })
  })

  it("sans session : non valide, sans lecture en base", async () => {
    mocks.auth.mockResolvedValue(null)
    expect(await (await GET()).json()).toEqual({ valide: false })
    expect(mocks.etat).not.toHaveBeenCalled()
  })

  it("une panne de lecture ne rend pas « non valide » (pas de déconnexion sur erreur)", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1", impersonatedBy: null, sessionVersion: 0 } })
    mocks.etat.mockRejectedValue(new Error("base injoignable"))
    await expect(GET()).rejects.toThrow("base injoignable")
  })
})
