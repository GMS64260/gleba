/**
 * DELETE /api/account — le compte de démonstration ne se supprime pas.
 *
 * Son mot de passe est public (bouton « Essayer la démo ») : la revérification
 * du mot de passe ne protège rien, un visiteur supprimait la démo et toutes ses
 * données pour les suivants. Corrigé le 2026-10-19.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  verifyPassword: vi.fn(),
  userFindUnique: vi.fn(),
  userDelete: vi.fn(),
  transaction: vi.fn(),
  reprendreReferentielCommunaute: vi.fn(),
  supprimerFichiersUtilisateur: vi.fn(),
  sendMail: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({
  requireAuthApi: mocks.requireAuthApi,
  verifyPassword: mocks.verifyPassword,
}))
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: mocks.userFindUnique },
    $transaction: mocks.transaction,
  },
}))
vi.mock("@/lib/account-lifecycle", () => ({
  COMMUNAUTE_USER_ID: "communaute",
  reprendreReferentielCommunaute: mocks.reprendreReferentielCommunaute,
  supprimerFichiersUtilisateur: mocks.supprimerFichiersUtilisateur,
}))
vi.mock("@/lib/mail", () => ({
  sendMail: mocks.sendMail,
  accountDeletedEmail: () => ({ subject: "Compte supprimé", html: "<p>ok</p>" }),
}))
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => null,
  getClientIP: () => "127.0.0.1",
}))

import { DELETE } from "./route"

// Corps exact envoyé par l'écran Paramètres pour un compte à mot de passe.
const requete = (body: object = { password: "mot-de-passe-public" }) =>
  new NextRequest("http://localhost/api/account", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

function compte(email: string) {
  return { id: "u1", email, name: "Ferme", password: "hash", role: "USER" }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({
    error: null,
    session: { user: { id: "u1", acteurId: "u1", role: "USER", impersonatedBy: null } },
  })
  mocks.transaction.mockImplementation((callback: (tx: unknown) => unknown) =>
    callback({ user: { delete: mocks.userDelete } })
  )
  mocks.supprimerFichiersUtilisateur.mockResolvedValue({ dossiersSupprimes: 0 })
  mocks.sendMail.mockResolvedValue(undefined)
})

describe("DELETE /api/account — compte de démonstration", () => {
  it("refuse en 403, même avec le bon mot de passe, et ne supprime rien", async () => {
    mocks.userFindUnique.mockResolvedValue(compte("demo@gleba.fr"))
    mocks.verifyPassword.mockResolvedValue(true)

    const res = await DELETE(requete())

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.code).toBe("COMPTE_DEMO")
    expect(json.error).toContain("ne peut pas être supprimé")
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.userDelete).not.toHaveBeenCalled()
    expect(mocks.sendMail).not.toHaveBeenCalled()
  })
})

describe("DELETE /api/account — compte réel", () => {
  it("garde la revérification du mot de passe", async () => {
    mocks.userFindUnique.mockResolvedValue(compte("maraicher@example.com"))
    mocks.verifyPassword.mockResolvedValue(false)

    const res = await DELETE(requete({ password: "faux" }))

    expect(res.status).toBe(401)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it("supprime le compte comme avant avec le bon mot de passe", async () => {
    mocks.userFindUnique.mockResolvedValue(compte("maraicher@example.com"))
    mocks.verifyPassword.mockResolvedValue(true)

    const res = await DELETE(requete())

    expect(res.status).toBe(200)
    expect(mocks.userDelete).toHaveBeenCalledWith({ where: { id: "u1" } })
  })
})
