import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  exploitationFindUnique: vi.fn(),
  exploitationCreate: vi.fn(),
  exploitationUpdate: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  parcelleFindMany: vi.fn(),
  parcelleFindFirst: vi.fn(),
  parcelleCreate: vi.fn(),
  parcelleUpdate: vi.fn(),
  plancheCount: vi.fn(),
  plancheCreate: vi.fn(),
  arbreCount: vi.fn(),
  arbreCreate: vi.fn(),
  especeFindFirst: vi.fn(),
  lotCount: vi.fn(),
  lotCreate: vi.fn(),
  cultureCount: vi.fn(),
  prefFindUnique: vi.fn(),
  createSampleDataForUser: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/user-sample-data", () => ({
  createSampleDataForUser: mocks.createSampleDataForUser,
}))
vi.mock("@/lib/prisma", () => {
  const client = {
    exploitation: {
      findUnique: mocks.exploitationFindUnique,
      create: mocks.exploitationCreate,
      update: mocks.exploitationUpdate,
    },
    user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate },
    parcelleGeo: {
      findMany: mocks.parcelleFindMany,
      findFirst: mocks.parcelleFindFirst,
      create: mocks.parcelleCreate,
      update: mocks.parcelleUpdate,
    },
    planche: { count: mocks.plancheCount, create: mocks.plancheCreate },
    arbre: { count: mocks.arbreCount, create: mocks.arbreCreate },
    espece: { findFirst: mocks.especeFindFirst },
    lotAnimaux: { count: mocks.lotCount, create: mocks.lotCreate },
    culture: { count: mocks.cultureCount },
    userPreference: { findUnique: mocks.prefFindUnique },
    $transaction: (cb: (tx: unknown) => Promise<unknown>) => cb(client),
  }
  return { default: client }
})

import { POST } from "./route"

