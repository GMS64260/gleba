import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  arbreFindUnique: vi.fn(),
  arbreUpdate: vi.fn(),
  parcelleFindFirst: vi.fn(),
  parcelleFindMany: vi.fn(),
  lotArbresFindFirst: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    arbre: {
      findUnique: mocks.arbreFindUnique,
      update: mocks.arbreUpdate,
    },
    parcelleGeo: {
      findFirst: mocks.parcelleFindFirst,
      findMany: mocks.parcelleFindMany,
    },
    lotArbres: { findFirst: mocks.lotArbresFindFirst },
  },
}))

import { PUT } from "./route"

const request = (body: unknown) =>
  new Request("http://localhost/api/arbres/42", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })

const params = { params: Promise.resolve({ id: "42" }) }

describe("PUT /api/arbres/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.arbreFindUnique.mockResolvedValue({
      id: 42,
      userId: "user-1",
      espece: "Pêcher",
      parcelleGeoId: null,
    })
    mocks.parcelleFindFirst.mockResolvedValue({ id: "parcelle-1" })
    mocks.parcelleFindMany.mockResolvedValue([])
    mocks.lotArbresFindFirst.mockResolvedValue(null)
    mocks.arbreUpdate.mockResolvedValue({
      id: 42,
      nom: "Pêcher",
      espece: "Pêcher",
      parcelleGeoId: "parcelle-1",
    })
  })

  it("rattache a posteriori un arbre à une parcelle du compte", async () => {
    const response = await PUT(
      request({ parcelleGeoId: "parcelle-1" }) as never,
      params
    )

    expect(response.status).toBe(200)
    expect(mocks.parcelleFindFirst).toHaveBeenCalledWith({
      where: { id: "parcelle-1", userId: "user-1" },
    })
    expect(mocks.arbreUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 42 },
        data: expect.objectContaining({ parcelleGeoId: "parcelle-1" }),
      })
    )
  })

  it("permet de retirer le rattachement existant", async () => {
    mocks.arbreFindUnique.mockResolvedValue({
      id: 42,
      userId: "user-1",
      espece: "Pêcher",
      parcelleGeoId: "parcelle-1",
    })
    mocks.arbreUpdate.mockResolvedValue({
      id: 42,
      nom: "Pêcher",
      parcelleGeoId: null,
    })

    const response = await PUT(request({ parcelleGeoId: null }) as never, params)

    expect(response.status).toBe(200)
    expect(mocks.parcelleFindFirst).not.toHaveBeenCalled()
    expect(mocks.arbreUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parcelleGeoId: null }),
      })
    )
  })

  it("refuse une parcelle qui n’appartient pas au compte", async () => {
    mocks.parcelleFindFirst.mockResolvedValue(null)

    const response = await PUT(
      request({ parcelleGeoId: "parcelle-etrangere" }) as never,
      params
    )

    expect(response.status).toBe(404)
    expect(mocks.arbreUpdate).not.toHaveBeenCalled()
  })

  it("refuse le doublon avec un lot agrégé de la même espèce", async () => {
    mocks.lotArbresFindFirst.mockResolvedValue({ id: 8 })

    const response = await PUT(
      request({ parcelleGeoId: "parcelle-1" }) as never,
      params
    )

    expect(response.status).toBe(409)
    expect(mocks.lotArbresFindFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        parcelleGeoId: "parcelle-1",
        espece: { equals: "Pêcher", mode: "insensitive" },
      },
      select: { id: true },
    })
    expect(mocks.arbreUpdate).not.toHaveBeenCalled()
  })

  it("rattache un relevé GPS à la parcelle proche quand l'arbre était non assigné", async () => {
    mocks.arbreFindUnique.mockResolvedValue({
      id: 42,
      userId: "user-1",
      espece: "Asiminier",
      parcelleGeoId: null,
      gpsLat: null,
      gpsLng: null,
    })
    mocks.parcelleFindMany.mockResolvedValue([
      {
        id: "jardin",
        geometry: JSON.stringify({
          type: "Polygon",
          coordinates: [[
            [-0.332, 43.112],
            [-0.331, 43.112],
            [-0.331, 43.113],
            [-0.332, 43.113],
            [-0.332, 43.112],
          ]],
        }),
      },
    ])

    const response = await PUT(
      request({ gpsLat: 43.1122, gpsLng: -0.3314 }) as never,
      params
    )

    expect(response.status).toBe(200)
    expect(mocks.arbreUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          gpsLat: 43.1122,
          gpsLng: -0.3314,
          parcelleGeoId: "jardin",
        }),
      })
    )
  })

  it("enregistre atomiquement le déplacement 2D et les nouvelles coordonnées GPS", async () => {
    mocks.arbreFindUnique.mockResolvedValue({
      id: 42,
      userId: "user-1",
      espece: "Asiminier",
      parcelleGeoId: "jardin",
      gpsLat: 43.112246,
      gpsLng: -0.331275,
    })

    const response = await PUT(
      request({
        posX: 41.2,
        posY: 7.4,
        gpsLat: 43.1122513,
        gpsLng: -0.3312817,
      }) as never,
      params
    )

    expect(response.status).toBe(200)
    expect(mocks.arbreUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          posX: 41.2,
          posY: 7.4,
          gpsLat: 43.1122513,
          gpsLng: -0.3312817,
        }),
      })
    )
  })
})
