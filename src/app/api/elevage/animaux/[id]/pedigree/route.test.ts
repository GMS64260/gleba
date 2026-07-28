import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  animalFindFirst: vi.fn(),
  pedigreeFindFirst: vi.fn(),
  exploitationFindUnique: vi.fn(),
  genealogie: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    animal: { findFirst: mocks.animalFindFirst },
    pedigreeElevage: { findFirst: mocks.pedigreeFindFirst },
    exploitation: { findUnique: mocks.exploitationFindUnique },
  },
}))
vi.mock("@/lib/reproduction", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/reproduction")>()
  return { ...original, genealogie: mocks.genealogie }
})

import { GET } from "./route"

describe("pedigree PDF", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.animalFindFirst.mockResolvedValue({
      id: 12,
      nom: "Amande",
      identifiant: "FR0012",
      race: "Alpine",
      sexe: "femelle",
      dateNaissance: new Date("2024-01-02T00:00:00.000Z"),
      especeAnimale: { nom: "Chien", filiere: "compagnie" },
    })
    mocks.pedigreeFindFirst.mockResolvedValue(null)
    mocks.exploitationFindUnique.mockResolvedValue(null)
    mocks.genealogie.mockResolvedValue(null)
  })

  it("génère la synthèse sans sortir du tenant", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/elevage/animaux/12/pedigree"),
      { params: Promise.resolve({ id: "12" }) },
    )
    const bytes = new Uint8Array(await response.arrayBuffer())

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF")
    expect(mocks.animalFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 12, userId: "user-1" },
    }))
    expect(mocks.genealogie).toHaveBeenCalledWith(expect.anything(), 12, 3, "user-1")
  })

  it("retourne 404 lorsque l'animal n'appartient pas à l'utilisateur", async () => {
    mocks.animalFindFirst.mockResolvedValueOnce(null)

    const response = await GET(
      new NextRequest("http://localhost/api/elevage/animaux/12/pedigree"),
      { params: Promise.resolve({ id: "12" }) },
    )

    expect(response.status).toBe(404)
    expect(mocks.genealogie).not.toHaveBeenCalled()
  })
})
