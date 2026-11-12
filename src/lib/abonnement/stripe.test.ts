import { createHmac } from "node:crypto"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  abonnementGleba: { findUnique: vi.fn(), findFirst: vi.fn(), findUniqueOrThrow: vi.fn(), upsert: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  evenementAbonnement: { upsert: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  query: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({ default: { ...mocks, $transaction: async (fn: (db: unknown) => unknown) => fn({ abonnementGleba: mocks.abonnementGleba, $queryRaw: mocks.query }) } }))
import { recevoirEvenement, signatureValide, synchroniserAbonnement, creerCheckout, traiterEvenement, arreterAvantSuppression } from "./stripe"

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
/** Base en mémoire : une seule ligne d'abonnement, mêmes filtres que ceux du module. */
function baseEnMemoire(depart: Record<string, unknown>) {
  const etat: Record<string, unknown> = { userId: "ferme-synthetique", gratuitAVie: false, clientStripeId: "cus_synthetique", abonnementStripeId: null, checkoutId: null, checkoutCle: null, checkoutExpireLe: null, formule: null, statut: null, payeJusquau: null, ...depart }
  const date = (v: unknown) => v instanceof Date ? v.getTime() : null
  const correspond = (where: Record<string, unknown>): boolean => Object.entries(where).every(([k, v]) => {
    if (k === "AND") return (v as Record<string, unknown>[]).every(correspond)
    if (k === "OR") return (v as Record<string, unknown>[]).some(correspond)
    if (v && typeof v === "object" && !(v instanceof Date)) {
      const f = v as { not?: unknown, lt?: Date, gt?: Date }
      if ("not" in f) return etat[k] !== null && etat[k] !== f.not
      if (f.lt) return date(etat[k]) !== null && date(etat[k])! < f.lt.getTime()
      if (f.gt) return date(etat[k]) !== null && date(etat[k])! > f.gt.getTime()
    }
    return etat[k] === v
  })
  mocks.abonnementGleba.findUnique.mockImplementation(async () => ({ ...etat }))
  mocks.abonnementGleba.findUniqueOrThrow.mockImplementation(async () => ({ ...etat }))
  mocks.abonnementGleba.findFirst.mockImplementation(async () => ({ ...etat }))
  mocks.abonnementGleba.upsert.mockImplementation(async ({ update }: { update: Record<string, unknown> }) => ({ ...Object.assign(etat, update) }))
  mocks.abonnementGleba.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...Object.assign(etat, data) }))
  mocks.abonnementGleba.updateMany.mockImplementation(async ({ where, data }: { where: Record<string, unknown>, data: Record<string, unknown> }) => {
    if (!correspond(where)) return { count: 0 }
    Object.assign(etat, data); return { count: 1 }
  })
  return etat
}
const reponse = (v: unknown) => new Response(JSON.stringify(v))
const prixValide = { currency: "eur", unit_amount: 1200, recurring: { interval: "month", interval_count: 1 }, active: true, tax_behavior: "exclusive" }

