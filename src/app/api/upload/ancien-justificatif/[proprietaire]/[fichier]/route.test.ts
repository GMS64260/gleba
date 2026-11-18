import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"

const m = vi.hoisted(() => ({
  lire: vi.fn(),
  garde: vi.fn(),
}))
vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: m.garde }))
vi.mock("node:fs/promises", async (original) => ({ ...await original<typeof import("node:fs/promises")>(), readFile: m.lire }))

import { GET } from "./route"

const lire = (proprietaire: string, fichier: string) =>
  GET(new Request("http://localhost/api/upload/ancien-justificatif/x/y"), { params: Promise.resolve({ proprietaire, fichier }) })

beforeEach(() => {
  vi.clearAllMocks()
  m.lire.mockResolvedValue(Buffer.from("%PDF-1.4"))
  m.garde.mockResolvedValue({ error: null, session: { user: { id: "exploitation-a", acteurId: "membre" } } })
})

describe("anciens justificatifs sous public/uploads : servis au seul titulaire, session revalidée (MC3)", () => {
  it("sert le justificatif du propre dossier de la personne connectée", async () => {
    const reponse = await lire("membre", "facture mars.pdf")
    expect(reponse.status).toBe(200)
    expect(reponse.headers.get("Content-Type")).toBe("application/pdf")
    expect(reponse.headers.get("Cache-Control")).toBe("private, no-store")
    expect(m.lire.mock.calls[0][0]).toMatch(/public\/uploads\/membre\/justificatifs\/facture mars\.pdf$/)
  })

  it("une session refusée par la garde (cookie révoqué) ne lit rien", async () => {
    m.garde.mockResolvedValue({ error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }), session: null })
    expect((await lire("membre", "facture.pdf")).status).toBe(401)
    expect(m.lire).not.toHaveBeenCalled()
  })

  it("répond 404 pour le dossier d'un autre compte, même celui de l'exploitation visitée", async () => {
    expect((await lire("exploitation-a", "facture.pdf")).status).toBe(404)
    expect((await lire("autre", "facture.pdf")).status).toBe(404)
    expect(m.lire).not.toHaveBeenCalled()
  })

  it.each(["../secret.pdf", "..", ".cache.pdf", "a\\b.pdf", "a\0.pdf", "script.html", "sans-extension"])(
    "répond 404 pour un nom refusé : %s",
    async (fichier) => {
      expect((await lire("membre", fichier)).status).toBe(404)
      expect(m.lire).not.toHaveBeenCalled()
    },
  )

  it("répond 404 pour un fichier absent", async () => {
    m.lire.mockRejectedValue(new Error("ENOENT"))
    expect((await lire("membre", "facture.pdf")).status).toBe(404)
  })
})
