import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Revue Codex du 2026-11-12, SEC-05 : le scan des alertes urgentes attendait
 * l'envoi push AVANT de sceller le courriel livré. Un push lent retardait le
 * scellement (et un arrêt du processus entre-temps renvoyait le courriel au
 * scan suivant) ; un push en échec ne doit pas non plus bloquer l'utilisateur
 * suivant.
 */
const m = vi.hoisted(() => ({
  ordre: [] as string[],
  envoyerPushUtilisateur: vi.fn(),
}))
vi.mock("@/lib/mail", () => ({ sendMail: vi.fn(async () => { m.ordre.push("mail") }), smtpConfigure: vi.fn(async () => true) }))
vi.mock("@/lib/abonnement/serveur", () => ({ serviceAutorise: vi.fn(async () => true) }))
vi.mock("@/lib/settings", () => ({ getSetting: vi.fn(async () => "true") }))
vi.mock("@/lib/unsubscribe", () => ({ getOrCreateUnsubscribeToken: vi.fn(async () => "jeton"), listUnsubscribeHeaders: vi.fn(() => ({})), unsubscribeUrl: vi.fn(() => "https://x/u") }))
vi.mock("./queries", () => ({
  chargerStocksBas: vi.fn(), chargerTachesDuJour: vi.fn(), chargerTachesItpSemaine: vi.fn(), recupererAlertesMeteoJour: vi.fn(), getCoordsUtilisateur: vi.fn(),
  chargerPrefsNotif: vi.fn(async () => ({})),
  getDestinatairesNotifications: vi.fn(async () => [{ id: "u1", email: "u1@example.invalid", name: "U1" }, { id: "u2", email: "u2@example.invalid", name: "U2" }]),
  detecterAlertesUrgentes: vi.fn(async (userId: string) => [{ type: "tache-retard", titre: "T", message: "M", key: `k-${userId}` }]),
}))
vi.mock("./store", () => ({
  alerteDejaEnvoyee: vi.fn(async () => false),
  marquerAlerteEnvoyee: vi.fn(async (cle: string) => { m.ordre.push(`scelle:${cle}`) }),
  nettoyerAlertesEnvoyees: vi.fn(async () => {}), prechargerAlertesEnvoyees: vi.fn(async () => {}),
}))
vi.mock("./prefs", () => ({ auMoinsUneAlerteUrgenteActivee: () => true, typeAlerteEstActivee: () => true, DEFAULT_NOTIF_PREFS: {} }))
vi.mock("./templates", () => ({ alerteUrgenteEmail: () => ({ subject: "s", html: "h" }), alerteMeteoEmail: vi.fn(), resumeQuotidienEmail: vi.fn() }))
vi.mock("@/lib/push", () => ({ construirePayloadAlerteUrgente: () => ({}), envoyerPushUtilisateur: m.envoyerPushUtilisateur }))

import { envoyerAlertesUrgentes } from "./sender"

describe("alertes urgentes et push", () => {
  beforeEach(() => { m.ordre.length = 0; m.envoyerPushUtilisateur.mockReset() })

  it("scelle le courriel livré avant d'attendre le push", async () => {
    m.envoyerPushUtilisateur.mockImplementation(async (userId: string) => { m.ordre.push(`push:${userId}`); return 1 })
    await envoyerAlertesUrgentes()
    expect(m.ordre).toEqual(["mail", "scelle:u1:k-u1", "push:u1", "mail", "scelle:u2:k-u2", "push:u2"])
  })

  it("un push en échec pour un compte n'empêche ni son scellement ni le compte suivant", async () => {
    m.envoyerPushUtilisateur.mockImplementation(async (userId: string) => { if (userId === "u1") throw new Error("panne"); m.ordre.push(`push:${userId}`); return 1 })
    await expect(envoyerAlertesUrgentes()).resolves.toBe(2)
    expect(m.ordre).toContain("scelle:u1:k-u1")
    expect(m.ordre).toContain("push:u2")
  })
})
