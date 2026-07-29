import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  arbreFindFirst: vi.fn(),
  operationCreate: vi.fn(),
  createDepense: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    arbre: { findFirst: mocks.arbreFindFirst },
    operationArbre: { create: mocks.operationCreate },
  },
}))
vi.mock("@/lib/auto-compta", () => ({
  createDepenseFromOperationArbre: mocks.createDepense,
}))

import { POST } from "./route"

const request = (body: unknown) =>
  new Request("http://localhost/api/arbres/operations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })

describe("POST /api/arbres/operations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.arbreFindFirst.mockResolvedValue({ id: 42, userId: "user-1" })
    mocks.operationCreate.mockImplementation(async ({ data }) => ({
      id: 1,
      ...data,
      arbre: { id: 42, nom: "Pommier", type: "fruitier" },
    }))
  })

  it("refuse une opération à faire sans date prévue", async () => {
    const response = await POST(request({
      arbreId: 42,
      type: "taille",
      fait: false,
      date: "2026-07-29",
    }) as never)

    expect(response.status).toBe(400)
    expect(mocks.operationCreate).not.toHaveBeenCalled()
  })

  it("conserve la date prévue comme date métier d'une opération à faire", async () => {
    const response = await POST(request({
      arbreId: 42,
      type: "taille",
      fait: false,
      date: "2026-07-29",
      datePrevue: "2026-08-18",
    }) as never)

    expect(response.status).toBe(201)
    expect(mocks.operationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        fait: false,
        date: new Date("2026-08-18"),
        datePrevue: new Date("2026-08-18"),
      }),
    }))
  })
})
