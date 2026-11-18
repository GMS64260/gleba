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
    expect(data.evolutions[0].author).toEqual({ name: "Contributeur", isMe: false })
    expect(JSON.stringify(data)).not.toContain("identite-privee")
    expect(mocks.findMany.mock.calls[0][0].include.user.select).toEqual({ name: true })
  })

  it.each(["", "  ", "Éleveuse du test"])("applique la même signature aux visiteurs pour %j", async (name) => {
    mocks.findMany.mockResolvedValue([{
      id: "proposition-test", titre: "Une proposition", description: "Un besoin produit",
      categorie: "GENERAL", statut: "PROPOSEE", adminNote: null,
      createdAt: new Date("2026-11-18T12:00:00Z"),
      user: { name }, _count: { votes: 2 },
    }])
    const data = await (await GET()).json()
    expect(data.evolutions[0].author).toEqual({ name: name.trim() ? name : "Contributeur", isMe: false })
  })
})
