import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_NOTIF_PREFS, TOUTES_NOTIF_PREFS } from "./prefs"

const m = vi.hoisted(() => ({
  ordre: [] as string[],
  bdd: new Map<string, { key: string; data: unknown; expiresAt: Date }>(),
  envoyerPushUtilisateur: vi.fn(),
  pushConfigure: vi.fn(),
  sendMail: vi.fn(),
  smtpConfigure: vi.fn(),
  getSetting: vi.fn(),
  chargerPrefsNotif: vi.fn(),
  detecterAlertesUrgentes: vi.fn(),
  getDestinatairesNotifications: vi.fn(),
  getOrCreateUnsubscribeToken: vi.fn(),
}))
vi.mock("@/lib/mail", () => ({ sendMail: m.sendMail, smtpConfigure: m.smtpConfigure }))
vi.mock("@/lib/abonnement/serveur", () => ({ serviceAutorise: vi.fn(async () => true) }))
vi.mock("@/lib/settings", () => ({ getSetting: m.getSetting }))
vi.mock("@/lib/unsubscribe", () => ({ getOrCreateUnsubscribeToken: m.getOrCreateUnsubscribeToken, listUnsubscribeHeaders: () => ({}), unsubscribeUrl: () => "https://example.invalid/u" }))
vi.mock("./queries", () => ({
  chargerStocksBas: vi.fn(async () => []), chargerTachesDuJour: vi.fn(async () => []), chargerTachesItpSemaine: vi.fn(async () => []), recupererAlertesMeteoJour: vi.fn(async () => []), getCoordsUtilisateur: vi.fn(async () => []),
  chargerPrefsNotif: m.chargerPrefsNotif,
  getDestinatairesNotifications: m.getDestinatairesNotifications,
  detecterAlertesUrgentes: m.detecterAlertesUrgentes,
}))
// Vrai store, base simulée conservée quand la mémoire du processus est vidée.
vi.mock("@/lib/prisma", () => ({ default: { genericCache: {
  findUnique: vi.fn(async ({ where }: { where: { key: string } }) => m.bdd.get(where.key) ?? null),
  findMany: vi.fn(async () => [...m.bdd.values()]),
  upsert: vi.fn(async ({ create }: { create: { key: string; data: unknown; expiresAt: Date } }) => {
    m.bdd.set(create.key, create)
    m.ordre.push(`scelle:${create.key.replace("notif:envoyee:", "")}`)
    return create
  }),
  deleteMany: vi.fn(async () => ({ count: 0 })),
} } }))
vi.mock("./templates", () => ({ alerteUrgenteEmail: () => ({ subject: "s", html: "h" }), alerteMeteoEmail: vi.fn(), resumeQuotidienEmail: () => ({ subject: "résumé", html: "h" }) }))
vi.mock("@/lib/push", () => ({ construirePayloadAlerteUrgente: () => ({}), envoyerPushUtilisateur: m.envoyerPushUtilisateur, pushConfigure: m.pushConfigure }))

import { envoyerAlertesMeteoTempsReel, envoyerAlertesUrgentes, envoyerResumeQuotidien, notificationsEnabled } from "./sender"
import { marquerAlerteEnvoyee, resetStorePourTests } from "./store"

beforeEach(() => {
  vi.clearAllMocks()
  resetStorePourTests()
  m.bdd.clear()
  m.ordre.length = 0
  m.getSetting.mockResolvedValue(true)
  m.smtpConfigure.mockResolvedValue(true)
  m.pushConfigure.mockResolvedValue(true)
  m.getOrCreateUnsubscribeToken.mockResolvedValue("jeton")
  m.chargerPrefsNotif.mockResolvedValue({ ...TOUTES_NOTIF_PREFS })
  m.getDestinatairesNotifications.mockResolvedValue([
    { id: "u1", email: "u1@example.invalid", name: "U1" },
    { id: "u2", email: "u2@example.invalid", name: "U2" },
  ])
  m.detecterAlertesUrgentes.mockResolvedValue([{ type: "tache-retard", titre: "T", message: "M", key: "k" }])
  m.sendMail.mockImplementation(async () => { m.ordre.push("mail") })
  m.envoyerPushUtilisateur.mockImplementation(async (userId: string) => { m.ordre.push(`push:${userId}`); return 1 })
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
})
afterEach(() => { vi.restoreAllMocks() })

