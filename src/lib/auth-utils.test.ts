import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), etat: vi.fn(), contexte: vi.fn(), redirect: vi.fn((chemin: string) => { throw new Error(`REDIRECT:${chemin}`) }),
}))
vi.mock("./auth", () => ({ auth: mocks.auth }))
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }))
const enTetes = vi.hoisted(() => ({ courantes: new Headers() }))
vi.mock("next/headers", () => ({ headers: vi.fn(async () => enTetes.courantes) }))
vi.mock("./activity", () => ({ touchActivity: vi.fn() }))
vi.mock("./compte-actif", () => ({ lireEtatSession: mocks.etat }))
vi.mock("./exploitation/membres", () => ({ resoudreContexteExploitation: mocks.contexte }))
vi.mock("./abonnement/serveur", () => ({ refusAbonnementApi: vi.fn(async () => null) }))

import { getSession, requireAdmin, requireAdminApi, requireAuth, requireAuthApi } from "./auth-utils"

const session = (role: string, impersonatedBy: string | null = null) => ({ user: { id: "u1", email: "a@b.fr", role, impersonatedBy } })
const requete = () => new Request("http://localhost/api/admin/users", { method: "GET" })

describe("gardes de session : la base fait foi sur le rôle et le compte actif", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NODE_ENV", "test")
    mocks.contexte.mockResolvedValue({ tenantId: "u1", acteurId: "u1", role: "PROPRIETAIRE", modules: null, estProprietaire: true, peutEcrire: true })
  })

  it("un administrateur rétrogradé perd l’accès admin malgré son jeton", async () => {
    mocks.auth.mockResolvedValue(session("ADMIN"))
    mocks.etat.mockResolvedValue({ actif: true, role: "USER" })
    const { error, session: rendue } = await requireAdminApi(requete())
    expect(rendue).toBeNull()
    expect(error?.status).toBe(403)
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/")
  })

  it("un compte promu en base devient administrateur sans se reconnecter", async () => {
    mocks.auth.mockResolvedValue(session("USER"))
    mocks.etat.mockResolvedValue({ actif: true, role: "ADMIN" })
    const { error, session: rendue } = await requireAdminApi(requete())
    expect(error).toBeNull()
    expect(rendue?.user.role).toBe("ADMIN")
  })

  it("un compte désactivé reçoit 401 côté API et quitte sa session côté page", async () => {
    mocks.auth.mockResolvedValue(session("USER"))
    mocks.etat.mockResolvedValue({ actif: false })
    const { error, session: rendue } = await requireAuthApi(requete())
    expect(rendue).toBeNull()
    expect(error?.status).toBe(401)
    await expect(requireAuth()).rejects.toThrow("REDIRECT:/api/session-terminee")
  })

  it("transmet l’administrateur d’une consultation à la relecture", async () => {
    mocks.auth.mockResolvedValue(session("USER", "a1"))
    mocks.etat.mockResolvedValue({ actif: true, role: "USER" })
    await requireAuthApi(requete())
    expect(mocks.etat).toHaveBeenCalledWith(expect.objectContaining({ id: "u1", impersonatedBy: "a1" }))
  })

  it("transmet la version de session du jeton ; une session révoquée reçoit 401 et quitte sa session (MC3)", async () => {
    mocks.auth.mockResolvedValue({ user: { ...session("USER").user, sessionVersion: 2 } })
    mocks.etat.mockResolvedValue({ actif: false, motif: "session_revoquee" })
    const { error } = await requireAuthApi(requete())
    expect(mocks.etat).toHaveBeenCalledWith(expect.objectContaining({ id: "u1", impersonatedBy: null, sessionVersion: 2 }))
    expect(error?.status).toBe(401)
    await expect(requireAuth()).rejects.toThrow("REDIRECT:/api/session-terminee")
  })

  // Retour de revue QA (MC3, tour 1) : getSession rendait la session brute.
  it("getSession rend null pour une session caduque, comme une visite anonyme", async () => {
    mocks.auth.mockResolvedValue({ user: { ...session("USER").user, sessionVersion: 0 } })
    mocks.etat.mockResolvedValue({ actif: false, motif: "session_revoquee" })
    expect(await getSession()).toBeNull()
    expect(mocks.etat).toHaveBeenCalledWith(expect.objectContaining({ id: "u1", sessionVersion: 0 }))
    mocks.etat.mockResolvedValue({ actif: false })
    expect(await getSession()).toBeNull()
  })

  it("getSession rend la session valide avec le rôle de la base, et null sans session", async () => {
    mocks.auth.mockResolvedValue(session("USER"))
    mocks.etat.mockResolvedValue({ actif: true, role: "ADMIN" })
    expect((await getSession())?.user).toMatchObject({ id: "u1", role: "ADMIN" })
    mocks.auth.mockResolvedValue(null)
    mocks.etat.mockClear()
    expect(await getSession()).toBeNull()
    expect(mocks.etat).not.toHaveBeenCalled()
  })
})

