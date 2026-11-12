import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Revue Codex du 2026-11-12, SEC-05 : l'abonnement acceptait tout endpoint
 * commençant par https (boucle locale, réseau privé), sans quota par compte.
 */
const mocks = vi.hoisted(() => ({
  upsert: vi.fn(async () => ({})),
  count: vi.fn(async () => 0),
  findMany: vi.fn(async () => [] as Array<{ id: number }>),
  deleteMany: vi.fn(async () => ({ count: 0 })),
  findUnique: vi.fn(async () => null),
  executeRaw: vi.fn(async () => 0),
}))
vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: vi.fn(async () => ({ error: null, session: { user: { id: "u1" } } })) }))
vi.mock("@/lib/prisma", () => {
  const pushSubscription = { upsert: mocks.upsert, count: mocks.count, findMany: mocks.findMany, deleteMany: mocks.deleteMany, findUnique: mocks.findUnique }
  const tx = { pushSubscription, $executeRaw: mocks.executeRaw }
  return { default: { ...tx, $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } }
})

import { POST } from "./route"

const requete = (endpoint: string) => new Request("https://gleba.test/api/notifications/push/subscribe", {
  method: "POST", body: JSON.stringify({ endpoint, keys: { p256dh: "cle", auth: "auth" } }), headers: { "content-type": "application/json" },
}) as never

describe("POST /api/notifications/push/subscribe", () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    "https://127.0.0.1/x", "https://127.1.2.3:8443/x", "https://localhost/x", "https://admin.localhost/x",
    "https://10.0.0.5/x", "https://172.16.4.1/x", "https://192.168.1.10/x", "https://169.254.169.254/latest",
    "https://100.64.0.1/x", "https://[::1]/x", "https://[fd00::1]/x", "https://[fe80::1]/x", "https://[::ffff:127.0.0.1]/x",
    "https://0.0.0.0/x", "https://2130706433/x", "https://interne/x", "https://user:mdp@fcm.googleapis.com/x",
    "https://fcm.googleapis.com:8443/fcm/send/abc", "http://fcm.googleapis.com/x",
  ])("refuse l'endpoint non public %s", async (endpoint) => {
    const res = await POST(requete(endpoint))
    expect(res.status).toBe(400)
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it.each([
    "https://fcm.googleapis.com/fcm/send/abc", "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://web.push.apple.com/QAbc", "https://fcm.googleapis.com:443/fcm/send/abc",
  ])("accepte l'endpoint public %s", async (endpoint) => {
    const res = await POST(requete(endpoint))
    expect(res.status).toBe(200)
    expect(mocks.upsert).toHaveBeenCalledOnce()
  })

  it("borne le nombre d'abonnements du compte en retirant les plus anciens", async () => {
    mocks.count.mockResolvedValueOnce(10)
    mocks.findMany.mockResolvedValueOnce([{ id: 1 }])
    const res = await POST(requete("https://fcm.googleapis.com/fcm/send/nouveau"))
    expect(res.status).toBe(200)
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [1] } } })
  })
})
