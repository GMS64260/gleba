import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), evolution: vi.fn(), create: vi.fn(), deleteMany: vi.fn(), count: vi.fn(), verrou: vi.fn(),
}))
vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.auth }))
vi.mock("@/lib/prisma", () => {
  const client = {
    evolution: { findUnique: mocks.evolution },
    evolutionVote: { create: mocks.create, deleteMany: mocks.deleteMany, count: mocks.count },
    $executeRaw: mocks.verrou,
    $transaction: (action: (tx: unknown) => unknown) => action(client),
  }
  return { default: client }
})
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

  it("ajoute le vote au nom de l'acteur, sous verrou", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 0 })
    expect(await (await voter()).json()).toEqual({ success: true, hasVoted: true, votes: 4 })
    expect(mocks.verrou).toHaveBeenCalledTimes(1)
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { evolutionId: "proposition-test", userId: "acteur-test" } })
    expect(mocks.create).toHaveBeenCalledWith({ data: { evolutionId: "proposition-test", userId: "acteur-test" } })
  })

  it("retire le vote existant sans en recréer un", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 1 })
    expect(await (await voter()).json()).toEqual({ success: true, hasVoted: false, votes: 4 })
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
