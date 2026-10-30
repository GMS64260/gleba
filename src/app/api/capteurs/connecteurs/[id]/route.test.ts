import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  refusSiCompteDemo: vi.fn(),
  connecteurFindFirst: vi.fn(),
  connecteurUpdate: vi.fn(),
  connecteurDelete: vi.fn(),
  executeRaw: vi.fn(),
  queryRaw: vi.fn(),
  agregatsDeleteMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({
  requireAuthApi: mocks.requireAuthApi,
  getUserId: (s: { user: { id: string } }) => s.user.id,
}))
vi.mock("@/lib/demo-garde", () => ({
  refusSiCompteDemo: mocks.refusSiCompteDemo,
  MESSAGES_REFUS_DEMO: { connecteurCapteurs: "Compte de démonstration" },
}))
vi.mock("@/lib/prisma", () => {
  const client = {
    connecteurCapteurs: { findFirst: mocks.connecteurFindFirst, update: mocks.connecteurUpdate, delete: mocks.connecteurDelete },
    mesureCapteurJour: { deleteMany: mocks.agregatsDeleteMany },
    $executeRaw: mocks.executeRaw,
    $queryRaw: mocks.queryRaw,
  }
  return { default: { ...client, $transaction: (action: (tx: typeof client) => Promise<unknown>) => action(client) } }
})

import { DELETE, PATCH } from "./route"
import { hacherJeton } from "@/lib/capteurs/jeton"

const contexte = { params: Promise.resolve({ id: "conn-1" }) }

function patch(corps: unknown) {
  return PATCH(new Request("http://localhost/api/capteurs/connecteurs/conn-1", { method: "PATCH", body: JSON.stringify(corps) }), contexte)
}

function supprimer() {
  return DELETE(new Request("http://localhost/api/capteurs/connecteurs/conn-1", { method: "DELETE" }), contexte)
}

describe("/api/capteurs/connecteurs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "proprio", estProprietaireExploitation: true } } })
    mocks.refusSiCompteDemo.mockResolvedValue(null)
    mocks.connecteurFindFirst.mockResolvedValue({ id: "conn-1", fuseau: "Europe/Paris" })
    mocks.connecteurUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "conn-1", ...data }))
    mocks.queryRaw.mockResolvedValue([])
  })

  it("ne trouve pas le connecteur d'un autre compte", async () => {
    mocks.connecteurFindFirst.mockResolvedValue(null)
    expect((await patch({ nom: "x" })).status).toBe(404)
    expect(mocks.connecteurFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "conn-1", userId: "proprio" } }))
    expect((await supprimer()).status).toBe(404)
    expect(mocks.connecteurUpdate).not.toHaveBeenCalled()
    expect(mocks.connecteurDelete).not.toHaveBeenCalled()
  })

  it("régénère le jeton : le nouveau est rendu une fois, seule son empreinte est stockée", async () => {
    const r = await patch({ regenererJeton: true })
    const { jeton } = await r.json()
    expect(jeton).toMatch(/^glc_[0-9a-f]{48}$/)
    const { data } = mocks.connecteurUpdate.mock.calls[0][0]
    expect(data).toMatchObject({ jetonHash: hacherJeton(jeton), jetonPrefixe: jeton.slice(0, 12) })
    expect(JSON.stringify(data)).not.toContain(jeton)
  })

  it("ne rend aucun jeton quand on ne le régénère pas", async () => {
    const corps = await (await patch({ actif: false })).json()
    expect(corps.jeton).toBeUndefined()
    expect(mocks.connecteurUpdate.mock.calls[0][0].data).toEqual({ actif: false })
  })

  it("change le fuseau dans la liste proposée seulement", async () => {
    expect((await patch({ fuseau: "Pacific/Noumea" })).status).toBe(200)
    expect(mocks.connecteurUpdate.mock.calls[0][0].data).toEqual({ fuseau: "Pacific/Noumea" })
    expect(mocks.agregatsDeleteMany).toHaveBeenCalledWith({ where: { capteur: { connecteurId: "conn-1" } } })
    expect((await patch({ fuseau: "Europe/Paris'; DROP TABLE capteurs; --" })).status).toBe(400)
    expect((await patch({ fuseau: "Asia/Tokyo" })).status).toBe(400)
  })

  it("refuse un changement irréconstructible après purge, sans effacer les agrégats", async () => {
    mocks.queryRaw.mockResolvedValue([{ id: 1 }])
    const reponse = await patch({ fuseau: "Pacific/Noumea" })
    expect(reponse.status).toBe(409)
    expect((await reponse.json()).error).toContain("purgées")
    expect(mocks.agregatsDeleteMany).not.toHaveBeenCalled()
  })

  it("corrige un fuseau stocké invalide (sauvegarde importée) sans le passer au SQL ni effacer d'agrégat", async () => {
    mocks.connecteurFindFirst.mockResolvedValue({ id: "conn-1", fuseau: "Mars/Olympus" })
    const reponse = await patch({ fuseau: "Europe/Paris" })
    expect(reponse.status).toBe(200)
    expect(mocks.connecteurUpdate.mock.calls[0][0].data).toEqual({ fuseau: "Europe/Paris" })
    expect(mocks.agregatsDeleteMany).not.toHaveBeenCalled()
    // Seule l'agrégation du connecteur, dans le nouveau fuseau stocké.
    expect(mocks.queryRaw).toHaveBeenCalledTimes(1)
    const [requete] = mocks.queryRaw.mock.calls[0]
    expect(requete.sql).toContain('INSERT INTO "mesures_capteurs_jours"')
    expect(requete.values).toContain("conn-1")
    expect(mocks.queryRaw.mock.calls.flat(2).some((v) => JSON.stringify(v ?? null).includes("Mars/Olympus"))).toBe(false)
  })

  it("ne reconstruit pas les agrégats si le fuseau est inchangé", async () => {
    expect((await patch({ fuseau: "Europe/Paris" })).status).toBe(200)
    expect(mocks.agregatsDeleteMany).not.toHaveBeenCalled()
  })

  it("est réservé au propriétaire", async () => {
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "proprio", estProprietaireExploitation: false } } })
    expect((await patch({ regenererJeton: true })).status).toBe(403)
    expect((await supprimer()).status).toBe(403)
    expect(mocks.connecteurUpdate).not.toHaveBeenCalled()
    expect(mocks.connecteurDelete).not.toHaveBeenCalled()
  })

  it("est refusé sur le compte de démonstration", async () => {
    mocks.refusSiCompteDemo.mockResolvedValue(NextResponse.json({ error: "démo", code: "COMPTE_DEMO" }, { status: 403 }))
    expect((await patch({ regenererJeton: true })).status).toBe(403)
    expect((await supprimer()).status).toBe(403)
    expect(mocks.connecteurDelete).not.toHaveBeenCalled()
  })

  it("supprime le connecteur du compte (capteurs et mesures en cascade)", async () => {
    expect((await supprimer()).status).toBe(200)
    expect(mocks.connecteurDelete).toHaveBeenCalledWith({ where: { id: "conn-1" } })
  })
})
