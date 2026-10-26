import { beforeEach, describe, expect, it, vi } from "vitest"
const m = vi.hoisted(() => ({
  auth: vi.fn(), admin: vi.fn(), session: vi.fn(), user: vi.fn(), espece: vi.fn(), revisionFirst: vi.fn(), revisions: vi.fn(),
  contributionCreate: vi.fn(), contributions: vi.fn(), contribution: vi.fn(), contributionUpdate: vi.fn(), revisionCreate: vi.fn(),
  discussion: vi.fn(), discussions: vi.fn(), discussionCreate: vi.fn(), discussionUpdate: vi.fn(), discussionDelete: vi.fn(), discussionCount: vi.fn(),
  verrouAuteur: vi.fn(), reponse: vi.fn(), reponses: vi.fn(), reponseCreate: vi.fn(), reponseDelete: vi.fn(), transaction: vi.fn(),
}))
vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: m.auth, requireAdminApi: m.admin, getSession: m.session }))
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: () => null, getClientIP: () => "test" }))
vi.mock("@/lib/prisma", () => ({ default: {
  user: { findUnique: m.user }, espece: { findFirst: m.espece },
  revisionEncyclopedie: { findFirst: m.revisionFirst, findMany: m.revisions, create: m.revisionCreate },
  contributionEncyclopedie: { create: m.contributionCreate, findMany: m.contributions, findUnique: m.contribution, updateMany: m.contributionUpdate },
  discussionEncyclopedie: { findFirst: m.discussion, findMany: m.discussions, create: m.discussionCreate, update: m.discussionUpdate, deleteMany: m.discussionDelete, count: m.discussionCount },
  reponseEncyclopedie: { findFirst: m.reponse, findMany: m.reponses, create: m.reponseCreate, delete: m.reponseDelete }, $transaction: m.transaction, $queryRaw: m.verrouAuteur,
} }))
import prisma from "@/lib/prisma"
import { GET as publicGet } from "@/app/api/public/referentiel/vegetaux/[id]/communaute/route"
import { POST as proposer } from "@/app/api/referentiel/vegetaux/[id]/contributions/route"
import { GET as mesContributions } from "@/app/api/communaute/contributions/route"
import { GET as aRelire } from "@/app/api/admin/referentiel/contributions/route"
import { PATCH as decider } from "@/app/api/admin/referentiel/contributions/[id]/route"
import { GET as forumGet, POST as forumPost } from "@/app/api/communaute/forum/route"
import { GET as filGet, PATCH as filPatch } from "@/app/api/communaute/forum/[id]/route"
import { POST as repondre } from "@/app/api/referentiel/discussions/[id]/reponses/route"
import { DELETE as retirerReponse } from "@/app/api/referentiel/discussions/[id]/reponses/[reponseId]/route"
import { DELETE as retirerDiscussion } from "@/app/api/referentiel/discussions/[id]/route"

const date = new Date("2026-10-26T17:00:00Z")
const espece = { id: "tomate", nom: "Tomate", description: "Présentation originale" }
const revision = { id: "r1", especeId: "tomate", section: "presentation", contenu: "Une présentation sourcée.", source: "Document de référence", signature: "Jardinier", version: 1, createdAt: date, licence: "CC BY 4.0", authorId: "acteur", reviewedById: "admin", contributionId: "p1" }
const proposition = { section: "presentation", contenu: "Une présentation documentaire complétée.", source: "Document de référence", motif: "Compléter la présentation", signature: "Jardinier", revisionBaseId: null, acceptationLicence: true }
const contribution = { id: "p1", especeId: "tomate", userId: "acteur", signature: "Jardinier", section: "presentation", contenu: proposition.contenu, source: proposition.source, motif: proposition.motif, revisionBaseId: null, licence: "CC BY 4.0", statut: "EN_ATTENTE", decisionMotif: null, decisionAt: null, createdAt: date, updatedAt: date, espece }
const sujet = { id: "s1", especeId: null, userId: "acteur", signature: "Jardinier", titre: "Une question sur le wiki", contenu: "Comment préciser les sources ?", categorie: "GENERAL", epingle: false, resolu: false, derniereActiviteAt: date, createdAt: date, espece: null, _count: { reponses: 0 }, reponses: [] }
function request(path: string, body?: unknown, method = "POST") {
  return new Request(`http://localhost${path}`, body === undefined ? { method: "GET" } : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
}
function params(id = "tomate") { return { params: Promise.resolve({ id }) } }
function connecter(role = "USER") {
  const session = { user: { id: "tenant", acteurId: "acteur", role } }
  m.auth.mockResolvedValue({ error: null, session })
  m.user.mockResolvedValue({ id: "acteur", email: "fictif@example.test", active: true, role })
  m.admin.mockResolvedValue(role === "ADMIN" ? { error: null, session } : { error: new Response(null, { status: 403 }), session: null })
}
beforeEach(() => {
  vi.resetAllMocks(); connecter(); m.session.mockResolvedValue(null)
  m.espece.mockResolvedValue(espece); m.revisionFirst.mockResolvedValue(null); m.revisions.mockResolvedValue([])
  m.verrouAuteur.mockResolvedValue([{ id: "acteur" }]); m.contributions.mockResolvedValue([]); m.contribution.mockResolvedValue(contribution); m.contributionUpdate.mockResolvedValue({ count: 1 })
  m.contributionCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ ...contribution, ...data }))
  m.revisionCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ ...revision, ...data }))
  m.discussion.mockResolvedValue(sujet); m.discussions.mockResolvedValue([]); m.discussionCount.mockResolvedValue(0)
  m.discussionCreate.mockResolvedValue(sujet); m.discussionUpdate.mockResolvedValue(sujet); m.discussionDelete.mockResolvedValue({ count: 1 })
  m.reponses.mockResolvedValue([]); m.reponse.mockResolvedValue({ id: "rep1", discussionId: "s1", userId: "acteur" })
  m.reponseCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: "rep1", ...data, createdAt: date }))
  m.transaction.mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma))
})