describe("expiration d'un ancien Checkout (PAY-01)", () => {
  beforeEach(() => {
    vi.stubEnv("GLEBA_STRIPE_TAX_MODE", "exempt")
    mocks.user.findUnique.mockResolvedValue({ createdAt: new Date("2026-12-01"), email: "ferme@example.invalid" })
    mocks.evenementAbonnement.findUniqueOrThrow.mockResolvedValue({ id: "evt_expire", type: "checkout.session.expired", objetId: "cs_ancien", traiteLe: null })
  })
  const ancien = { checkoutId: "cs_ancien", checkoutCle: "ancienne-generation", checkoutExpireLe: new Date("2020-01-01"), essaiDebut: new Date("2020-01-01"), essaiFin: new Date("2020-04-01"), statut: "canceled", payeJusquau: new Date("2020-01-01") }

  it.each([
    ["session antérieure, sans génération en métadonnée", {}],
    ["session portant sa génération", { metadata: { glebaCheckoutCle: "ancienne-generation" } }],
  ])("arrivée pendant la création du nouveau paiement, elle ne l'efface pas et les droits s'activent une seule fois : %s", async (_nom, sessionExpiree) => {
    const etat = baseEnMemoire(ancien)
    let generation = ""
    vi.stubGlobal("fetch", vi.fn(async (url: string, opts: { body?: URLSearchParams }) => {
      if (url.includes("/v1/prices/")) return reponse(prixValide)
      if (url.includes("/v1/subscriptions?")) return reponse({ data: [], has_more: false })
      if (url.endsWith("/v1/checkout/sessions")) {
        generation = opts.body!.get("subscription_data[metadata][glebaCheckoutCle]")!
        expect(opts.body!.get("metadata[glebaCheckoutCle]")).toBe(generation)
        await traiterEvenement("evt_expire")
        return reponse({ id: "cs_nouveau", url: "https://checkout.stripe.com/c/pay_qa" })
      }
      if (url.includes("/v1/events/")) return reponse({ data: { object: { id: "cs_ancien", ...sessionExpiree } } })
      if (url.includes("/v1/subscriptions/sub_nouveau")) return reponse(abonnement({ id: "sub_nouveau", metadata: { glebaUserId: "ferme-synthetique", glebaCheckoutCle: generation } }))
      throw new Error("Appel inattendu " + url)
    }))
    await creerCheckout("ferme-synthetique")
    expect(etat.checkoutId).toBe("cs_nouveau")
    expect(etat.checkoutCle).toBe(generation)
    await synchroniserAbonnement("sub_nouveau")
    await synchroniserAbonnement("sub_nouveau")
    expect(etat).toMatchObject({ abonnementStripeId: "sub_nouveau", formule: "complet", statut: "active", payeJusquau: new Date("2027-04-01") })
  })

  it("l'expiration de la session en cours libère bien la tentative", async () => {
    const etat = baseEnMemoire({ ...ancien, checkoutExpireLe: new Date(Date.now() + 600000) })
    vi.stubGlobal("fetch", vi.fn(async () => reponse({ data: { object: { id: "cs_ancien", metadata: { glebaCheckoutCle: "ancienne-generation" } } } })))
    await traiterEvenement("evt_expire")
    expect(etat).toMatchObject({ checkoutId: null, checkoutCle: null, checkoutExpireLe: null })
    expect(mocks.query).toHaveBeenCalled()
  })

  it("une session d'une autre génération ne libère rien", async () => {
    const etat = baseEnMemoire({ ...ancien, checkoutCle: "generation-courante" })
    vi.stubGlobal("fetch", vi.fn(async () => reponse({ data: { object: { id: "cs_ancien", metadata: { glebaCheckoutCle: "ancienne-generation" } } } })))
    await traiterEvenement("evt_expire")
    expect(etat.checkoutCle).toBe("generation-courante")
  })
})