const request = (body: unknown) =>
  new Request("http://localhost/api/onboarding/configurer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as never

describe("POST /api/onboarding/configurer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u1" } } })
    mocks.exploitationFindUnique.mockResolvedValue(null)
    mocks.userFindUnique.mockResolvedValue({ name: "Juliana", email: "j@x.fr" })
    mocks.parcelleFindMany.mockResolvedValue([])
    mocks.parcelleFindFirst.mockResolvedValue(null)
    mocks.parcelleCreate.mockResolvedValue({ id: "parc-1", nom: "Mon exploitation" })
    mocks.plancheCount.mockResolvedValue(0)
    mocks.plancheCreate.mockImplementation(async ({ data }: { data: { nom: string } }) => ({ id: "pl-1", nom: data.nom }))
    mocks.arbreCount.mockResolvedValue(0)
    mocks.especeFindFirst.mockResolvedValue(null)
    mocks.arbreCreate.mockImplementation(async ({ data }: { data: { nom: string } }) => ({ id: 7, nom: data.nom }))
    mocks.lotCount.mockResolvedValue(0)
    mocks.lotCreate.mockImplementation(async ({ data }: { data: { nom: string } }) => ({ id: 3, nom: data.nom }))
    mocks.cultureCount.mockResolvedValue(0)
    mocks.prefFindUnique.mockResolvedValue({ value: JSON.stringify(["maraichage", "verger"]) })
  })

  it("crée l'exploitation minimale et la parcelle au centre de la commune", async () => {
    const res = await POST(
      request({
        etape: "exploitation",
        nomExploitation: "Ferme des Trois Chênes",
        commune: { nom: "Périgueux", codePostal: "24000", lat: 45.19, lng: 0.72 },
      }),
    )
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.parcelle.action).toBe("creee")
    expect(mocks.exploitationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          raisonSociale: "Ferme des Trois Chênes",
          codePostal: "24000",
          ville: "Périgueux",
        }),
      }),
    )
    const parcelle = mocks.parcelleCreate.mock.calls[0][0].data
    expect(parcelle.centroidLat).toBeCloseTo(45.19, 5)
    expect(parcelle.commune).toBe("Périgueux")
    expect(parcelle.notes).toContain("centre de Périgueux")
  })

  it("RECALE le décor Paris au lieu de créer une seconde parcelle", async () => {
    // Compte d'avant la refonte : la parcelle d'exemple est à Paris 4ᵉ.
    mocks.parcelleFindMany.mockResolvedValue([
      { id: "paris", nom: "Potager", centroidLat: 48.85675, centroidLng: 2.352 },
    ])
    const res = await POST(
      request({
        etape: "exploitation",
        commune: { nom: "Saint-Denis", codePostal: "97400", lat: -20.88, lng: 55.45 },
      }),
    )
    const j = await res.json()
    expect(j.parcelle.action).toBe("recalee")
    expect(mocks.parcelleCreate).not.toHaveBeenCalled()
    const maj = mocks.parcelleUpdate.mock.calls[0][0].data
    expect(maj.centroidLat).toBeCloseTo(-20.88, 5)
    expect(maj.commune).toBe("Saint-Denis")
  })

  it("ne touche pas aux parcelles réelles existantes ni à une exploitation déjà saisie", async () => {
    mocks.exploitationFindUnique.mockResolvedValue({
      raisonSociale: "EARL existante",
      codePostal: "64000",
      ville: "Pau",
    })
    mocks.parcelleFindMany.mockResolvedValue([
      { id: "reel", nom: "Champ nord", centroidLat: 43.3, centroidLng: -0.37 },
    ])
    const res = await POST(
      request({
        etape: "exploitation",
        nomExploitation: "Autre nom",
        commune: { nom: "Bayonne", codePostal: "64100", lat: 43.49, lng: -1.47 },
      }),
    )
    const j = await res.json()
    expect(j.parcelle.action).toBe("existante")
    expect(mocks.parcelleCreate).not.toHaveBeenCalled()
    expect(mocks.parcelleUpdate).not.toHaveBeenCalled()
    expect(mocks.exploitationUpdate).not.toHaveBeenCalled()
  })

  it("crée réellement planche, arbre et lots — ce que l'ancien wizard jetait", async () => {
    mocks.parcelleFindFirst.mockResolvedValue({ id: "parc-1" })
    const res = await POST(
      request({
        etape: "production",
        planche: { nom: "Planche 1", longueur: 10, largeur: 1.2, typeSol: "Limoneux" },
        arbre: { espece: "Pommier", nom: null },
        cheptel: [
          { especeAnimaleId: "poule_pondeuse", effectif: 12 },
          { especeAnimaleId: "espece_inconnue", effectif: 5 }, // hors catalogue : ignorée
        ],
      }),
    )
    const j = await res.json()
    expect(j.planche.nom).toBe("Planche 1")
    expect(j.arbre.nom).toBe("Pommier")
    expect(j.lots).toEqual([{ id: 3, nom: "Poules pondeuses", effectif: 12 }])
    // Rattachements et prudences
    expect(mocks.plancheCreate.mock.calls[0][0].data.parcelleGeoId).toBe("parc-1")
    expect(mocks.plancheCreate.mock.calls[0][0].data.surface).toBe(12)
    expect(mocks.arbreCreate.mock.calls[0][0].data.productif).toBe(false)
    expect(mocks.lotCreate).toHaveBeenCalledTimes(1)
  })

  it("est idempotente : ne duplique rien au rejeu d'une étape reprise", async () => {
    mocks.plancheCount.mockResolvedValue(1)
    mocks.arbreCount.mockResolvedValue(1)
    mocks.lotCount.mockResolvedValue(1)
    const res = await POST(
      request({
        etape: "production",
        planche: { nom: "Planche 1" },
        arbre: { espece: "Pommier" },
        cheptel: [{ especeAnimaleId: "poule_pondeuse", effectif: 12 }],
      }),
    )
    const j = await res.json()
    expect(j).toEqual({ planche: null, arbre: null, lots: [] })
    expect(mocks.plancheCreate).not.toHaveBeenCalled()
    expect(mocks.arbreCreate).not.toHaveBeenCalled()
    expect(mocks.lotCreate).not.toHaveBeenCalled()
  })

  it("ancre le décor d'exemple sur la parcelle de l'utilisateur, borné à ses modules", async () => {
    mocks.parcelleFindFirst.mockResolvedValue({ id: "parc-1" })
    mocks.prefFindUnique.mockResolvedValue({ value: JSON.stringify(["maraichage"]) })
    const res = await POST(request({ etape: "exemple", avecExemple: true }))
    const j = await res.json()
    expect(j.exemple).toBe("cree")
    expect(mocks.createSampleDataForUser).toHaveBeenCalledWith("u1", {
      parcelleGeoId: "parc-1",
      avecMaraichage: true,
      avecVerger: false,
    })
  })

  it("refuse le décor d'exemple sur un compte qui a déjà des cultures", async () => {
    mocks.cultureCount.mockResolvedValue(3)
    mocks.arbreCount.mockResolvedValue(1)
    const res = await POST(request({ etape: "exemple", avecExemple: true }))
    const j = await res.json()
    expect(j.exemple).toBe("sans_objet")
    expect(mocks.createSampleDataForUser).not.toHaveBeenCalled()
  })
})
