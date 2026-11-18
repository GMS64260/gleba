import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), evolution: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn(),
}))
vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.auth }))
vi.mock("@/lib/prisma", () => ({ default: {
  evolution: { findUnique: mocks.evolution },
  evolutionVote: { findUnique: mocks.findUnique, create: mocks.create, delete: mocks.delete, count: mocks.count },
} }))
import { POST } from "./route"

const voter = () => POST(new Request("https://gleba.example/api/evolutions/proposition-test/vote", { method: "POST" }), {
  params: Promise.resolve({ id: "proposition-test" }),
})

describe("vote sur les évolutions : contrat conservé", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ error: null, session: { user: { id: "tenant-test", acteurId: "acteur-test" } } })
    mocks.evolution.mockResolvedValue({ id: "proposition-test" })
    mocks.count.mockResolvedValue(4)
  })

  it("ajoute le vote au nom de l'acteur", async () => {
    mocks.findUnique.mockResolvedValue(null)
    expect(await (await voter()).json()).toEqual({ success: true, hasVoted: true, votes: 4 })
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { evolutionId_userId: { evolutionId: "proposition-test", userId: "acteur-test" } }, select: { id: true },
    })
    expect(mocks.create).toHaveBeenCalledWith({ data: { evolutionId: "proposition-test", userId: "acteur-test" } })
    expect(mocks.delete).not.toHaveBeenCalled()
  })

  it("retire le vote existant", async () => {
    mocks.findUnique.mockResolvedValue({ id: "vote-test" })
    expect(await (await voter()).json()).toEqual({ success: true, hasVoted: false, votes: 4 })
    expect(mocks.delete).toHaveBeenCalledWith({ where: { id: "vote-test" } })
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