describe("arrêt des prélèvements avant suppression (PAY-02)", () => {
  const actif = { abonnementStripeId: "sub_synthetique", checkoutCle: "generation-qa", formule: "complet", statut: "active", payeJusquau: new Date("2027-02-01") }
  const contrat = { id: "sub_synthetique", status: "active", metadata: { glebaUserId: "ferme-synthetique" }, schedule: "sub_sched_qa" }
  const etapes = ["/v1/checkout/sessions?", "/expire", "/v1/subscriptions?", "/release", "DELETE"]

  it.each(etapes)("une erreur réseau à l'étape %s ne laisse aucun marqueur, la synchronisation reprend et la suppression se rejoue", async etape => {
    const etat = baseEnMemoire(actif)
    let panne = true
    const appels: string[] = []
    vi.stubGlobal("fetch", vi.fn(async (url: string, opts: { method: string }) => {
      appels.push(opts.method + " " + url)
      if (panne && (etape === "DELETE" ? opts.method === "DELETE" : url.includes(etape))) throw new Error("timeout synthétique")
      if (url.includes("/v1/checkout/sessions?")) return reponse({ data: [{ id: "cs_ouvert" }], has_more: false })
      if (url.includes("/v1/subscriptions?")) return reponse({ data: [contrat], has_more: false })
      if (url.includes("/v1/subscriptions/sub_synthetique") && opts.method === "GET") return reponse(abonnement())
      return reponse({})
    }))
    await expect(arreterAvantSuppression("ferme-synthetique")).rejects.toThrow()
    expect(etat.statut).toBe("active")
    expect(etat.checkoutExpireLe).toBeNull()
    await synchroniserAbonnement("sub_synthetique")
    expect(etat.payeJusquau).toEqual(new Date("2027-04-01"))
    panne = false
    appels.length = 0
    await arreterAvantSuppression("ferme-synthetique")
    expect(appels).toContain("DELETE https://api.stripe.com/v1/subscriptions/sub_synthetique")
    expect(etat.statut).toBe("suppression")
    expect((etat.checkoutExpireLe as Date).getTime()).toBeLessThanOrEqual(Date.now() + 15 * 60 * 1000)
  })

  it("sans compte de facturation, le marqueur est posé quand même : un premier paiement lancé pendant le cascade est refusé sans rien créer chez le prestataire", async () => {
    vi.stubEnv("GLEBA_STRIPE_TAX_MODE", "exempt")
    mocks.user.findUnique.mockResolvedValue({ createdAt: new Date("2026-12-01"), email: "ferme@example.invalid" })
    const etat = baseEnMemoire({ clientStripeId: null, essaiDebut: new Date("2020-01-01"), essaiFin: new Date("2020-04-01") })
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/v1/prices/")) return reponse(prixValide)
      throw new Error("Appel inattendu " + url)
    })
    vi.stubGlobal("fetch", fetchMock)
    await arreterAvantSuppression("ferme-synthetique")
    expect(etat.statut).toBe("suppression")
    await expect(creerCheckout("ferme-synthetique")).rejects.toThrow("déjà en cours")
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/v1/customers") || String(url).includes("/v1/checkout/sessions"))).toBe(false)
    expect(etat.clientStripeId).toBeNull()
  })

  it("le marqueur protège le cascade puis s'éteint : la synchronisation n'est jamais coupée définitivement", async () => {
    const etat = baseEnMemoire({ ...actif, statut: "suppression", checkoutExpireLe: new Date(Date.now() + 5 * 60 * 1000) })
    vi.stubGlobal("fetch", vi.fn(async () => reponse(abonnement())))
    await synchroniserAbonnement("sub_synthetique")
    expect(etat.statut).toBe("suppression")
    for (const perime of [new Date(Date.now() - 1000), new Date("9000-01-01")]) {
      Object.assign(etat, { statut: "suppression", checkoutExpireLe: perime })
      await synchroniserAbonnement("sub_synthetique")
      expect(etat.statut).toBe("active")
    }
  })

  it("un marqueur périmé ne bloque pas une nouvelle souscription, un marqueur en cours si", async () => {
    vi.stubEnv("GLEBA_STRIPE_TAX_MODE", "exempt")
    mocks.user.findUnique.mockResolvedValue({ createdAt: new Date("2026-12-01"), email: "ferme@example.invalid" })
    const essaiFini = { essaiDebut: new Date("2020-01-01"), essaiFin: new Date("2020-04-01") }
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/v1/prices/")) return reponse(prixValide)
      if (url.includes("/v1/subscriptions?")) return reponse({ data: [], has_more: false })
      return reponse({ id: "cs_nouveau", url: "https://checkout.stripe.com/c/pay_qa" })
    }))
    baseEnMemoire({ ...essaiFini, statut: "suppression", checkoutExpireLe: new Date(Date.now() + 5 * 60 * 1000) })
    await expect(creerCheckout("ferme-synthetique")).rejects.toThrow("déjà en cours")
    const etat = baseEnMemoire({ ...essaiFini, statut: "suppression", checkoutExpireLe: new Date("9000-01-01") })
    await creerCheckout("ferme-synthetique")
    expect(etat).toMatchObject({ checkoutId: "cs_nouveau", statut: null })
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

