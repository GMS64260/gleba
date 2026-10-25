/**
 * DELETE /api/communaute/salon/[id] — seul l'auteur ou l'équipe retire un message.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  userFindUnique: vi.fn(),
  findUnique: vi.fn(),
  deleteMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: mocks.userFindUnique },
    messageSalon: { findUnique: mocks.findUnique, deleteMany: mocks.deleteMany },
  },
}))

import { DELETE } from "./route"

function connecter(acteurId: string, role = "USER", tenant = acteurId) {
  mocks.requireAuthApi.mockResolvedValue({
    error: null,
    session: { user: { id: tenant, acteurId, role } },
  })
}

function supprimer(id = "m1") {
  return DELETE(new Request(`http://localhost/api/communaute/salon/${id}`, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.userFindUnique.mockResolvedValue({ email: "membre@exemple.fr" })
  mocks.findUnique.mockResolvedValue({ userId: "auteur" })
  mocks.deleteMany.mockResolvedValue({ count: 1 })
})

describe("DELETE /api/communaute/salon/[id]", () => {
  it("l'auteur retire son message", async () => {
    connecter("auteur")

    const res = await supprimer()

    expect(res.status).toBe(200)
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: "m1" } })
  })

  it("un membre invité retire SON message, même dans l'exploitation d'un autre", async () => {
    connecter("auteur", "USER", "exploitation-1")

    expect((await supprimer()).status).toBe(200)
  })

  it("un autre membre ne peut pas le retirer", async () => {
    connecter("voisin")

    const res = await supprimer()

    expect(res.status).toBe(403)
    expect(mocks.deleteMany).not.toHaveBeenCalled()
  })

  it("le titulaire de l'exploitation ne retire pas le message de son invité", async () => {
    // L'exploitation n'est pas l'auteur : seule la personne compte.
    connecter("titulaire", "USER", "auteur")

    expect((await supprimer()).status).toBe(403)
  })

  it("l'équipe retire n'importe quel message", async () => {
    connecter("admin", "ADMIN")

    expect((await supprimer()).status).toBe(200)
    expect(mocks.deleteMany).toHaveBeenCalled()
  })

  it("404 pour un message inexistant", async () => {
    connecter("auteur")
    mocks.findUnique.mockResolvedValue(null)

    expect((await supprimer("absent")).status).toBe(404)
    expect(mocks.deleteMany).not.toHaveBeenCalled()
  })

  it("le compte de démonstration est refusé avant toute lecture", async () => {
    connecter("demo")
    mocks.userFindUnique.mockResolvedValue({ email: "demo@gleba.fr" })

    const res = await supprimer()

    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe("COMPTE_DEMO")
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })
})
