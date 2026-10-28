import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  refusSiCompteDemo: vi.fn(),
  connecteurCount: vi.fn(),
  connecteurCreate: vi.fn(),
  exploitationFindUnique: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({
  requireAuthApi: mocks.requireAuthApi,
  getUserId: (s: { user: { id: string } }) => s.user.id,
}))
vi.mock("@/lib/demo-garde", () => ({
  refusSiCompteDemo: mocks.refusSiCompteDemo,
  MESSAGES_REFUS_DEMO: { connecteurCapteurs: "Compte de démonstration" },
}))
vi.mock("@/lib/prisma", () => ({
  default: {
    connecteurCapteurs: { count: mocks.connecteurCount, create: mocks.connecteurCreate },
    exploitation: { findUnique: mocks.exploitationFindUnique },
  },
}))

import { POST } from "./route"
import { hacherJeton } from "@/lib/capteurs/jeton"

function post(corps: unknown) {
  return POST(new Request("http://localhost/api/capteurs/connecteurs", { method: "POST", body: JSON.stringify(corps) }))
}

describe("POST /api/capteurs/connecteurs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "proprio", estProprietaireExploitation: true } } })
    mocks.refusSiCompteDemo.mockResolvedValue(null)
    mocks.connecteurCount.mockResolvedValue(0)
    mocks.exploitationFindUnique.mockResolvedValue({ territoire: "NOUVELLE_CALEDONIE" })
    mocks.connecteurCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "conn-1", ...data }))
  })

  it("rend le jeton une fois et n'en stocke que l'empreinte et le début", async () => {
    const r = await post({ nom: "TTN de la ferme", type: "ttn" })
    expect(r.status).toBe(201)
    const { jeton } = await r.json()
    expect(jeton).toMatch(/^glc_[0-9a-f]{48}$/)

    const { data } = mocks.connecteurCreate.mock.calls[0][0]
    expect(data).toMatchObject({ userId: "proprio", type: "ttn", jetonHash: hacherJeton(jeton), jetonPrefixe: jeton.slice(0, 12) })
    expect(JSON.stringify(data)).not.toContain(jeton)
  })

  it("compte les jours à l'heure du territoire de l'exploitation", async () => {
    await post({ nom: "TTN", type: "ttn" })
    expect(mocks.connecteurCreate.mock.calls[0][0].data.fuseau).toBe("Pacific/Noumea")
  })

  it("est réservé au propriétaire de l'exploitation", async () => {
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "proprio", estProprietaireExploitation: false } } })
    expect((await post({ nom: "TTN", type: "ttn" })).status).toBe(403)
    expect(mocks.connecteurCreate).not.toHaveBeenCalled()
  })

  it("est refusé sur le compte de démonstration", async () => {
    mocks.refusSiCompteDemo.mockResolvedValue(NextResponse.json({ error: "démo", code: "COMPTE_DEMO" }, { status: 403 }))
    expect((await post({ nom: "TTN", type: "ttn" })).status).toBe(403)
    expect(mocks.connecteurCreate).not.toHaveBeenCalled()
  })

  it("refuse un type inconnu et plafonne le nombre de connecteurs", async () => {
    expect((await post({ nom: "X", type: "meshtastic" })).status).toBe(400)
    mocks.connecteurCount.mockResolvedValue(10)
    expect((await post({ nom: "X", type: "ttn" })).status).toBe(409)
    expect(mocks.connecteurCreate).not.toHaveBeenCalled()
  })
})
