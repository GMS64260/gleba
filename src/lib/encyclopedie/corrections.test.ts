import { beforeEach, describe, expect, it, vi } from "vitest"
const m = vi.hoisted(() => ({
  user: vi.fn(), auth: vi.fn(), espece: vi.fn(), itp: vi.fn(), variete: vi.fn(), itpUpdate: vi.fn(), especeUpdate: vi.fn(), varieteUpdate: vi.fn(),
  revisionFirst: vi.fn(), revisions: vi.fn(), revisionCreate: vi.fn(), contribution: vi.fn(), contributionCreate: vi.fn(), contributions: vi.fn(), contributionUpdate: vi.fn(),
  discussions: vi.fn(), raw: vi.fn(), transaction: vi.fn(),
}))
vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: m.auth, getSession: async () => null }))
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: () => null, getClientIP: () => "test" }))
vi.mock("@/lib/prisma", () => ({ default: {
  user: { findUnique: m.user }, espece: { findFirst: m.espece, update: m.especeUpdate },
  iTP: { findFirst: m.itp, update: m.itpUpdate }, variete: { findFirst: m.variete, update: m.varieteUpdate },
  revisionEncyclopedie: { findFirst: m.revisionFirst, findMany: m.revisions, create: m.revisionCreate },
  contributionEncyclopedie: { findUnique: m.contribution, create: m.contributionCreate, findMany: m.contributions, updateMany: m.contributionUpdate },
  discussionEncyclopedie: { findMany: m.discussions }, $queryRaw: m.raw, $transaction: m.transaction,
} }))
import prisma from "@/lib/prisma"
import { correctionCibleeSchema } from "./validation"
import { chargerCibleCorrection, cibleCorrectionVue, empreinteCorrection, snapshotJson, correctionsPubliques, type SnapshotCorrection } from "./corrections"
import { proposerCorrectionCiblee, deciderContribution, lireCommunauteVegetal } from "./service"
import { GET } from "@/app/api/public/referentiel/corrections/[type]/[refId]/route"
import { POST } from "@/app/api/referentiel/corrections/route"
const date = new Date("2026-10-26T18:00:00Z")
const espece = { id: "espece-publique", nom: "Amarante queue-de-renard", description: "Présentation existante", nomLatin: "Amaranthus", vivace: false,
  besoinEau: 3, irrigation: null, densite: 4, joursLevee: 10, temperatureGerm: "20 °C", besoinFroid: null, zonesAdaptees: null }
const itp = { id: "itp-public", nom: "Amarante queue-de-renard — plein champ", userId: "identite-privee", especeId: espece.id, espece,
  typePlanche: "Plein champ", modeDemarrage: "Pépinière", semaineSemis: 12, semainePlantation: 18, semaineRecolte: 25, zoneClimat: null,
  sourceRecordId: "identifiant-source-protege", sourceVersion: "v1", sourceReference: "Référence documentaire", sourceUrl: "https://example.test/reference", sourceLicence: "Licence du jeu source",
  dureeCulture: 90, semaineImplantationDebut: 18, delaiPremiereRecolteAnnees: null }
const variete = { id: "variete-publique", nom: "Variété témoin", espece, bio: true, semaineFloraison: 15, dureeFloraison: 3, semaineRecolte: 22, dureeRecolte: 5,
  groupePollinisation: null, ploidie: null, fournisseurId: "fournisseur-prive" }
