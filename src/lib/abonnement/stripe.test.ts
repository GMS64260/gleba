import { createHmac } from "node:crypto"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  abonnementGleba: { findUnique: vi.fn(), findFirst: vi.fn(), findUniqueOrThrow: vi.fn(), upsert: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  evenementAbonnement: { upsert: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  query: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({ default: { ...mocks, $transaction: async (fn: (db: unknown) => unknown) => fn({ abonnementGleba: mocks.abonnementGleba, $queryRaw: mocks.query }) } }))
import { recevoirEvenement, signatureValide, synchroniserAbonnement, creerCheckout } from "./stripe"

const ligne = { userId: "ferme-synthetique", gratuitAVie: false, checkoutCle: "generation-qa", clientStripeId: "cus_synthetique", abonnementStripeId: "sub_synthetique", formule: "complet", payeJusquau: new Date("2027-02-01") }
function abonnement(overrides: Record<string, unknown> = {}) {
  return { id: "sub_synthetique", customer: "cus_synthetique", livemode: false, status: "active", metadata: { glebaUserId: "ferme-synthetique", glebaCheckoutCle: "generation-qa" }, items: { data: [{ quantity: 1, price: { id: "price_CompletQA", currency: "eur", unit_amount: 1200 } }] }, latest_invoice: { status: "paid", amount_remaining: 0, lines: { data: [{ amount: 1200, pricing: { price_details: { price: "price_CompletQA" } }, period: { end: Date.parse("2027-04-01") / 1000 } }] } }, ...overrides }
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("GLEBA_ABONNEMENTS_ACTIFS", "true")
  vi.stubEnv("GLEBA_STRIPE_SECRET_KEY", "sk_test_synthetique")
  vi.stubEnv("GLEBA_STRIPE_PRICE_COMPLET", "price_CompletQA")
  vi.stubEnv("GLEBA_STRIPE_WEBHOOK_SECRET", "secret-synthetique-de-test")
  mocks.abonnementGleba.findFirst.mockResolvedValue(ligne)
  mocks.abonnementGleba.findUnique.mockResolvedValue(ligne)
  mocks.abonnementGleba.update.mockResolvedValue(ligne)
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe("authenticité du webhook", () => {
  const secret = "cle-synthetique"
  const corps = '{"id":"evt_synthetique"}'
  const instant = 1800000000000
  const t = String(instant / 1000)
  const sig = createHmac("sha256", secret).update(`${t}.${corps}`).digest("hex")
  it("accepte la signature exacte et sa rotation", () => {
    expect(signatureValide(corps, `t=${t},v1=${"0".repeat(64)},v1=${sig}`, secret, instant)).toBe(true)
  })
  it("refuse le corps altéré, une signature tronquée et un rejeu trop ancien", () => {
    expect(signatureValide(corps + " ", `t=${t},v1=${sig}`, secret, instant)).toBe(false)
    expect(signatureValide(corps, `t=${t},v1=aa`, secret, instant)).toBe(false)
    expect(signatureValide(corps, `t=${t},v1=${sig}`, secret, instant + 301000)).toBe(false)
  })
  it("ne consulte ni ne modifie la base avant validation", async () => {
    await expect(recevoirEvenement(corps, "invalide")).rejects.toThrow("Signature")
    expect(mocks.evenementAbonnement.upsert).not.toHaveBeenCalled()
  })
  it("un événement déjà traité ne prolonge pas les droits une seconde fois", async () => {
    const body = JSON.stringify({ id: "evt_synthetique", type: "invoice.paid", livemode: false, data: { object: { id: "in_synthetique" } } })
    const stamp = String(Math.floor(Date.now() / 1000))
    const signature = createHmac("sha256", "secret-synthetique-de-test").update(`${stamp}.${body}`).digest("hex")
    mocks.evenementAbonnement.upsert.mockResolvedValue({ traiteLe: new Date() })
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock)
    await recevoirEvenement(body, `t=${stamp},v1=${signature}`)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.abonnementGleba.update).not.toHaveBeenCalled()
  })
})
describe("preuve de paiement et cloisonnement", () => {
  it("attribue exactement la période acquittée à Complet", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(abonnement()))))
    await synchroniserAbonnement("sub_synthetique")
    expect(mocks.abonnementGleba.update).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "ferme-synthetique" }, data: expect.objectContaining({ formule: "complet", payeJusquau: new Date("2027-04-01") }) }))
  })
  it("une facture ouverte ne donne aucune nouvelle période", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(abonnement({ latest_invoice: { status: "open", amount_remaining: 1200, lines: { data: [] } } })))))
    await synchroniserAbonnement("sub_synthetique")
    const data = mocks.abonnementGleba.update.mock.calls[0][0].data
    expect(data.payeJusquau).toEqual(ligne.payeJusquau)
    expect(data.formule).toBeUndefined()
  })
  it.each([
    { metadata: { glebaUserId: "autre-ferme" } },
    { customer: "cus_autre" },
    { livemode: true },
    { items: { data: [{ quantity: 1, price: { id: "priceNonAutorise", currency: "eur", unit_amount: 1 } }] } },
    { items: { data: [{ quantity: 1, price: { id: "price_CompletQA", currency: "eur", unit_amount: 500 } }] } },
  ])("refuse un contrat ne correspondant pas à l’exploitation ou au tarif : %j", async override => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(abonnement(override)))))
    await expect(synchroniserAbonnement("sub_synthetique")).rejects.toThrow()
    expect(mocks.abonnementGleba.update).not.toHaveBeenCalled()
  })
  it("un ancien abonnement arrivé en retard ne remplace pas le nouveau", async () => {
    mocks.abonnementGleba.findFirst.mockResolvedValue({ ...ligne, abonnementStripeId: "sub_nouveau" })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(abonnement({ status: "canceled" })))))
    await synchroniserAbonnement("sub_synthetique")
    expect(mocks.abonnementGleba.update).not.toHaveBeenCalled()
  })
  it("un contrat annulé ancien ne débloque pas une nouvelle session Checkout", async () => {
    mocks.abonnementGleba.findFirst.mockResolvedValue({ ...ligne, abonnementStripeId: null, checkoutCle: "nouvelle-generation" })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(abonnement({ status: "canceled" })))))
    await synchroniserAbonnement("sub_synthetique")
    expect(mocks.abonnementGleba.update).not.toHaveBeenCalled()
  })
  it("un compte historique ne peut pas ouvrir de paiement", async () => {
    mocks.user.findUnique.mockResolvedValue({ createdAt: new Date("2026-01-01"), email: "historique@example.invalid" })
    mocks.abonnementGleba.findUnique.mockResolvedValue(null)
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock)
    await expect(creerCheckout("historique")).rejects.toThrow("gratuit")
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
describe("clé du compte Stripe de Gleba", () => {
  it.each(["sk_test_synthetique", "rk_test_synthetique"])("accepte %s en mode test", async cle => {
    vi.stubEnv("GLEBA_STRIPE_SECRET_KEY", cle)
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(abonnement())))
    vi.stubGlobal("fetch", fetchMock)
    await synchroniserAbonnement("sub_synthetique")
    expect(fetchMock).toHaveBeenCalled()
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer " + cle)
  })
  it.each(["rk_live_synthetique", "sk_live_synthetique"])("refuse %s sans validation commerciale", async cle => {
    vi.stubEnv("GLEBA_STRIPE_SECRET_KEY", cle)
    vi.stubEnv("GLEBA_STRIPE_COMMERCE_VALIDE", "false")
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock)
    await expect(synchroniserAbonnement("sub_synthetique")).rejects.toThrow("commercialisation")
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("refuse une clé publiable ou inconnue", async () => {
    vi.stubEnv("GLEBA_STRIPE_SECRET_KEY", "pk_live_synthetique")
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock)
    await expect(synchroniserAbonnement("sub_synthetique")).rejects.toThrow("pas encore disponibles")
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
