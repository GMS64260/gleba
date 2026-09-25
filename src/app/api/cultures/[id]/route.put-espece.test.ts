import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  cultureFindUnique: vi.fn(),
  cultureUpdate: vi.fn(),
  varieteFindFirst: vi.fn(),
  itpFindFirst: vi.fn(),
  itpFindUnique: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({
  requireAuthApi: mocks.requireAuthApi,
  getUserId: () => "user-1",
}))
vi.mock("@/lib/prisma", () => ({
  default: {
    culture: { findUnique: mocks.cultureFindUnique, update: mocks.cultureUpdate },
    variete: { findFirst: mocks.varieteFindFirst },
    iTP: { findFirst: mocks.itpFindFirst, findUnique: mocks.itpFindUnique },
  },
}))
vi.mock("@/lib/irrigation-cache", () => ({ irrigationCache: { invalidateUser: vi.fn() } }))
vi.mock("@/lib/irrigation-scheduler", () => ({ etendrePlanArrosage: vi.fn() }))
vi.mock("@/lib/kpi", () => ({ invalidateKpi: vi.fn() }))

import { PUT } from "./route"

const params = Promise.resolve({ id: "1121" })

function put(body: Record<string, unknown>) {
  return PUT(
    new NextRequest("http://localhost/api/cultures/1121", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params }
  )
}

// Signalement 2026-09-25 : une culture de roquette passée en « Navet » gardait
// la variété « Roquette — Non spécifiée » et l'itinéraire de la roquette.
const roquette = {
  id: 1121,
  userId: "user-1",
  especeId: "Roquette",
  varieteId: "Roquette — Non spécifiée",
  itpId: "INRAE-MESCLUN-0484",
  plancheId: null,
  longueur: null,
  semisFait: false,
  plantationFaite: false,
  recolteFaite: false,
  dateSemis: null,
  datePlantation: null,
  dateRecolte: null,
}

describe("PUT /api/cultures/[id] — espèce, variété et ITP cohérents", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } })
    mocks.cultureFindUnique.mockResolvedValue(roquette)
    mocks.cultureUpdate.mockImplementation(async ({ data }) => ({ ...roquette, ...data, aIrriguer: false }))
    mocks.itpFindFirst.mockResolvedValue({ id: "x" })
  })

  it("refuse de changer l'espèce en gardant la variété de l'ancienne", async () => {
    mocks.varieteFindFirst.mockResolvedValue(null)

    const res = await put({ especeId: "Navet", varieteId: "Roquette — Non spécifiée" })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain("n'est pas disponible pour l'espèce « Navet »")
    expect(mocks.varieteFindFirst.mock.calls[0][0].where.AND[0]).toEqual({
      id: "Roquette — Non spécifiée",
      especeId: "Navet",
    })
    expect(mocks.cultureUpdate).not.toHaveBeenCalled()
  })

  it("refuse de changer l'espèce en gardant l'itinéraire de l'ancienne", async () => {
    mocks.itpFindUnique.mockResolvedValue({ especeId: "Roquette" })

    const res = await put({ especeId: "Navet", varieteId: null })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain("prévu pour l'espèce « Roquette », pas pour « Navet »")
    expect(mocks.cultureUpdate).not.toHaveBeenCalled()
  })

  it("accepte le changement d'espèce quand la variété et l'ITP suivent", async () => {
    mocks.varieteFindFirst.mockResolvedValue({ id: "Navet de Milan" })
    mocks.itpFindUnique.mockResolvedValue({ especeId: "Navet" })

    const res = await put({ especeId: "Navet", varieteId: "Navet de Milan", itpId: "ITP-NAVET" })

    expect(res.status).toBe(200)
    expect(mocks.cultureUpdate).toHaveBeenCalledTimes(1)
  })

  it("ne bloque pas une fiche qu'on modifie sans toucher à l'espèce ni aux références", async () => {
    const res = await put({ especeId: "Roquette", varieteId: "Roquette — Non spécifiée", notes: "arrosée" })

    expect(res.status).toBe(200)
    expect(mocks.varieteFindFirst).not.toHaveBeenCalled()
    expect(mocks.itpFindUnique).not.toHaveBeenCalled()
  })
})
