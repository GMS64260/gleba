import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ auth: vi.fn(), findMany: vi.fn() }))
vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.auth }))
vi.mock("@/lib/prisma", () => ({ default: { evolution: { findMany: mocks.findMany } } }))
import { GET } from "./route"

const auteurId = "auteur-prive-invente"
const email = "signature-secrete-inventee@example.invalid"
const proposition = (name: string | null = null, id = auteurId) => ({
  id: "evolution-inventee", titre: "Une proposition", description: "Un besoin produit",
  categorie: "GENERAL", statut: "PROPOSEE", adminNote: null,
  createdAt: new Date("2026-11-18T12:00:00Z"),
  user: { id, name, email }, _count: { votes: 7 }, votes: [{ id: "vote-invente" }],
})
const consulter = (query = "") => GET(new Request(`https://gleba.example/api/evolutions${query}`))

describe("GET /api/evolutions : signature publique", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ error: null, session: { user: { id: "tenant-invente", acteurId: "lecteur-invente" } } })
    mocks.findMany.mockResolvedValue([proposition()])
  })

  it.each(["lecteur-invente", "demo-inventee"])("expurge l'identité sans nom pour %s", async (acteurId) => {
    mocks.auth.mockResolvedValue({ error: null, session: { user: { id: acteurId } } })
    const response = await consulter()
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.evolutions[0].author).toEqual({ name: "Contributeur", isMe: false })
    const json = JSON.stringify(data)
    for (const prive of [email, email.split("@")[0], auteurId]) expect(json).not.toContain(prive)
    expect(mocks.findMany.mock.calls[0][0].include.user.select).toEqual({ id: true, name: true })
  })

  it.each([null, "", "   ", "\t\n"])("remplace un nom vide (%j) par Contributeur", async (name) => {
    mocks.findMany.mockResolvedValue([proposition(name)])
    const data = await (await consulter()).json()
    expect(data.evolutions[0].author).toEqual({ name: "Contributeur", isMe: false })
  })

  it("conserve le nom renseigné", async () => {
    mocks.findMany.mockResolvedValue([proposition("Éleveuse du test")])
    const data = await (await consulter()).json()
    expect(data.evolutions[0].author).toEqual({ name: "Éleveuse du test", isMe: false })
  })

  it("reconnaît l'acteur auteur et son vote sans le confondre avec le tenant", async () => {
    mocks.findMany.mockResolvedValue([proposition(null, "lecteur-invente"), proposition(null, "tenant-invente")])
    const data = await (await consulter()).json()
    expect(data.evolutions[0].author).toEqual({ name: "Contributeur", isMe: true })
    expect(data.evolutions[1].author.isMe).toBe(false)
    expect(data.evolutions[0]).toMatchObject({ votes: 7, hasVoted: true })
    expect(mocks.findMany.mock.calls[0][0].include.votes).toEqual({ where: { userId: "lecteur-invente" }, select: { id: true } })
  })

  it("conserve les filtres et le tri récent ainsi que les votes absents", async () => {
    mocks.findMany.mockResolvedValue([{ ...proposition(), votes: [] }])
    const data = await (await consulter("?statut=PLANIFIEE&categorie=ELEVAGE&tri=recent")).json()
    expect(mocks.findMany.mock.calls[0][0]).toMatchObject({
      where: { statut: "PLANIFIEE", categorie: "ELEVAGE" }, orderBy: [{ createdAt: "desc" }], take: 500,
    })
    expect(data.evolutions[0]).toMatchObject({ votes: 7, hasVoted: false })
  })

  it("ignore les filtres inconnus et conserve le tri par votes par défaut", async () => {
    await consulter("?statut=inconnu&categorie=inconnue")
    expect(mocks.findMany.mock.calls[0][0]).toMatchObject({
      where: {}, orderBy: [{ votes: { _count: "desc" } }, { createdAt: "desc" }],
    })
  })

  it("ne consulte pas la base quand l'accès est refusé", async () => {
    mocks.auth.mockResolvedValue({ error: new Response(null, { status: 401 }) })
    expect((await consulter()).status).toBe(401)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })
})
