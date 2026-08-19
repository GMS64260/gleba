import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  arbreFindUnique: vi.fn(),
  arbreUpdate: vi.fn(),
  parcelleFindFirst: vi.fn(),
  parcelleFindMany: vi.fn(),
  lotArbresFindFirst: vi.fn(),
  recolteFindMany: vi.fn(),
  boisFindMany: vi.fn(),
  interventionFindMany: vi.fn(),
  txVenteDeleteMany: vi.fn(),
  txBoisUpdate: vi.fn(),
  txInterventionUpdate: vi.fn(),
  txInterventionCreate: vi.fn(),
  txObservationFindMany: vi.fn(),
  txOperationFindMany: vi.fn(),
  txArbreDelete: vi.fn(),
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
    recolteArbre: { findMany: mocks.recolteFindMany },
    productionBois: { findMany: mocks.boisFindMany },
    intervention: { findMany: mocks.interventionFindMany },
    $transaction: (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        venteManuelle: { deleteMany: mocks.txVenteDeleteMany },
        productionBois: { update: mocks.txBoisUpdate },
        intervention: {
          update: mocks.txInterventionUpdate,
          create: mocks.txInterventionCreate,
        },
        observationSante: { findMany: mocks.txObservationFindMany },
        operationArbre: { findMany: mocks.txOperationFindMany },
        arbre: { delete: mocks.txArbreDelete },
      }),
  },
}))

import { DELETE, PUT } from "./route"

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

// QA cmsofhlzg — Intervention.arbreId est une colonne sans FK : la
// suppression d'un arbre laissait ses traitements phyto « orphelins »
// (registre : « Arbre #587 »). Le registre phyto est une traçabilité
// réglementaire : les interventions sont conservées, détachées de l'arbre
// avec un snapshot de son identité dans les notes.
describe("DELETE /api/arbres/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.arbreFindUnique.mockResolvedValue({
      id: 42,
      userId: "user-1",
      nom: "Pêcher du fond",
      espece: "Pêcher",
    })
    mocks.recolteFindMany.mockResolvedValue([])
    mocks.boisFindMany.mockResolvedValue([])
    mocks.interventionFindMany.mockResolvedValue([])
    mocks.txObservationFindMany.mockResolvedValue([])
    mocks.txOperationFindMany.mockResolvedValue([])
    mocks.txInterventionCreate.mockResolvedValue({ id: 900 })
    mocks.txArbreDelete.mockResolvedValue({ id: 42 })
  })

  const deleteRequest = () =>
    new Request("http://localhost/api/arbres/42", { method: "DELETE" })

  it("détache les interventions phyto en snapshotant le nom de l'arbre", async () => {
    mocks.interventionFindMany.mockResolvedValue([
      { id: 77, notes: "Vent faible" },
      { id: 78, notes: null },
    ])

    const response = await DELETE(deleteRequest() as never, params)

    expect(response.status).toBe(200)
    expect(mocks.interventionFindMany).toHaveBeenCalledWith({
      where: { arbreId: 42, userId: "user-1" },
      select: { id: true, notes: true },
    })
    // Jamais de suppression : détachement + snapshot en tête de notes.
    expect(mocks.txInterventionUpdate).toHaveBeenCalledTimes(2)
    expect(mocks.txInterventionUpdate).toHaveBeenCalledWith({
      where: { id: 77 },
      data: {
        arbreId: null,
        notes: "[Arbre supprimé : Pêcher du fond (Pêcher)]\nVent faible",
      },
    })
    expect(mocks.txInterventionUpdate).toHaveBeenCalledWith({
      where: { id: 78 },
      data: {
        arbreId: null,
        notes: "[Arbre supprimé : Pêcher du fond (Pêcher)]",
      },
    })
    expect(mocks.txArbreDelete).toHaveBeenCalledWith({ where: { id: 42 } })
  })

  // QA cmswxinhf — les traitements saisis via Verger > Santé & Phyto vivent dans
  // `observations_sante`, dont `arbre_id` est obligatoire et en cascade : un
  // traitement complet (AMM, dose, DAR, ZNT) disparaissait du registre
  // phytosanitaire avec l'arbre. Il est désormais versé au registre.
  it("verse au registre les traitements saisis en observation de santé", async () => {
    mocks.txObservationFindMany.mockResolvedValue([
      {
        id: 7,
        date: new Date("2026-08-17T08:00:00Z"),
        produit: "Bouillie QA",
        numAMM: "AMM-QA-2026-V7B",
        diagnostic: "Tavelure",
        symptome: null,
        traitement: "Rattrapage",
        doseAppliquee: 0.5,
        uniteDose: "L/ha",
        dar: 7,
        zntDistanceM: 20,
        zntRespectee: true,
        surfaceTraiteeHa: null,
        volumeBouillieLHa: null,
        volumeBouillieLTotal: null,
        temperatureC: null,
        ventKmh: null,
        hygrometriePct: null,
        pluie24h: null,
        pluie24hMm: null,
        epiPortes: [],
        parcelleId: null,
        operateurId: null,
        certiphytoNum: null,
        notes: null,
      },
    ])

    const response = await DELETE(deleteRequest() as never, params)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      tracesPhytoConservees: { observations: 1, operations: 0 },
    })
    expect(mocks.txInterventionCreate).toHaveBeenCalledTimes(1)
    const trace = mocks.txInterventionCreate.mock.calls[0][0].data
    expect(trace.type).toBe("traitement_phyto")
    expect(trace.arbreId).toBeNull()
    expect(trace.numAMM).toBe("AMM-QA-2026-V7B")
    expect(trace.dar).toBe(7)
    expect(trace.zntDistanceM).toBe(20)
    expect(trace.notes).toBe("[Arbre supprimé : Pêcher du fond (Pêcher)]")
    expect(mocks.txArbreDelete).toHaveBeenCalledWith({ where: { id: 42 } })
  })

  it("supprime sans toucher aux interventions quand l'arbre n'en a pas", async () => {
    const response = await DELETE(deleteRequest() as never, params)

    expect(response.status).toBe(200)
    expect(mocks.txInterventionUpdate).not.toHaveBeenCalled()
    expect(mocks.txArbreDelete).toHaveBeenCalledWith({ where: { id: 42 } })
  })

  it("refuse la suppression si des récoltes sont facturées", async () => {
    mocks.recolteFindMany.mockResolvedValue([{ id: 1, factureId: 9 }])

    const response = await DELETE(deleteRequest() as never, params)

    expect(response.status).toBe(409)
    expect(mocks.txArbreDelete).not.toHaveBeenCalled()
  })
})