describe("lecture publique", () => {
  it("ne charge aucune contribution en attente ni identité technique", async () => {
    m.revisions.mockResolvedValue([revision]); m.revisionFirst.mockResolvedValueOnce(revision)
    m.discussions.mockResolvedValue([{ ...sujet, especeId: "tomate", reponses: [{ id: "rep1", userId: "acteur", signature: "Autre", contenu: "Une réponse", createdAt: date }] }])
    const response = await publicGet(request("/api/public/referentiel/vegetaux/tomate/communaute"), params())
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store")
    const json = await response.json()
    expect(json.sections[0].revisionId).toBe("r1"); expect(json.discussions[0].supprimable).toBe(false)
    expect(JSON.stringify(json)).not.toMatch(/authorId|reviewedById|userId|tenant|email/)
    expect(m.contributions).not.toHaveBeenCalled()
    expect(m.discussions.mock.calls[0][0].where).toEqual({ especeId: "tomate" })
  })
  it("refuse un végétal privé avant toute lecture communautaire", async () => {
    m.espece.mockResolvedValue(null)
    expect((await publicGet(request("/api/public/ref"), params("prive"))).status).toBe(404)
    expect(m.revisions).not.toHaveBeenCalled(); expect(m.discussions).not.toHaveBeenCalled()
    expect(m.espece.mock.calls[0][0].where.AND[1]).toMatchObject({ OR: [{ userId: null }, { userId: { not: null }, partageCommunaute: true }] })
  })
  it("n'accorde les droits de retrait qu'à l'acteur ou à un admin", async () => {
    m.session.mockResolvedValue({ user: { id: "acteur", role: "USER" } }); m.discussions.mockResolvedValue([{ ...sujet, especeId: "tomate" }])
    const json = await (await publicGet(request("/api/public/ref"), params())).json()
    expect(json.discussions[0].supprimable).toBe(true)
  })
})
describe("propositions", () => {
  it("refuse l'anonyme avant toute écriture", async () => {
    m.auth.mockResolvedValue({ error: new Response(null, { status: 401 }), session: null })
    expect((await proposer(request("/contributions", proposition), params())).status).toBe(401)
    expect(m.transaction).not.toHaveBeenCalled()
  })
  it("refuse le compte démo relu par l'identifiant de l'acteur", async () => {
    m.user.mockResolvedValue({ id: "acteur", email: "demo@gleba.fr", active: true, role: "USER" })
    const response = await proposer(request("/contributions", proposition), params())
    expect(response.status).toBe(403); expect((await response.json()).code).toBe("COMPTE_DEMO")
    expect(m.user).toHaveBeenCalledWith({ where: { id: "acteur" }, select: { id: true, email: true, active: true, role: true } }); expect(m.transaction).not.toHaveBeenCalled()
  })
  it("attribue la proposition à l'acteur, jamais au tenant ou au corps reçu", async () => {
    const response = await proposer(request("/contributions", { ...proposition, userId: "autre" }), params())
    expect(response.status).toBe(201); expect(m.contributionCreate.mock.calls[0][0].data.userId).toBe("acteur")
    expect((await response.json()).contribution).not.toHaveProperty("userId")
  })
  it("exige source, justification et consentement explicite de licence", async () => {
    expect((await proposer(request("/contributions", { ...proposition, acceptationLicence: false }), params())).status).toBe(400)
    expect((await proposer(request("/contributions", { ...proposition, source: "" }), params())).status).toBe(400)
    expect(m.transaction).not.toHaveBeenCalled()
  })
  it("signale une version périmée dès la soumission", async () => {
    m.revisionFirst.mockResolvedValue(revision)
    expect((await proposer(request("/contributions", proposition), params())).status).toBe(409)
    expect(m.contributionCreate).not.toHaveBeenCalled()
  })
  it("le suivi personnel ne lit que les propositions de l'acteur sur les fiches publiques", async () => {
    await mesContributions(request("/api/communaute/contributions"))
    expect(m.contributions.mock.calls[0][0].where).toMatchObject({ userId: "acteur", espece: { OR: expect.any(Array) } })
  })
})
describe("publication relue", () => {
  const body = { decision: "PUBLIER", motif: "Source vérifiée et texte relu" }
  it("refuse le membre non admin", async () => {
    expect((await aRelire(request("/admin"))).status).toBe(403)
    expect((await decider(request("/admin/p1", body, "PATCH"), params("p1"))).status).toBe(403)
    expect(m.contribution).not.toHaveBeenCalled()
  })
  it("publie une révision indépendante du référentiel métier et retient le validateur acteur", async () => {
    connecter("ADMIN")
    const response = await decider(request("/admin/p1", body, "PATCH"), params("p1"))
    expect(response.status).toBe(200)
    expect(m.revisionCreate.mock.calls[0][0].data).toMatchObject({ version: 1, authorId: "acteur", reviewedById: "acteur", contributionId: "p1" })
    expect(m.contributionUpdate.mock.calls[0][0].where).toEqual({ id: "p1", statut: "EN_ATTENTE" })
  })
  it("refuse une version changée depuis la proposition", async () => {
    connecter("ADMIN"); m.revisionFirst.mockResolvedValue(revision)
    expect((await decider(request("/admin/p1", body, "PATCH"), params("p1"))).status).toBe(409)
    expect(m.revisionCreate).not.toHaveBeenCalled()
  })
  it("le contrôle atomique empêche de traiter deux fois une proposition", async () => {
    connecter("ADMIN"); m.contributionUpdate.mockResolvedValue({ count: 0 })
    expect((await decider(request("/admin/p1", body, "PATCH"), params("p1"))).status).toBe(409)
    expect(m.revisionCreate).not.toHaveBeenCalled()
  })
  it("transforme un conflit d'unicité concurrent en 409", async () => {
    connecter("ADMIN"); m.revisionCreate.mockRejectedValue({ code: "P2002" })
    expect((await decider(request("/admin/p1", body, "PATCH"), params("p1"))).status).toBe(409)
  })
  it("ne publie pas une fiche devenue privée", async () => {
    connecter("ADMIN"); m.espece.mockResolvedValue(null)
    expect((await decider(request("/admin/p1", body, "PATCH"), params("p1"))).status).toBe(404)
    expect(m.contributionUpdate).not.toHaveBeenCalled()
  })
})
describe("forum", () => {
  it("réserve même la lecture du forum aux comptes personnels", async () => {
    m.user.mockResolvedValue({ id: "acteur", email: "demo@gleba.fr", active: true, role: "USER" })
    expect((await forumGet(request("/api/communaute/forum"))).status).toBe(403)
    expect((await filGet(request("/api/communaute/forum/s1"), params("s1"))).status).toBe(403)
    expect(m.discussions).not.toHaveBeenCalled()
  })
  it("projette la liste sans compte et filtre les références privées", async () => {
    m.discussionCount.mockResolvedValue(1); m.discussions.mockResolvedValue([sujet])
    const response = await forumGet(request("/api/communaute/forum?tri=sans-reponse&categorie=GENERAL"))
    const json = await response.json()
    expect(json.sujets[0]).toMatchObject({ id: "s1", nbReponses: 0, supprimable: true, espece: null })
    expect(json.sujets[0]).not.toHaveProperty("userId")
    expect(m.discussions.mock.calls[0][0].where).toMatchObject({ reponses: { none: {} }, AND: [{ OR: [{ especeId: null }, { espece: expect.any(Object) }] }] })
  })
  it("refuse des filtres de pagination invalides", async () => {
    expect((await forumGet(request("/api/communaute/forum?page=-1"))).status).toBe(400)
    expect((await forumGet(request("/api/communaute/forum?categorie=PRIVEE"))).status).toBe(400)
  })
  it("crée un sujet général sans inventer de lien à une exploitation", async () => {
    expect((await forumPost(request("/forum", { titre: "Une nouvelle question", contenu: "Bonjour au forum", signature: "Pseudo", categorie: "GENERAL" }))).status).toBe(201)
    expect(m.discussionCreate.mock.calls[0][0].data).toMatchObject({ userId: "acteur", especeId: null, categorie: "GENERAL" })
    expect(m.espece).not.toHaveBeenCalled()
  })
  it("répond avec l'identité acteur et remonte l'activité dans la même transaction", async () => {
    expect((await repondre(request("/reponses", { contenu: "Une réponse", signature: "Pseudo" }), params("s1"))).status).toBe(201)
    expect(m.reponseCreate.mock.calls[0][0].data.userId).toBe("acteur")
    expect(m.discussionUpdate.mock.calls[0][0].data.derniereActiviteAt).toBeInstanceOf(Date)
    expect(m.transaction).toHaveBeenCalledTimes(1)
  })
  it("ne répond pas à un sujet lié à une fiche inaccessible", async () => {
    m.discussion.mockResolvedValue(null)
    expect((await repondre(request("/reponses", { contenu: "Une réponse", signature: "Pseudo" }), params("prive"))).status).toBe(404)
    expect(m.reponseCreate).not.toHaveBeenCalled()
  })
  it("ne retire pas la réponse d'un autre ni celle d'un autre parent", async () => {
    m.reponse.mockResolvedValue({ id: "rep1", userId: "autre", discussionId: "s1" })
    const p = { params: Promise.resolve({ id: "s1", reponseId: "rep1" }) }
    expect((await retirerReponse(request("/reponse", {}, "DELETE"), p)).status).toBe(403)
    m.reponse.mockResolvedValue(null)
    expect((await retirerReponse(request("/reponse", {}, "DELETE"), p)).status).toBe(404)
    expect(m.reponse.mock.calls[0][0].where).toEqual({ id: "rep1", discussionId: "s1" })
    expect(m.reponseDelete).not.toHaveBeenCalled()
  })
  it("un membre ne peut épingler même son propre sujet", async () => {
    expect((await filPatch(request("/s1", { epingle: true }, "PATCH"), params("s1"))).status).toBe(403)
    expect(m.discussionUpdate).not.toHaveBeenCalled()
  })
  it("l'auteur peut résoudre son sujet, les autres ne le peuvent pas", async () => {
    expect((await filPatch(request("/s1", { resolu: true }, "PATCH"), params("s1"))).status).toBe(200)
    m.discussion.mockResolvedValue({ ...sujet, userId: "autre" }); m.discussionUpdate.mockClear()
    expect((await filPatch(request("/s1", { resolu: true }, "PATCH"), params("s1"))).status).toBe(403)
    expect((await retirerDiscussion(request("/s1", {}, "DELETE"), params("s1"))).status).toBe(403)
    expect(m.discussionUpdate).not.toHaveBeenCalled(); expect(m.discussionDelete).not.toHaveBeenCalled()
  })
})

