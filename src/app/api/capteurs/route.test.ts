import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  connecteursFindMany: vi.fn(),
  capteursFindMany: vi.fn(),
  queryRaw: vi.fn(),
  ciblesDuCompte: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({
  requireAuthApi: mocks.requireAuthApi,
  getUserId: (s: { user: { id: string } }) => s.user.id,
}))
vi.mock("@/lib/prisma", () => ({
  default: {
    connecteurCapteurs: { findMany: mocks.connecteursFindMany },
    capteur: { findMany: mocks.capteursFindMany },
    $queryRaw: mocks.queryRaw,
  },
}))
vi.mock("@/lib/capteurs/rattachement", async (original) => ({
  ...(await original<typeof import("@/lib/capteurs/rattachement")>()),
  ciblesDuCompte: mocks.ciblesDuCompte,
}))

import { GET } from "./route"

describe("GET /api/capteurs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "proprio", estProprietaireExploitation: false } } })
    mocks.connecteursFindMany.mockResolvedValue([{ id: "conn-1", nom: "TTN", type: "ttn", _count: { capteurs: 1 } }])
    mocks.capteursFindMany.mockResolvedValue([
      { id: "cap-1", connecteurId: "conn-1", plancheId: null, parcelleGeoId: null, arbreId: 7, lotAnimauxId: null, animalId: null, objetJardinId: null },
    ])
    mocks.queryRaw.mockResolvedValue([
      { capteur_id: "cap-1", grandeur: "temperature_sol", valeur: 9.5, unite: "°C", mesuree_a: new Date("2026-10-23T10:00:00Z") },
    ])
    mocks.ciblesDuCompte.mockResolvedValue([])
  })

  it("ne lit que le compte de la session, requête des dernières valeurs comprise", async () => {
    const corps = await (await GET()).json()
    expect(mocks.connecteursFindMany.mock.calls[0][0].where).toEqual({ userId: "proprio" })
    expect(mocks.capteursFindMany.mock.calls[0][0].where).toEqual({ userId: "proprio" })
    expect(mocks.ciblesDuCompte).toHaveBeenCalledWith("proprio")
    // Requête paramétrée : l'id du compte est une valeur liée, pas du texte collé dans le SQL.
    const [morceaux, ...valeurs] = mocks.queryRaw.mock.calls[0]
    expect(morceaux.join("?")).toContain('c."user_id" = ?')
    expect(valeurs).toContain("proprio")

    expect(corps.estProprietaire).toBe(false)
    expect(corps.connecteurs[0]).toMatchObject({ id: "conn-1", nombreCapteurs: 1 })
    // Le jeton haché n'est même pas lu : le `select` ne le demande pas.
    expect(mocks.connecteursFindMany.mock.calls[0][0].select).not.toHaveProperty("jetonHash")
    expect(mocks.connecteursFindMany.mock.calls[0][0].select).toHaveProperty("jetonPrefixe", true)
    expect(corps.capteurs[0]).toMatchObject({
      cible: { type: "arbre", id: 7 },
      dernieresValeurs: [{ grandeur: "temperature_sol", valeur: 9.5, unite: "°C", mesureeA: "2026-10-23T10:00:00.000Z" }],
    })
  })
})
