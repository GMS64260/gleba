import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
const m = vi.hoisted(() => ({ auth: vi.fn(), owner: vi.fn(), checkout: vi.fn(), trial: vi.fn(), demo: vi.fn() }))
vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: m.auth, refusSiPasProprietaire: m.owner }))
vi.mock("@/lib/demo-garde", () => ({ refusSiCompteDemo: m.demo }))
vi.mock("@/lib/prisma", () => ({ default: {} }))
vi.mock("@/lib/abonnement/serveur", () => ({ abonnementsActifs: () => true, chargerAccesService: vi.fn(), demarrerEssai: m.trial }))
vi.mock("@/lib/abonnement/stripe", () => ({ creerCheckout: m.checkout, creerPortail: vi.fn(), paiementsDisponibles: () => true, resilier: vi.fn(), ErreurFacturation: class extends Error {} }))
import { POST } from "./route"
const requete = (data: unknown) => new NextRequest("https://gleba.example/api/abonnement", { method: "POST", body: JSON.stringify(data) })
beforeEach(() => {
  vi.clearAllMocks()
  m.auth.mockResolvedValue({ error: null, session: { user: { id: "tenant-qa", estProprietaireExploitation: true } } })
  m.owner.mockReturnValue(null); m.demo.mockResolvedValue(null)
  m.checkout.mockResolvedValue("https://checkout.stripe.com/test")
})
afterEach(() => vi.unstubAllEnvs())
describe("contrat de souscription", () => {
  it("refuse une commande provenant d’un autre site", async () => {
    const req = new NextRequest("https://gleba.example/api/abonnement", { method: "POST", headers: { origin: "https://autre.example" }, body: "{}" })
    expect((await POST(req)).status).toBe(403)
    expect(m.checkout).not.toHaveBeenCalled()
  })
  it("utilise l’exploitation de la session, pas un identifiant du navigateur", async () => {
    const res = await POST(requete({ action: "checkout", formule: "complet", conditionsAcceptees: true, userId: "autre" }))
    expect(res.status).toBe(200)
    expect(m.checkout).toHaveBeenCalledWith("tenant-qa")
  })
  it("exige un accord explicite et refuse un tarif fourni comme formule", async () => {
    for (const d of [{ action: "checkout", formule: "complet" }, { action: "checkout", formule: "essentiel", conditionsAcceptees: true }, { action: "changer", formule: "complet", conditionsAcceptees: true }]) expect((await POST(requete(d))).status).toBe(400)
    expect(m.checkout).not.toHaveBeenCalled()
  })
  it("un membre ne peut ni souscrire ni résilier", async () => {
    m.owner.mockReturnValue(new Response("Refus", { status: 403 }))
    for (const action of ["checkout", "resilier", "essai"]) expect((await POST(requete({ action }))).status).toBe(403)
    expect(m.checkout).not.toHaveBeenCalled(); expect(m.trial).not.toHaveBeenCalled()
  })
  it("la consultation admin n’effectue aucune opération de paiement", async () => {
    m.auth.mockResolvedValue({ session: { user: { id: "tenant-qa", impersonatedBy: "admin-qa" } } })
    expect((await POST(requete({ action: "checkout", formule: "complet", conditionsAcceptees: true }))).status).toBe(403)
    expect(m.checkout).not.toHaveBeenCalled()
  })
})
