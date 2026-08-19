/**
 * Protection du compte démo dans l'adapter Auth.js : la session démo est
 * invisible pour la résolution OAuth (getUser → null) et aucune identité
 * OAuth ne peut être rattachée au compte démo (linkAccount → refus).
 * Régression de l'incident du 2026-07-31 (identité Google d'un visiteur
 * liée au compte démo pendant une session démo active).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    account: { create: vi.fn() },
    loginLog: { create: vi.fn() },
  },
}))

import prisma from "@/lib/prisma"
import { glebaAdapter } from "@/lib/auth"

const mocked = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> }
  account: { create: ReturnType<typeof vi.fn> }
}

const DEMO_ID = "demo-user-id"
const demoRow = {
  id: DEMO_ID,
  email: "demo@gleba.fr",
  name: "Ferme du Bois Joli",
  emailVerified: true,
}
const membreRow = {
  id: "membre-id",
  email: "membre@example.com",
  name: "Membre",
  emailVerified: true,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("glebaAdapter — protection du compte démo", () => {
  it("getUser renvoie null pour le compte démo (session démo ignorée au callback OAuth)", async () => {
    mocked.user.findUnique.mockResolvedValue(demoRow)
    const adapter = glebaAdapter()
    expect(await adapter.getUser!(DEMO_ID)).toBeNull()
  })

  it("getUser renvoie les autres utilisateurs normalement", async () => {
    mocked.user.findUnique.mockResolvedValue(membreRow)
    const adapter = glebaAdapter()
    const user = await adapter.getUser!("membre-id")
    expect(user?.email).toBe("membre@example.com")
    expect(user?.emailVerified).toBeInstanceOf(Date)
  })

  it("linkAccount refuse de lier une identité OAuth au compte démo", async () => {
    mocked.user.findUnique.mockResolvedValue({ email: "demo@gleba.fr" })
    const adapter = glebaAdapter()
    await expect(
      adapter.linkAccount!({
        userId: DEMO_ID,
        type: "oidc",
        provider: "google",
        providerAccountId: "123",
      })
    ).rejects.toThrow(/démonstration/)
    expect(mocked.account.create).not.toHaveBeenCalled()
  })

  it("linkAccount lie normalement pour un autre utilisateur", async () => {
    mocked.user.findUnique.mockResolvedValue({ email: "membre@example.com" })
    mocked.account.create.mockResolvedValue({})
    const adapter = glebaAdapter()
    await adapter.linkAccount!({
      userId: "membre-id",
      type: "oidc",
      provider: "google",
      providerAccountId: "456",
    })
    expect(mocked.account.create).toHaveBeenCalledOnce()
  })
})