describe("alertes urgentes et push", () => {
  it("tente et accepte le push sans SMTP, sans appeler sendMail", async () => {
    m.smtpConfigure.mockResolvedValue(false)
    await expect(envoyerAlertesUrgentes()).resolves.toBe(2)
    expect(m.envoyerPushUtilisateur).toHaveBeenCalledTimes(2)
    expect(m.sendMail).not.toHaveBeenCalled()
    expect(m.getOrCreateUnsubscribeToken).not.toHaveBeenCalled()
  })

  it("scelle le courriel livré avant d'attendre le push", async () => {
    await expect(envoyerAlertesUrgentes()).resolves.toBe(2)
    expect(m.ordre).toEqual(["mail", "scelle:u1:k", "push:u1", "scelle:u1:push:k", "mail", "scelle:u2:k", "push:u2", "scelle:u2:push:k"])
  })

  it("un push en échec pour un compte n'empêche ni son scellement ni le compte suivant", async () => {
    m.envoyerPushUtilisateur.mockImplementation(async (userId: string) => { if (userId === "u1") throw new Error("panne"); m.ordre.push(`push:${userId}`); return 1 })
    await expect(envoyerAlertesUrgentes()).resolves.toBe(2)
    expect(m.ordre).toContain("scelle:u1:k")
    expect(m.ordre).toContain("push:u2")
    expect(m.bdd.has("notif:envoyee:u1:push:k")).toBe(false)
    await expect(envoyerAlertesUrgentes()).resolves.toBe(0)
    expect(m.sendMail).toHaveBeenCalledTimes(2)
    expect(m.envoyerPushUtilisateur).toHaveBeenCalledTimes(3)
  })

  it("un SMTP en échec laisse le mail rejouable après un push accepté", async () => {
    m.sendMail.mockRejectedValue(new Error("SMTP indisponible"))
    await expect(envoyerAlertesUrgentes()).resolves.toBe(2)
    expect(m.bdd.has("notif:envoyee:u1:k")).toBe(false)
    m.sendMail.mockResolvedValue(undefined)
    resetStorePourTests()
    await expect(envoyerAlertesUrgentes()).resolves.toBe(2)
    expect(m.sendMail).toHaveBeenCalledTimes(4)
    expect(m.envoyerPushUtilisateur).toHaveBeenCalledTimes(2)
  })

  it("ne retente aucun canal acquitté lors du scan suivant ou après rechargement du store", async () => {
    await expect(envoyerAlertesUrgentes()).resolves.toBe(2)
    await expect(envoyerAlertesUrgentes()).resolves.toBe(0)
    resetStorePourTests()
    await expect(envoyerAlertesUrgentes()).resolves.toBe(0)
    expect(m.sendMail).toHaveBeenCalledTimes(2)
    expect(m.envoyerPushUtilisateur).toHaveBeenCalledTimes(2)
  })

  it("un mail déjà scellé par une clé historique n'acquitte pas le push ni un autre compte", async () => {
    await marquerAlerteEnvoyee("u1:k")
    resetStorePourTests()
    await expect(envoyerAlertesUrgentes()).resolves.toBe(2)
    expect(m.sendMail).toHaveBeenCalledTimes(1)
    expect(m.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "u2@example.invalid" }))
    expect(m.envoyerPushUtilisateur).toHaveBeenCalledTimes(2)
  })

  it("la réactivation du SMTP envoie le mail restant sans second push", async () => {
    m.smtpConfigure.mockResolvedValue(false)
    await expect(envoyerAlertesUrgentes()).resolves.toBe(2)
    m.smtpConfigure.mockResolvedValue(true)
    resetStorePourTests()
    await expect(envoyerAlertesUrgentes()).resolves.toBe(2)
    expect(m.sendMail).toHaveBeenCalledTimes(2)
    expect(m.envoyerPushUtilisateur).toHaveBeenCalledTimes(2)
  })

  it("le push absent ne bloque pas le mail", async () => {
    m.pushConfigure.mockResolvedValue(false)
    await expect(envoyerAlertesUrgentes()).resolves.toBe(2)
    expect(m.sendMail).toHaveBeenCalledTimes(2)
    expect(m.envoyerPushUtilisateur).not.toHaveBeenCalled()
  })

  it("ne détecte rien quand aucun canal n'est prêt", async () => {
    m.smtpConfigure.mockResolvedValue(false)
    m.pushConfigure.mockResolvedValue(false)
    await expect(envoyerAlertesUrgentes()).resolves.toBe(0)
    expect(m.getDestinatairesNotifications).not.toHaveBeenCalled()
    expect(m.sendMail).not.toHaveBeenCalled()
    expect(m.envoyerPushUtilisateur).not.toHaveBeenCalled()
  })

  it("respecte notif.enabled=false même avec les deux canaux prêts", async () => {
    m.getSetting.mockResolvedValue(false)
    await expect(envoyerAlertesUrgentes()).resolves.toBe(0)
    expect(m.detecterAlertesUrgentes).not.toHaveBeenCalled()
    expect(m.sendMail).not.toHaveBeenCalled()
    expect(m.envoyerPushUtilisateur).not.toHaveBeenCalled()
  })

  it("respecte les préférences et leur repli désactivé sur les deux canaux", async () => {
    m.chargerPrefsNotif.mockResolvedValue({ ...DEFAULT_NOTIF_PREFS })
    await expect(envoyerAlertesUrgentes()).resolves.toBe(0)
    expect(m.detecterAlertesUrgentes).not.toHaveBeenCalled()
    m.chargerPrefsNotif.mockResolvedValue({ ...DEFAULT_NOTIF_PREFS, stocks: true })
    await expect(envoyerAlertesUrgentes()).resolves.toBe(0)
    m.chargerPrefsNotif.mockRejectedValue(new Error("lecture indisponible"))
    await expect(envoyerAlertesUrgentes()).resolves.toBe(0)
    expect(m.sendMail).not.toHaveBeenCalled()
    expect(m.envoyerPushUtilisateur).not.toHaveBeenCalled()
  })

  it.each([0, "erreur"])("ne compte ni ne scelle un push non accepté (%s)", async (resultat) => {
    m.smtpConfigure.mockResolvedValue(false)
    if (resultat === "erreur") m.envoyerPushUtilisateur.mockRejectedValue(new Error("panne"))
    else m.envoyerPushUtilisateur.mockResolvedValue(resultat)
    await expect(envoyerAlertesUrgentes()).resolves.toBe(0)
    expect(m.bdd.size).toBe(0)
    await expect(envoyerAlertesUrgentes()).resolves.toBe(0)
    expect(m.envoyerPushUtilisateur).toHaveBeenCalledTimes(4)
  })

  it("compte une seule alerte même acceptée par plusieurs navigateurs et par mail", async () => {
    m.envoyerPushUtilisateur.mockResolvedValue(3)
    await expect(envoyerAlertesUrgentes()).resolves.toBe(2)
  })

  it("borne aussi un scan exclusivement push à 15 alertes acceptées par compte", async () => {
    m.smtpConfigure.mockResolvedValue(false)
    m.detecterAlertesUrgentes.mockResolvedValue(Array.from({ length: 20 }, (_, i) => ({ type: "tache-retard", titre: "T", message: "M", key: `k${i}` })))
    await expect(envoyerAlertesUrgentes()).resolves.toBe(30)
    expect(m.envoyerPushUtilisateur).toHaveBeenCalledTimes(30)
  })
})

