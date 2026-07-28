import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  animalFindFirst: vi.fn(),
  testCreate: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    animal: { findFirst: mocks.animalFindFirst },
    testSanteElevage: {
      create: mocks.testCreate,
      findMany: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { POST } from "./route"

function request(type: string) {
  return new NextRequest("http://localhost/api/elevage/tests-sante", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ animalId: 12, type }),
  })
}

describe("API tests de santé", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.animalFindFirst.mockResolvedValue({ id: 12 })
    mocks.testCreate.mockImplementation(async ({ data }) => ({ id: "test-1", ...data }))
  })

  it.each(["radio_osteochondrose", "aie", "bilan_sante"])(
    "accepte le type proposé par l'interface : %s",
    async (type) => {
      const response = await POST(request(type))
      expect(response.status).toBe(201)
      expect(mocks.testCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ type }),
      })
    },
  )

  it("refuse toujours un type inconnu", async () => {
    const response = await POST(request("type_invente"))
    expect(response.status).toBe(400)
    expect(mocks.testCreate).not.toHaveBeenCalled()
  })
})
