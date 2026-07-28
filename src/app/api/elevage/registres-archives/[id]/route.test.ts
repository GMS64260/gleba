import { createHash } from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  findFirst: vi.fn(),
  readFile: vi.fn(),
  auditCreate: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("node:fs/promises", async (importOriginal) => ({
  ...await importOriginal<typeof import("node:fs/promises")>(),
  readFile: mocks.readFile,
}))
vi.mock("@/lib/prisma", () => ({
  default: {
    archiveRegistreElevage: { findFirst: mocks.findFirst },
    declarationReglementaireEvenement: { create: mocks.auditCreate },
  },
}))

import { GET } from "./route"

const contenu = Buffer.from("archive zip intacte")
const archive = {
  id: "archive-1",
  userId: "user-1",
  annee: 2026,
  snapshotHash: "a".repeat(64),
  archiveSha256: createHash("sha256").update(contenu).digest("hex"),
  tailleOctets: contenu.byteLength,
  nomFichier: "dossier-reglementaire-elevage-2026.zip",
  stockageNom: "123e4567-e89b-42d3-a456-426614174000.zip",
}

describe("téléchargement d’une archive du registre", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.findFirst.mockResolvedValue(archive)
    mocks.readFile.mockResolvedValue(contenu)
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" })
  })

  it("contrôle le propriétaire et l’empreinte avant de servir le ZIP", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/elevage/registres-archives/archive-1"),
      { params: Promise.resolve({ id: "archive-1" }) },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/zip")
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: "archive-1", userId: "user-1" },
    })
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "REGISTRE_COMPLET_ARCHIVE_TELECHARGE",
        declarationKey: "registre-complet:2026",
      }),
    })
  })

  it("ne révèle pas une archive absente du périmètre utilisateur", async () => {
    mocks.findFirst.mockResolvedValueOnce(null)

    const response = await GET(
      new NextRequest("http://localhost/api/elevage/registres-archives/archive-2"),
      { params: Promise.resolve({ id: "archive-2" }) },
    )

    expect(response.status).toBe(404)
    expect(mocks.readFile).not.toHaveBeenCalled()
  })

  it("bloque un fichier dont l’empreinte a changé", async () => {
    mocks.readFile.mockResolvedValueOnce(Buffer.from("contenu altéré"))

    const response = await GET(
      new NextRequest("http://localhost/api/elevage/registres-archives/archive-1"),
      { params: Promise.resolve({ id: "archive-1" }) },
    )

    expect(response.status).toBe(409)
    expect(mocks.auditCreate).not.toHaveBeenCalled()
  })
})