describe("canaux exclusivement mail conservés", () => {
  it("la garde globale reflète l'activation indépendamment du SMTP", async () => {
    m.smtpConfigure.mockResolvedValue(false)
    await expect(notificationsEnabled()).resolves.toBe(true)
  })

  it("ne tente ni résumé ni météo sans SMTP, même si VAPID est prêt", async () => {
    m.smtpConfigure.mockResolvedValue(false)
    await expect(envoyerResumeQuotidien()).resolves.toBe(0)
    await expect(envoyerAlertesMeteoTempsReel()).resolves.toBe(0)
    expect(m.getDestinatairesNotifications).not.toHaveBeenCalled()
    expect(m.sendMail).not.toHaveBeenCalled()
    expect(m.envoyerPushUtilisateur).not.toHaveBeenCalled()
  })

  it("le résumé garde son acquittement mail après rechargement et ne fait aucun push", async () => {
    await expect(envoyerResumeQuotidien()).resolves.toBe(2)
    resetStorePourTests()
    await expect(envoyerResumeQuotidien()).resolves.toBe(0)
    expect(m.sendMail).toHaveBeenCalledTimes(2)
    expect(m.envoyerPushUtilisateur).not.toHaveBeenCalled()
  })

  it("un échec SMTP laisse le résumé rejouable", async () => {
    m.sendMail.mockRejectedValue(new Error("panne SMTP"))
    await expect(envoyerResumeQuotidien()).resolves.toBe(0)
    expect(m.bdd.size).toBe(0)
    m.sendMail.mockResolvedValue(undefined)
    await expect(envoyerResumeQuotidien()).resolves.toBe(2)
  })
})

it("un rechargement des modules conserve les acquittements mail et push en base", async () => {
  await expect(envoyerAlertesUrgentes()).resolves.toBe(2)
  vi.resetModules()
  const senderRecharge = await import("./sender")
  await expect(senderRecharge.envoyerAlertesUrgentes()).resolves.toBe(0)
  expect(m.sendMail).toHaveBeenCalledTimes(2)
  expect(m.envoyerPushUtilisateur).toHaveBeenCalledTimes(2)
})
