import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  updateMany: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: { planche: { updateMany: mocks.updateMany }, $transaction: mocks.transaction },
}))

import { PUT } from "./route"

const deplacer = (updates: unknown) =>
  PUT(
    new NextRequest("http://localhost/api/maraichage/planches/bulk-position", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    })
  )

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "exploitation-1" } } })
  mocks.updateMany.mockImplementation((args: unknown) => args)
  mocks.transaction.mockImplementation(async (ops: unknown[]) => ops.map(() => ({ count: 1 })))
})

describe("PUT /api/maraichage/planches/bulk-position", () => {
  it("écrit les coordonnées reçues, bornées à l'exploitation", async () => {
    const res = await deplacer([{ id: "p1", posX: 12.5, posY: "-3", rotation2D: 90 }])
    expect(res.status).toBe(200)
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", userId: "exploitation-1" },
      data: { posX: 12.5, posY: -3, rotation2D: 90 },
    })
  })

  // Revue du 2026-11-11 : `z.coerce.number()` lisait null, '' et false comme 0,
  // et la planche partait à l'origine du plan sans erreur.
  it("refuse une coordonnée nulle, vide ou non numérique au lieu d'écrire 0", async () => {
    for (const valeur of [null, "", "   ", false, true, "abc", []]) {
      const res = await deplacer([{ id: "p1", posX: valeur }])
      expect(res.status).toBe(400)
    }
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })
})
