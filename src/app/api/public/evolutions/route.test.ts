import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ default: { evolution: { findMany: mocks.findMany } } }))
import { GET } from "./route"

describe("identité publique des propositions", () => {
  beforeEach(() => vi.clearAllMocks())

  it("n'utilise jamais l'adresse comme signature si le nom manque", async () => {
    mocks.findMany.mockResolvedValue([{
      id: "proposition-test", titre: "Une proposition", description: "Un besoin produit",
      categorie: "GENERAL", statut: "PROPOSEE", adminNote: null,
      createdAt: new Date("2026-10-26T12:00:00Z"),
      user: { name: null, email: "identite-privee@example.invalid" }, _count: { votes: 2 },
    }])
    const response = await GET()
    const data = await response.json()
    expect(data.evolutions[0].author).toEqual({ id: "", name: "Membre de Gleba", isMe: false })
    expect(JSON.stringify(data)).not.toContain("identite-privee")
    expect(mocks.findMany.mock.calls[0][0].include.user.select).toEqual({ name: true })
  })
})
