/**
 * POST /api/auth/change-password — le mot de passe de la démo est figé.
 *
 * Il est public (bouton « Essayer la démo ») : un visiteur qui le changeait
 * fermait la porte à tous les suivants jusqu'au prochain redémarrage.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({
  requireAuthApi: mocks.requireAuthApi,
  verifyPassword: mocks.verifyPassword,
  hashPassword: mocks.hashPassword,
}))
vi.mock("@/lib/prisma", () => ({
  default: { user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate } },
}))
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => null,
  getClientIP: () => "127.0.0.1",
}))

import { POST } from "./route"

// Corps exact envoyé par la section « Mot de passe » de l'écran Paramètres.
const requete = () =>
  new NextRequest("http://localhost/api/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword: "ancien-mot-de-passe", newPassword: "nouveau-mot-de-passe" }),
  })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({
    error: null,
    session: { user: { id: "u1", acteurId: "u1", email: "x@example.com", role: "USER" } },
  })
  mocks.verifyPassword.mockResolvedValue(true)
  mocks.hashPassword.mockResolvedValue("nouveau-hash")
})

describe("POST /api/auth/change-password", () => {
  it("refuse en 403 sur le compte de démonstration et n'écrit rien", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "u1", email: "demo@gleba.fr", password: "hash" })

    const res = await POST(requete())

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.code).toBe("COMPTE_DEMO")
    expect(json.error).toContain("mot de passe ne peut pas être changé")
    expect(mocks.userUpdate).not.toHaveBeenCalled()
  })

  it("change le mot de passe d'un compte réel comme avant", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "u1", email: "maraicher@example.com", password: "hash" })

    const res = await POST(requete())

    expect(res.status).toBe(200)
    expect(mocks.userUpdate).toHaveBeenCalledWith({ where: { id: "u1" }, data: { password: "nouveau-hash" } })
  })
})