describe("historique des longs échanges", () => {
  it("ouvre la dernière page de réponses et permet de revenir à la première", async () => {
    m.discussion.mockResolvedValue({ ...sujet, _count: { reponses: 65 } })
    m.reponses.mockResolvedValue([{ id: "rep65", contenu: "La plus récente", signature: "Pseudo", userId: "autre", createdAt: date }])
    const latest = await (await filGet(request("/api/communaute/forum/s1"), params("s1"))).json()
    expect(latest.sujet).toMatchObject({ pageReponses: 3, pagesReponses: 3, nbReponses: 65 })
    expect(latest.sujet.reponses[0].id).toBe("rep65")
    expect(m.reponses.mock.calls[0][0]).toMatchObject({ take: 30, skip: 60 })
    const first = await (await filGet(request("/api/communaute/forum/s1?pageReponses=1"), params("s1"))).json()
    expect(first.sujet.pageReponses).toBe(1)
    expect(m.reponses.mock.calls[1][0]).toMatchObject({ take: 30, skip: 0 })
  })
  it("rejette une page de réponses invalide", async () => {
    expect((await filGet(request("/api/communaute/forum/s1?pageReponses=-1"), params("s1"))).status).toBe(400)
    expect(m.reponses).not.toHaveBeenCalled()
  })
  it("la fiche publique montre les dernières réponses dans l'ordre chronologique", async () => {
    m.discussions.mockResolvedValue([{ ...sujet, especeId: "tomate", _count: { reponses: 104 }, reponses: [
      { id: "rep104", userId: "autre", contenu: "Nouvelle réponse", signature: "Pseudo", createdAt: date },
      { id: "rep103", userId: "autre", contenu: "Réponse précédente", signature: "Pseudo", createdAt: date },
    ] }])
    const json = await (await publicGet(request("/api/public/ref"), params())).json()
    expect(json.discussions[0].nbReponses).toBe(104)
    expect(json.discussions[0].reponses.map((r: { id: string }) => r.id)).toEqual(["rep103", "rep104"])
    expect(m.discussions.mock.calls[0][0].include.reponses).toMatchObject({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 })
  })
})


