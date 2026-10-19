/**
 * POST /api/account/import — jamais sur la ferme de démonstration partagée
 * (2026-10-19) : l'import la remplirait pour tous les visiteurs suivants.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  userFindUnique: vi.fn(),
  importAccount: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({ default: { user: { findUnique: mocks.userFindUnique } } }))
vi.mock("@/lib/account-transfer", () => ({
  importAccount: mocks.importAccount,
  isValidExportPayload: () => true,
}))

import { POST } from "./route"

// Corps de l'écran Paramètres : multipart, champ « file ».
function requete() {
  const formData = new FormData()
  formData.append("file", new File([JSON.stringify({ version: 1 })], "sauvegarde.json", { type: "application/json" }))
  return new NextRequest("http://localhost/api/account/import", { method: "POST", body: formData })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({
    error: null,
    session: { user: { id: "u1", role: "USER", estProprietaireExploitation: true } },
  })
  mocks.importAccount.mockResolvedValue({ total: 3, imported: {}, skipped: {}, warnings: [] })
})

describe("POST /api/account/import", () => {
  it("refuse en 403 sur le compte de démonstration, sans rien importer", async () => {
    mocks.userFindUnique.mockResolvedValue({ email: "demo@gleba.fr" })

    const res = await POST(requete())

    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe("COMPTE_DEMO")
    expect(mocks.importAccount).not.toHaveBeenCalled()
  })

  it("importe comme avant sur un compte réel", async () => {
    mocks.userFindUnique.mockResolvedValue({ email: "maraicher@example.com" })

    const res = await POST(requete())

    expect(res.status).toBe(200)
    expect(mocks.importAccount).toHaveBeenCalledWith("u1", expect.anything(), { dryRun: false, isAdmin: false })
  })
})
