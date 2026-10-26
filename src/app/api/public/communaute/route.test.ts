import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ count: vi.fn(), especes: vi.fn(), revisions: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ default: {
  espece: { count: mocks.count, findMany: mocks.especes },
  revisionEncyclopedie: { findMany: mocks.revisions },
} }))
import { GET } from "./route"
import { visibiliteEnfantPublic, visibiliteReferentielPublic } from "@/lib/referentiel-public"

describe("GET /api/public/communaute", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.count.mockResolvedValue(25)
    mocks.especes.mockResolvedValue([{ id: "legume-id", nom: "Nom modifiable", nomLatin: "NON_TROUVE", type: "legume", description: "NON_TROUVE", userId: "ne-doit-pas-sortir", _count: { varietes: 2, itps: 3 } }])
    mocks.revisions.mockResolvedValue([{ id: "revision-id", section: "semis", signature: "Signature choisie", createdAt: new Date("2026-10-26T12:00:00Z"), authorId: "ne-doit-pas-sortir", espece: { id: "legume-id", nom: "Nom modifiable", userId: "ne-doit-pas-sortir" } }])
  })

  it("projette seulement les données publiques et route par identifiant", async () => {
    const response = await GET(new Request("https://gleba.test/api/public/communaute?page=999"))
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toMatchObject({ total: 25, page: 2, pages: 2, especes: [{ id: "legume-id", nom: "Nom modifiable", nomLatin: null, description: null, nbVarietes: 2, nbItineraires: 3 }] })
    expect(JSON.stringify(data)).not.toMatch(/ne-doit-pas-sortir|authorId|userId|email/)
    expect(mocks.especes).toHaveBeenCalledWith(expect.objectContaining({ skip: 24, take: 24, orderBy: [{ nom: "asc" }, { id: "asc" }] }))
  })

  it("ne lit ni les références privées ni leurs enfants ou révisions", async () => {
    await GET(new Request("https://gleba.test/api/public/communaute?q=tomate&sansPhoto=1"))
    const catalogue = mocks.especes.mock.calls[0][0]
    expect(catalogue.where.AND).toContainEqual(visibiliteReferentielPublic)
    expect(catalogue.select._count.select.varietes.where).toEqual(visibiliteEnfantPublic())
    expect(catalogue.select._count.select.itps.where).toEqual({ AND: [{ actif: true }, visibiliteEnfantPublic()] })
    expect(mocks.revisions.mock.calls[0][0].where).toEqual({ espece: visibiliteReferentielPublic })
    expect(catalogue.select).not.toHaveProperty("userId")
  })

  it("signale une lecture impossible sans transformer l’erreur en catalogue vide", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.count.mockRejectedValueOnce(new Error("indisponible"))
    const response = await GET(new Request("https://gleba.test/api/public/communaute"))
    expect(response.status).toBe(500)
    expect(await response.json()).toHaveProperty("error")
    log.mockRestore()
  })
})