describe("publication et suppression de l'auteur", () => {
  it("verrouille la personne avant de modifier le statut de sa proposition", async () => {
    connecter("ADMIN")
    const response = await decider(request("/admin/p1", { decision: "PUBLIER", motif: "Texte relu et sourcé" }, "PATCH"), params("p1"))
    expect(response.status).toBe(200)
    expect(m.verrouAuteur.mock.calls[0][0].join("")).toContain("FOR KEY SHARE")
    expect(m.verrouAuteur.mock.calls[0][1]).toBe("acteur")
    expect(m.verrouAuteur.mock.invocationCallOrder[0]).toBeLessThan(m.contributionUpdate.mock.invocationCallOrder[0])
  })
  it("ne publie plus si la personne a disparu avant son verrouillage", async () => {
    connecter("ADMIN"); m.verrouAuteur.mockResolvedValue([])
    const response = await decider(request("/admin/p1", { decision: "PUBLIER", motif: "Texte relu et sourcé" }, "PATCH"), params("p1"))
    expect(response.status).toBe(404)
    expect(m.contributionUpdate).not.toHaveBeenCalled(); expect(m.revisionCreate).not.toHaveBeenCalled()
  })
})


describe("révocation des droits malgré un JWT valide", () => {
  it("ne laisse plus lire ou écrire un compte supprimé", async () => {
    m.user.mockResolvedValue(null)
    expect((await forumGet(request("/api/communaute/forum"))).status).toBe(401)
    expect((await proposer(request("/contributions", proposition), params())).status).toBe(401)
    expect(m.discussions).not.toHaveBeenCalled(); expect(m.transaction).not.toHaveBeenCalled()
  })
  it("refuse les lectures et mutations d'un compte désactivé", async () => {
    m.user.mockResolvedValue({ id: "acteur", email: "fictif@example.test", active: false, role: "ADMIN" })
    expect((await forumGet(request("/api/communaute/forum"))).status).toBe(403)
    expect((await aRelire(request("/admin"))).status).toBe(403)
    expect((await repondre(request("/reponses", { contenu: "Une réponse", signature: "Pseudo" }), params("s1"))).status).toBe(403)
    expect(m.discussions).not.toHaveBeenCalled(); expect(m.contributions).not.toHaveBeenCalled(); expect(m.reponseCreate).not.toHaveBeenCalled()
  })
  it("retire immédiatement les privilèges d'un ancien admin", async () => {
    connecter("ADMIN")
    m.user.mockResolvedValue({ id: "acteur", email: "fictif@example.test", active: true, role: "USER" })
    expect((await aRelire(request("/admin"))).status).toBe(403)
    expect((await decider(request("/admin/p1", { decision: "PUBLIER", motif: "Texte relu" }, "PATCH"), params("p1"))).status).toBe(403)
    expect((await filPatch(request("/s1", { epingle: true }, "PATCH"), params("s1"))).status).toBe(403)
    expect(m.contributions).not.toHaveBeenCalled(); expect(m.revisionCreate).not.toHaveBeenCalled(); expect(m.discussionUpdate).not.toHaveBeenCalled()
  })
  it("utilise aussi un rôle admin récemment accordé sans attendre la rotation du JWT", async () => {
    m.user.mockResolvedValue({ id: "acteur", email: "fictif@example.test", active: true, role: "ADMIN" })
    expect((await aRelire(request("/admin"))).status).toBe(200)
    expect(m.admin).not.toHaveBeenCalled()
  })
})