/**
 * Revue Codex du 2026-11-12, AB-01. Stripe exige un `expires_at` compris entre
 * 30 minutes et 24 heures APRÈS la création de la session
 * (https://docs.stripe.com/api/checkout/sessions/create, paramètre
 * expires_at, vérifié le 2026-11-12). L'expiration était calculée sur
 * l'instant capturé AVANT la création du client Stripe : chaque seconde
 * écoulée la faisait passer sous les 30 minutes.
 */
describe("expiration de Checkout et bail de souscription (AB-01)", () => {
  const essaiFini = { clientStripeId: null, essaiDebut: new Date("2020-01-01"), essaiFin: new Date("2020-04-01") }
  beforeEach(() => {
    vi.stubEnv("GLEBA_STRIPE_TAX_MODE", "exempt")
    mocks.user.findUnique.mockResolvedValue({ createdAt: new Date("2026-12-01"), email: "ferme@example.invalid" })
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2030-01-01T12:00:00Z"))
  })
  afterEach(() => vi.useRealTimers())

  function stripeSimule(session: (body: URLSearchParams) => Promise<Response> | Response, latenceClientMs = 0) {
    const envoi = { expiresAt: 0, instantPost: 0 }
    vi.stubGlobal("fetch", vi.fn(async (url: string, opts: { body?: URLSearchParams }) => {
      if (url.includes("/v1/prices/")) return reponse(prixValide)
      if (url.includes("/v1/subscriptions?")) return reponse({ data: [], has_more: false })
      if (url.endsWith("/v1/customers")) { vi.setSystemTime(Date.now() + latenceClientMs); return reponse({ id: "cus_qa" }) }
      if (url.endsWith("/v1/checkout/sessions")) {
        envoi.expiresAt = Number(opts.body!.get("expires_at"))
        envoi.instantPost = Math.floor(Date.now() / 1000)
        return session(opts.body!)
      }
      throw new Error("Appel inattendu " + url)
    }))
    return envoi
  }

  it("demande au moins 30 minutes plus une marge, comptées au moment du POST, même après une création de client lente", async () => {
    const etat = baseEnMemoire(essaiFini)
    const envoi = stripeSimule(() => reponse({ id: "cs_qa", url: "https://checkout.stripe.com/c/qa" }), 9000)
    await creerCheckout("ferme-synthetique")
    expect(envoi.expiresAt - envoi.instantPost).toBeGreaterThanOrEqual(1800 + 60)
    expect(envoi.expiresAt - envoi.instantPost).toBeLessThanOrEqual(24 * 3600)
    // Le bail couvre toute la vie de la session demandée.
    expect((etat.checkoutExpireLe as Date).getTime() / 1000).toBeGreaterThanOrEqual(envoi.expiresAt)
  })

  it("un refus sûr de Stripe (4xx) libère le bail : la session n'existe pas", async () => {
    const etat = baseEnMemoire(essaiFini)
    stripeSimule(() => new Response(JSON.stringify({ error: { type: "invalid_request_error" } }), { status: 400 }))
    await expect(creerCheckout("ferme-synthetique")).rejects.toThrow()
    expect(etat.checkoutExpireLe).toBeNull()
  })

  it("un délai réseau ou une erreur 5xx garde le bail : la session a pu être créée", async () => {
    for (const panne of [() => { throw new DOMException("délai", "TimeoutError") }, () => new Response("{}", { status: 502 })]) {
      const etat = baseEnMemoire(essaiFini)
      stripeSimule(panne as () => Response)
      await expect(creerCheckout("ferme-synthetique")).rejects.toThrow()
      expect(etat.checkoutExpireLe).not.toBeNull()
    }
  })

  it("une configuration de TVA absente refuse avant tout bail et toute session", async () => {
    vi.stubEnv("GLEBA_STRIPE_TAX_MODE", "")
    const etat = baseEnMemoire(essaiFini)
    const envoi = stripeSimule(() => reponse({ id: "cs_qa", url: "https://checkout.stripe.com/c/qa" }))
    await expect(creerCheckout("ferme-synthetique")).rejects.toThrow("TVA")
    expect(envoi.expiresAt).toBe(0)
    expect(etat.checkoutExpireLe).toBeNull()
  })
})