const commun = { source: "Une référence consultable", signature: "Jardinier", acceptationLicence: true as const }
function proposition(snapshot: SnapshotCorrection) {
  return { ...commun, cibleType: "ITP" as const, refId: itp.id, changements: { semaineSemis: 14 }, empreinteBase: empreinteCorrection(snapshot), motif: "Préciser la période" }
}
function ligneContribution(snapshot: SnapshotCorrection) {
  return { id: "p1", especeId: espece.id, espece, userId: "acteur", signature: "Jardinier", section: "varietes", cibleType: "ITP", refId: itp.id,
    snapshot: snapshotJson(snapshot), changements: { semaineSemis: 14 }, contenu: "Résumé documentaire", source: commun.source, motif: "Préciser la période",
    revisionBaseId: null, licence: "CC BY 4.0", statut: "EN_ATTENTE", decisionMotif: null, createdAt: date, updatedAt: date }
}
const request = (body: unknown) => new Request("http://localhost/api/referentiel/corrections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
beforeEach(() => {
  vi.resetAllMocks()
  m.auth.mockResolvedValue({ error: null, session: { user: { id: "tenant", acteurId: "acteur", role: "USER" } } })
  m.user.mockResolvedValue({ id: "acteur", email: "fictif@example.test", role: "USER", active: true })
  m.espece.mockResolvedValue(espece); m.itp.mockResolvedValue(itp); m.variete.mockResolvedValue(variete)
  m.revisionFirst.mockResolvedValue(null); m.revisions.mockResolvedValue([]); m.discussions.mockResolvedValue([]); m.contributions.mockResolvedValue([])
  m.contributionUpdate.mockResolvedValue({ count: 1 }); m.raw.mockResolvedValue([{ id: "present" }])
  m.transaction.mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma))
  m.contributionCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: "p1", ...data, espece, decisionMotif: null, statut: "EN_ATTENTE", createdAt: date, updatedAt: date }))
  m.revisionCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: "r1", ...data, createdAt: date }))
})
describe("patchs ciblés et champs protégés", () => {
  it.each(["id", "especeId", "sourceRecordId", "sourceVersion", "userId", "partageCommunaute", "dureeCulture", "actif"])("refuse le champ ITP non modifiable %s", async champ => {
    const snapshot = await chargerCibleCorrection("ITP", itp.id)
    expect(correctionCibleeSchema.safeParse({ ...proposition(snapshot), changements: { [champ]: "intrusion" } }).success).toBe(false)
  })
  it("valide les types et périodes, et garde le commentaire facultatif", async () => {
    const snapshot = await chargerCibleCorrection("ITP", itp.id)
    const parsed = correctionCibleeSchema.parse({ ...proposition(snapshot), motif: undefined })
    expect(parsed.motif).toBe("Correction proposée depuis la fiche")
    expect(correctionCibleeSchema.safeParse({ ...proposition(snapshot), changements: { semaineSemis: "14" } }).success).toBe(false)
    expect(correctionCibleeSchema.safeParse({ ...proposition(snapshot), changements: { semaineSemis: 99 } }).success).toBe(false)
    expect(correctionCibleeSchema.safeParse({ ...proposition(snapshot), familleId: "autre" }).success).toBe(false)
  })
  it("la famille de l'espèce et le fournisseur de la variété ne sont pas éditables", async () => {
    const snapshot = await chargerCibleCorrection("ESPECE", espece.id)
    const base = { ...commun, cibleType: "ESPECE", refId: espece.id, empreinteBase: empreinteCorrection(snapshot) }
    expect(correctionCibleeSchema.safeParse({ ...base, changements: { familleId: "autre" } }).success).toBe(false)
    expect(correctionCibleeSchema.safeParse({ ...base, cibleType: "VARIETE", refId: variete.id, changements: { fournisseurId: "autre" } }).success).toBe(false)
  })
})
describe("préremplissage public sûr", () => {
  it("fournit les valeurs affichées et la source, sans identité ni provenance technique", async () => {
    const response = await GET(new Request("http://localhost/api/public/cible"), { params: Promise.resolve({ type: "ITP", refId: itp.id }) })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.cible).toMatchObject({ refId: itp.id, titre: "Amarante queue-de-renard — pépinière", valeurs: { semaineSemis: 12, typePlanche: "Plein champ" }, source: "Référence documentaire\nhttps://example.test/reference", licenceSource: "Licence du jeu source" })
    expect(JSON.stringify(json)).not.toMatch(/sourceRecordId|identifiant-source-protege|identite-privee|fournisseur/)
    expect(json.cible.empreinte).toMatch(/^[a-f0-9]{64}$/)
    expect(m.revisions.mock.calls[0][0].where).toMatchObject({ cibleType: "ITP", refId: itp.id })
  })
  it("ne résout jamais un identifiant ITP par son nom ni une cible privée", async () => {
    m.itp.mockResolvedValue(null)
    const response = await GET(new Request("http://localhost/api/public/cible"), { params: Promise.resolve({ type: "ITP", refId: "Amarante" }) })
    expect(response.status).toBe(404)
    expect(m.itp.mock.calls[0][0].where.AND).toEqual(expect.arrayContaining([{ id: "Amarante", actif: true }, { espece: expect.any(Object) }]))
    expect(m.revisions).not.toHaveBeenCalled()
  })
  it("ne sélectionne pas les informations du fournisseur d'une variété", async () => {
    const snapshot = await chargerCibleCorrection("VARIETE", variete.id)
    expect(cibleCorrectionVue(snapshot).valeurs).not.toHaveProperty("fournisseurId")
    expect(m.variete.mock.calls[0][0].select).not.toHaveProperty("fournisseur")
    expect(m.variete.mock.calls[0][0].where.AND).toEqual(expect.arrayContaining([{ espece: expect.any(Object) }]))
  })
})
describe("soumission directe", () => {
  it("dérive le parent serveur, conserve le snapshot et n'écrit pas l'ITP", async () => {
    const snapshot = await chargerCibleCorrection("ITP", itp.id)
    const response = await POST(request(proposition(snapshot)))
    expect(response.status).toBe(201)
    const data = m.contributionCreate.mock.calls[0][0].data
    expect(data).toMatchObject({ especeId: espece.id, userId: "acteur", cibleType: "ITP", refId: itp.id, changements: { semaineSemis: 14 } })
    expect(data.snapshot.provenance.sourceRecordId).toBe(itp.sourceRecordId)
    expect((await response.json()).contribution.correction).toMatchObject({ avant: { semaineSemis: 12 }, apres: { semaineSemis: 14 } })
    expect(m.itpUpdate).not.toHaveBeenCalled()
  })
  it("refuse un état initial devenu obsolète ou un patch sans changement", async () => {
    const snapshot = await chargerCibleCorrection("ITP", itp.id)
    await expect(proposerCorrectionCiblee("acteur", { ...proposition(snapshot), changements: { semaineSemis: 12 } })).rejects.toMatchObject({ status: 400 })
    m.itp.mockResolvedValue({ ...itp, sourceVersion: "v2" })
    await expect(proposerCorrectionCiblee("acteur", proposition(snapshot))).rejects.toMatchObject({ status: 409 })
    expect(m.contributionCreate).not.toHaveBeenCalled()
  })
  it("refuse la démo et ne laisse pas fournir un parent falsifié", async () => {
    const snapshot = await chargerCibleCorrection("ITP", itp.id)
    expect((await POST(request({ ...proposition(snapshot), especeId: "parent-faux" }))).status).toBe(400)
    m.user.mockResolvedValue({ id: "acteur", email: "demo@gleba.fr", role: "USER", active: true })
    expect((await POST(request(proposition(snapshot)))).status).toBe(403)
    expect(m.contributionCreate).not.toHaveBeenCalled()
  })
})
describe("relecture et publication d'une note", () => {
  it("publie une version propre à l'item sous verrou, sans modifier le catalogue", async () => {
    const snapshot = await chargerCibleCorrection("ITP", itp.id); m.contribution.mockResolvedValue(ligneContribution(snapshot))
    const result = await deciderContribution("p1", "admin", { decision: "PUBLIER", motif: "Correction relue" })
    expect(result.revision).toMatchObject({ cibleType: "ITP", refId: itp.id, avant: { semaineSemis: 12 }, apres: { semaineSemis: 14 } })
    expect(m.revisionFirst.mock.calls[0][0].where).toMatchObject({ cibleType: "ITP", refId: itp.id, especeId: espece.id })
    expect(m.revisionCreate.mock.calls[0][0].data).toMatchObject({ cibleType: "ITP", refId: itp.id, version: 1 })
    expect(m.raw.mock.calls.map(c => c[0].join(""))).toEqual(expect.arrayContaining([expect.stringContaining("FOR KEY SHARE"), expect.stringContaining('FROM "itps"')]))
    expect(m.itpUpdate).not.toHaveBeenCalled(); expect(m.especeUpdate).not.toHaveBeenCalled(); expect(m.varieteUpdate).not.toHaveBeenCalled()
  })
  it("refuse une provenance changée avant de changer le statut, mais permet la reprise", async () => {
    const snapshot = await chargerCibleCorrection("ITP", itp.id); m.contribution.mockResolvedValue(ligneContribution(snapshot))
    m.itp.mockResolvedValue({ ...itp, sourceVersion: "v2" })
    await expect(deciderContribution("p1", "admin", { decision: "PUBLIER", motif: "Relu" })).rejects.toMatchObject({ status: 409 })
    expect(m.contributionUpdate).not.toHaveBeenCalled(); expect(m.revisionCreate).not.toHaveBeenCalled()
    const result = await deciderContribution("p1", "admin", { decision: "A_REPRENDRE", motif: "Le jeu de données a évolué" })
    expect(result.statut).toBe("A_REPRENDRE")
  })
  it("cache une correction si l'enfant devient privé ou change de parent", async () => {
    const snapshot = await chargerCibleCorrection("ITP", itp.id)
    const revision = { ...ligneContribution(snapshot), id: "r1", version: 1, authorId: "acteur", reviewedById: "admin", contributionId: "p1" }
    m.revisions.mockResolvedValue([revision]); m.itp.mockResolvedValue(null)
    expect(await correctionsPubliques(espece.id)).toEqual([])
    m.itp.mockResolvedValue({ ...itp, especeId: "autre", espece: { id: "autre", nom: "Autre parent" } })
    expect(await correctionsPubliques(espece.id)).toEqual([])
  })
  it("ne mélange jamais une note d'ITP avec les sections narratives", async () => {
    const snapshot = await chargerCibleCorrection("ITP", itp.id)
    const revision = { ...ligneContribution(snapshot), id: "r1", version: 1, authorId: "acteur", reviewedById: "admin", contributionId: "p1" }
    m.revisions.mockImplementation(({ where }: { where: { cibleType?: unknown } }) => Promise.resolve(where.cibleType === "SECTION" ? [] : [revision]))
    const data = await lireCommunauteVegetal(espece.id)
    expect(data.sections).toEqual([]); expect(data.revisions).toEqual([]); expect(data.corrections?.[0].refId).toBe(itp.id)
    expect(m.revisionFirst.mock.calls.every(c => c[0].where.cibleType === "SECTION")).toBe(true)
  })
})
