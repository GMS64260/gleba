import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  cultureFindUnique: vi.fn(),
  cultureUpdate: vi.fn(),
  varieteFindFirst: vi.fn(),
  itpFindFirst: vi.fn(),
  itpFindUnique: vi.fn(),
  especeFindFirst: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({
  requireAuthApi: mocks.requireAuthApi,
  getUserId: () => "user-1",
}))
vi.mock("@/lib/prisma", () => {
  // Transaction simulée : verrou d'exploitation ($executeRaw) puis verrou
  // commun des étapes (`verrouillerCultures`, $queryRaw).
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(0),
    $queryRaw: async () => [],
    culture: { findUnique: mocks.cultureFindUnique, update: mocks.cultureUpdate },
    espece: { findFirst: mocks.especeFindFirst },
    variete: { findFirst: mocks.varieteFindFirst },
    iTP: { findFirst: mocks.itpFindFirst, findUnique: mocks.itpFindUnique },
  }
  return { default: { $transaction: async (callback: (client: typeof tx) => unknown) => callback(tx) } }
})
vi.mock("@/lib/irrigation-cache", () => ({ irrigationCache: { invalidateUser: vi.fn() } }))
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
    mocks.especeFindFirst.mockResolvedValue({ id: 'Navet' })
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

// Équipe debug, D74 — la fiche ouverte dans deux onglets : le second
// enregistrement renvoie tous les champs avec leurs valeurs d'origine et
// effaçait la note modifiée dans le premier, les deux en 200.
describe("PUT /api/cultures/[id] — fiche modifiée ailleurs", () => {
  const enBase = new Date("2026-11-26T08:00:05.000Z")
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } })
    mocks.cultureFindUnique.mockResolvedValue({ ...roquette, notes: "Note du premier onglet", updatedAt: enBase })
    mocks.cultureUpdate.mockImplementation(async ({ data }) => ({ ...roquette, ...data, aIrriguer: false }))
  })

  it("refuse en 409 l'enregistrement d'une version périmée, sans rien écrire", async () => {
    const res = await put({ notes: "", versionLue: "2026-11-26T08:00:00.000Z" })

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: "MODIFIE_AILLEURS", versionActuelle: enBase.toISOString() })
    expect(mocks.cultureUpdate).not.toHaveBeenCalled()
  })

  it("enregistre quand la version lue est celle de la base, sans écrire `versionLue`", async () => {
    const res = await put({ notes: "Note corrigée", versionLue: enBase.toISOString() })

    expect(res.status).toBe(200)
    expect(mocks.cultureUpdate).toHaveBeenCalledTimes(1)
    expect(mocks.cultureUpdate.mock.calls[0][0].data).not.toHaveProperty("versionLue")
  })

  // Version de fiche (chantier du 2026-11-27) : un numéro, qui n'avance que
  // sur une écriture d'un champ de la fiche.
  it("refuse en 409 un numéro de version périmé, et rend la version actuelle", async () => {
    mocks.cultureFindUnique.mockResolvedValue({ ...roquette, updatedAt: enBase, version: 5 })

    const res = await put({ notes: "", versionLue: 4 })

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: "MODIFIE_AILLEURS", versionActuelle: 5 })
    expect(mocks.cultureUpdate).not.toHaveBeenCalled()
  })

  it("enregistre et fait avancer la version dans la même écriture quand le numéro est le bon", async () => {
    mocks.cultureFindUnique.mockResolvedValue({ ...roquette, updatedAt: enBase, version: 5 })

    const res = await put({ notes: "Note corrigée", versionLue: 5 })

    expect(res.status).toBe(200)
    expect(mocks.cultureUpdate).toHaveBeenCalledTimes(1)
    const { data } = mocks.cultureUpdate.mock.calls[0][0]
    expect(data).toMatchObject({ version: { increment: 1 } })
    expect(data).not.toHaveProperty("versionLue")
  })

  it("refuse en 400 une version illisible au lieu de l'ignorer", async () => {
    expect((await put({ notes: "", versionLue: "cinq" })).status).toBe(400)
    expect(mocks.cultureUpdate).not.toHaveBeenCalled()
  })

  it("garde le comportement d'avant pour un appelant qui n'envoie pas de version", async () => {
    const res = await put({ notes: "Depuis l'assistant" })

    expect(res.status).toBe(200)
    expect(mocks.cultureUpdate).toHaveBeenCalledTimes(1)
  })
})
