import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  capteurFindFirst: vi.fn(),
  capteurUpdate: vi.fn(),
  capteurDelete: vi.fn(),
  plancheFindFirst: vi.fn(),
  arbreFindFirst: vi.fn(),
  queryRaw: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({
  requireAuthApi: mocks.requireAuthApi,
  getUserId: (s: { user: { id: string } }) => s.user.id,
}))
vi.mock("@/lib/prisma", () => {
  const client = {
    capteur: { findFirst: mocks.capteurFindFirst, update: mocks.capteurUpdate, delete: mocks.capteurDelete },
    planche: { findFirst: mocks.plancheFindFirst },
    arbre: { findFirst: mocks.arbreFindFirst },
    $queryRaw: mocks.queryRaw,
  }
  return { default: { ...client, $transaction: (action: (tx: typeof client) => Promise<unknown>) => action(client) } }
})

import { DELETE, PATCH } from "./route"

function patch(corps: unknown, id = "cap-1") {
  return PATCH(new Request(`http://localhost/api/capteurs/${id}`, { method: "PATCH", body: JSON.stringify(corps) }), {
    params: Promise.resolve({ id }),
  })
}

describe("PATCH /api/capteurs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "proprio" } } })
    mocks.capteurFindFirst.mockResolvedValue({
      id: "cap-1",
      modele: null,
      correspondances: { a: "poids" },
      clesRecues: ["a", "TempC_DS", "Bat_status", "moisture"],
      clesInconnues: ["TempC_DS", "Bat_status", "moisture"],
      connecteur: { type: "ttn" },
    })
    mocks.capteurUpdate.mockImplementation(async ({ data }: { data: unknown }) => ({ id: "cap-1", ...(data as object) }))
  })

  it("ne trouve pas le capteur d'un autre compte", async () => {
    mocks.capteurFindFirst.mockResolvedValue(null)
    const r = await patch({ nom: "Serre" })
    expect(r.status).toBe(404)
    expect(mocks.capteurFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "cap-1", userId: "proprio" } }))
    expect(mocks.capteurUpdate).not.toHaveBeenCalled()
  })

  it("refuse de rattacher à la planche d'un autre compte", async () => {
    mocks.plancheFindFirst.mockResolvedValue(null)
    const r = await patch({ cible: { type: "planche", id: "planche-du-voisin" } })
    expect(r.status).toBe(404)
    expect(mocks.plancheFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "planche-du-voisin", userId: "proprio" } }))
    expect(mocks.capteurUpdate).not.toHaveBeenCalled()
  })

  it("rattache à une cible du compte et vide les autres colonnes", async () => {
    mocks.arbreFindFirst.mockResolvedValue({ id: 12 })
    expect((await patch({ cible: { type: "arbre", id: 12 } })).status).toBe(200)
    expect(mocks.capteurUpdate.mock.calls[0][0].data).toMatchObject({
      arbreId: 12, plancheId: null, parcelleGeoId: null, lotAnimauxId: null, animalId: null, objetJardinId: null,
    })
  })

  it("détache le capteur avec une cible nulle", async () => {
    await patch({ cible: null })
    expect(mocks.capteurUpdate.mock.calls[0][0].data).toMatchObject({ plancheId: null, arbreId: null })
  })

  it("fusionne les correspondances et retire les clés traitées des inconnues", async () => {
    await patch({ correspondances: { TempC_DS: "temperature_sol" } })
    expect(mocks.capteurUpdate.mock.calls[0][0].data).toMatchObject({
      correspondances: { a: "poids", TempC_DS: "temperature_sol" },
      clesInconnues: ["Bat_status", "moisture"],
    })
  })

  it("fusionne avec la version relue après verrouillage, pas celle de la garde", async () => {
    const actuel = await mocks.capteurFindFirst()
    mocks.capteurFindFirst.mockResolvedValueOnce(actuel).mockResolvedValueOnce({
      ...actuel, correspondances: { ...actuel.correspondances, Bat_status: "batterie" },
    })
    await patch({ correspondances: { TempC_DS: "temperature_sol" } })
    expect(mocks.capteurUpdate.mock.calls[0][0].data.correspondances).toEqual({
      a: "poids", Bat_status: "batterie", TempC_DS: "temperature_sol",
    })
    expect(mocks.queryRaw.mock.calls[0][0].join("?")).toContain("FOR UPDATE")
    expect(mocks.queryRaw.mock.invocationCallOrder[0]).toBeLessThan(mocks.capteurFindFirst.mock.invocationCallOrder.at(-1)!)
  })

  it("« ignorer » (null) traite aussi la clé", async () => {
    await patch({ correspondances: { Bat_status: null } })
    expect(mocks.capteurUpdate.mock.calls[0][0].data.clesInconnues).toEqual(["TempC_DS", "moisture"])
  })

  it("retirer une correspondance rend la clé à la règle automatique, inconnue s'il n'y en a pas", async () => {
    await patch({ retirerCorrespondances: ["a"] })
    const { data } = mocks.capteurUpdate.mock.calls[0][0]
    expect(data.correspondances).toEqual({})
    expect(data.clesInconnues).toEqual(["a", "TempC_DS", "Bat_status", "moisture"])
  })

  it("choisir un profil par son id recalcule les inconnues avec lui", async () => {
    await patch({ modele: "milesight-iot/em500-smtc" })
    const { data } = mocks.capteurUpdate.mock.calls[0][0]
    expect(data.modele).toBe("milesight-iot/em500-smtc")
    expect(data.clesInconnues).toEqual(["TempC_DS", "Bat_status"])
  })

  it("borne le nombre de correspondances d'un capteur", async () => {
    const trop = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`k${i}`, null]))
    expect((await patch({ correspondances: trop })).status).toBe(400)
    expect(mocks.capteurUpdate).not.toHaveBeenCalled()
  })

  it("refuse un profil qui n'existe pas, une grandeur inconnue", async () => {
    expect((await patch({ modele: "Sondes de sol" })).status).toBe(400)
    expect((await patch({ correspondances: { x: "humidite_lunaire" } })).status).toBe(400)
    expect(mocks.capteurUpdate).not.toHaveBeenCalled()
  })
})

describe("DELETE /api/capteurs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "proprio" } } })
  })

  it("ne supprime pas le capteur d'un autre compte", async () => {
    mocks.capteurFindFirst.mockResolvedValue(null)
    const r = await DELETE(new Request("http://localhost/api/capteurs/cap-x", { method: "DELETE" }), { params: Promise.resolve({ id: "cap-x" }) })
    expect(r.status).toBe(404)
    expect(mocks.capteurFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "cap-x", userId: "proprio" } }))
    expect(mocks.capteurDelete).not.toHaveBeenCalled()
  })

  it("supprime le capteur du compte", async () => {
    mocks.capteurFindFirst.mockResolvedValue({ id: "cap-1" })
    const r = await DELETE(new Request("http://localhost/api/capteurs/cap-1", { method: "DELETE" }), { params: Promise.resolve({ id: "cap-1" }) })
    expect(r.status).toBe(200)
    expect(mocks.capteurDelete).toHaveBeenCalledWith({ where: { id: "cap-1" } })
  })
})
