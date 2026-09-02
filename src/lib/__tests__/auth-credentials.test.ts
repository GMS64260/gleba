/**
 * Connexion par mot de passe : l'adresse saisie est normalisée avant la
 * recherche du compte, comme à l'inscription. Latent constaté le 2026-09-02.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    account: { create: vi.fn() },
    loginLog: { create: vi.fn().mockResolvedValue({}) },
  },
}))
vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn(async (a: string, b: string) => a === b) },
}))

import prisma from "@/lib/prisma"
import { authorizeCredentials } from "@/lib/auth"
import { REFUS_CONNEXION } from "@/lib/auth-refus"

const mocked = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> }
  loginLog: { create: ReturnType<typeof vi.fn> }
}

const compte = {
  id: "u1",
  email: "jean.dupont@example.com",
  name: "Jean",
  role: "USER",
  active: true,
  emailVerified: true,
  password: "secret-hash",
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("authorizeCredentials — normalisation de l'adresse", () => {
  it("retrouve le compte malgré une majuscule initiale et des espaces", async () => {
    mocked.user.findUnique.mockResolvedValue(compte)
    const user = await authorizeCredentials({
      email: "  Jean.Dupont@Example.com ",
      password: "secret-hash",
    })
    expect(user).toMatchObject({ id: "u1", email: "jean.dupont@example.com" })
    expect(mocked.user.findUnique).toHaveBeenCalledWith({
      where: { email: "jean.dupont@example.com" },
    })
  })

  it("journalise l'adresse normalisée, pas la saisie brute", async () => {
    mocked.user.findUnique.mockResolvedValue(null)
    await expect(
      authorizeCredentials({ email: "Inconnu@Example.com", password: "x" })
    ).rejects.toMatchObject({ code: REFUS_CONNEXION.IDENTIFIANTS })
    // logLogin est fire-and-forget : laisser la microtâche s'exécuter
    await new Promise((r) => setTimeout(r, 0))
    const data = mocked.loginLog.create.mock.calls[0]?.[0]?.data
    expect(data).toMatchObject({ email: "inconnu@example.com", success: false, reason: "not_found" })
  })

  it("champs manquants : refus dédié, sans requête", async () => {
    await expect(authorizeCredentials({ email: "a@b.fr" })).rejects.toMatchObject({
      code: REFUS_CONNEXION.CHAMPS_MANQUANTS,
    })
    expect(mocked.user.findUnique).not.toHaveBeenCalled()
  })
})