describe("requireAuthApi : modules fermés à un membre (table unique chemin → module)", () => {
  const MESSAGE = "Accès refusé : ce module ne vous est pas ouvert dans cette exploitation."
  const membre = (modules: string[] | null) => ({ tenantId: "proprio", acteurId: "u1", role: "MEMBRE", modules, estProprietaire: false, peutEcrire: true })
  const appel = (chemin: string, methode = "GET") => new Request(`http://localhost${chemin}`, { method: methode })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NODE_ENV", "test")
    enTetes.courantes = new Headers()
    mocks.auth.mockResolvedValue(session("USER"))
    mocks.etat.mockResolvedValue({ actif: true, role: "USER" })
  })

  it.each(['/api/elevage/stocks-lies', '/api/elevage/besoins-boutique', '/api/boutique/produits/stocks-lies'])('%s : 401 sans session, 403 sans élevage, propriétaire transmis si autorisé', async (chemin) => {
    mocks.auth.mockResolvedValue(null)
    expect((await requireAuthApi(appel(chemin))).error?.status).toBe(401)
    mocks.auth.mockResolvedValue(session('USER'))
    mocks.contexte.mockResolvedValue(membre(['maraichage']))
    expect((await requireAuthApi(appel(chemin))).error?.status).toBe(403)
    mocks.contexte.mockResolvedValue(membre(['elevage']))
    const resultat = await requireAuthApi(appel(chemin))
    expect(resultat.error).toBeNull()
    expect(resultat.session?.user).toMatchObject({ id: 'proprio', acteurId: 'u1' })
  })

  it("membre limité au maraîchage : 403 sur comptabilité et élevage (lecture et écriture), passage sur cultures", async () => {
    mocks.contexte.mockResolvedValue(membre(["maraichage"]))
    for (const [chemin, methode] of [["/api/comptabilite/stats", "GET"], ["/api/elevage/animaux", "GET"], ["/api/comptabilite/ventes", "POST"]]) {
      const { error, session: rendue } = await requireAuthApi(appel(chemin, methode))
      expect(rendue).toBeNull()
      expect(error?.status).toBe(403)
      expect(await error?.json()).toEqual({ error: MESSAGE })
    }
    const ok = await requireAuthApi(appel("/api/cultures"))
    expect(ok.error).toBeNull()
    expect(ok.session?.user.id).toBe("proprio")
  })

  it("sans requête transmise, le chemin vient de l'en-tête posé par le middleware", async () => {
    mocks.contexte.mockResolvedValue(membre(["maraichage"]))
    enTetes.courantes = new Headers({ "x-gleba-chemin": "/api/comptabilite/stats", "x-gleba-mutation": "0" })
    expect((await requireAuthApi()).error?.status).toBe(403)
    enTetes.courantes = new Headers({ "x-gleba-chemin": "/api/cultures", "x-gleba-mutation": "0" })
    expect((await requireAuthApi()).error).toBeNull()
    // Membre restreint, aucun chemin connu : refus.
    enTetes.courantes = new Headers()
    expect((await requireAuthApi()).error?.status).toBe(403)
  })

  it("membre sans restriction et propriétaire : aucun changement", async () => {
    mocks.contexte.mockResolvedValue(membre(null))
    expect((await requireAuthApi(appel("/api/comptabilite/stats"))).error).toBeNull()
    expect((await requireAuthApi()).error).toBeNull()
    mocks.contexte.mockResolvedValue({ tenantId: "u1", acteurId: "u1", role: "PROPRIETAIRE", modules: null, estProprietaire: true, peutEcrire: true })
    expect((await requireAuthApi(appel("/api/elevage/animaux"))).error).toBeNull()
  })

  it("la lecture seule reste tranchée avant le module (code LECTURE_SEULE inchangé)", async () => {
    mocks.contexte.mockResolvedValue({ ...membre(["maraichage"]), role: "CONSULTATION", peutEcrire: false })
    const { error } = await requireAuthApi(appel("/api/comptabilite/ventes", "POST"))
    expect(error?.status).toBe(403)
    expect((await error?.json()).code).toBe("LECTURE_SEULE")
  })
})
