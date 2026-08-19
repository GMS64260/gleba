import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  parcelleFindFirst: vi.fn(),
  parcelleUpdate: vi.fn(),
  exploitationFindUnique: vi.fn(),
  exploitationUpdate: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({
  requireAuthApi: mocks.requireAuthApi,
  getUserId: () => "u1",
}))
vi.mock("@/lib/prisma", () => ({
  default: {
    parcelleGeo: { findFirst: mocks.parcelleFindFirst, update: mocks.parcelleUpdate },
    exploitation: { findUnique: mocks.exploitationFindUnique, update: mocks.exploitationUpdate },
  },
}))

import { POST } from "./route"

const PARIS = { id: "p1", nom: "Potager", centroidLat: 48.85675, centroidLng: 2.352 }

const request = (body: unknown) =>
  new Request("http://localhost/api/carte/localisation-exemple/recaler", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as never

const perigueux = { nom: "Périgueux", codePostal: "24000", lat: 45.192, lng: 0.7185 }

describe("POST /api/carte/localisation-exemple/recaler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u1" } } })
    mocks.parcelleFindFirst.mockResolvedValue(PARIS)
    mocks.parcelleUpdate.mockResolvedValue({ ...PARIS })
    mocks.exploitationFindUnique.mockResolvedValue({ codePostal: "", ville: "" })
  })

  it("recale la parcelle d'exemple sur la commune, en un appel", async () => {
    const res = await POST(request({ parcelleId: "p1", commune: perigueux }))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.success).toBe(true)
    expect(j.commune).toBe("Périgueux")
    // Zone climatique dérivée du code postal (Dordogne → océanique altéré).
    expect(j.zoneClimat).toBe("oceanique_altere")

    const maj = mocks.parcelleUpdate.mock.calls[0][0].data
    expect(maj.centroidLat).toBeCloseTo(45.192, 5)
    expect(maj.centroidLng).toBeCloseTo(0.7185, 5)
    expect(maj.commune).toBe("Périgueux")
    expect(maj.notes).toContain("centre de Périgueux")
    expect(JSON.parse(maj.geometry).type).toBe("Polygon")
  })

  it("complète le siège de l'exploitation quand il est vide", async () => {
    await POST(request({ parcelleId: "p1", commune: perigueux }))
    expect(mocks.exploitationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { codePostal: "24000", ville: "Périgueux" } }),
    )
  })

  it("n'écrase jamais un siège déjà saisi", async () => {
    mocks.exploitationFindUnique.mockResolvedValue({ codePostal: "64000", ville: "Pau" })
    await POST(request({ parcelleId: "p1", commune: perigueux }))
    expect(mocks.exploitationUpdate).not.toHaveBeenCalled()
  })

  // Garde essentielle : recaler une parcelle déjà positionnée détruirait le
  // travail cartographique de l'utilisateur.
  it("refuse une parcelle qui n'est plus à l'emplacement d'exemple", async () => {
    mocks.parcelleFindFirst.mockResolvedValue({ ...PARIS, centroidLat: 45.1, centroidLng: 0.7 })
    const res = await POST(request({ parcelleId: "p1", commune: perigueux }))
    expect(res.status).toBe(409)
    expect(mocks.parcelleUpdate).not.toHaveBeenCalled()
  })

  it("refuse une parcelle qui n'appartient pas au demandeur", async () => {
    mocks.parcelleFindFirst.mockResolvedValue(null)
    const res = await POST(request({ parcelleId: "autre", commune: perigueux }))
    expect(res.status).toBe(404)
    expect(mocks.parcelleUpdate).not.toHaveBeenCalled()
  })

  it("refuse des coordonnées invalides", async () => {
    const res = await POST(request({ parcelleId: "p1", commune: { ...perigueux, lat: 0, lng: 0 } }))
    expect(res.status).toBe(400)
    expect(mocks.parcelleUpdate).not.toHaveBeenCalled()
  })
})
