import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ userFindUnique: vi.fn() }))

vi.mock("@/lib/prisma", () => ({
  default: { user: { findUnique: mocks.userFindUnique } },
}))

import { MESSAGES_REFUS_DEMO, estCompteDemo, refusSiCompteDemo } from "@/lib/demo-garde"

beforeEach(() => vi.clearAllMocks())

describe("refusSiCompteDemo", () => {
  it("refuse en 403 le compte de démonstration, avec le message du geste", async () => {
    mocks.userFindUnique.mockResolvedValue({ email: "demo@gleba.fr" })

    const refus = await refusSiCompteDemo("u-demo", MESSAGES_REFUS_DEMO.viderDonnees)

    expect(refus?.status).toBe(403)
    expect(await refus?.json()).toEqual({ error: MESSAGES_REFUS_DEMO.viderDonnees, code: "COMPTE_DEMO" })
    expect(mocks.userFindUnique).toHaveBeenCalledWith({ where: { id: "u-demo" }, select: { email: true } })
  })

  it("laisse passer un compte réel et un compte introuvable", async () => {
    mocks.userFindUnique.mockResolvedValueOnce({ email: "maraicher@example.com" }).mockResolvedValueOnce(null)

    expect(await refusSiCompteDemo("u1", MESSAGES_REFUS_DEMO.importer)).toBeNull()
    expect(await estCompteDemo("absent")).toBe(false)
  })

  it("chaque message nomme la démo et propose de créer un compte", () => {
    for (const message of Object.values(MESSAGES_REFUS_DEMO)) {
      expect(message).toContain("compte de démonstration")
      expect(message).toContain("Créez un compte gratuit")
      expect(message).not.toContain("—")
    }
  })
})
