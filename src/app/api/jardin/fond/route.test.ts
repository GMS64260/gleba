import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const m = vi.hoisted(() => ({
  ecrire: vi.fn(),
  upsert: vi.fn(),
  parcelle: vi.fn(),
  refusDemo: vi.fn(),
  refusEnvoi: vi.fn(),
}))
vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: async () => ({ error: null, session: { user: { id: "ferme" } } }) }))
vi.mock("node:fs/promises", () => ({ mkdir: vi.fn(), writeFile: m.ecrire, unlink: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ default: { fondPlan: { findUnique: async () => null, upsert: m.upsert }, parcelleGeo: { findFirst: m.parcelle } } }))
vi.mock("@/lib/demo-garde", () => ({ MESSAGES_REFUS_DEMO: { envoiFichier: "refus démo" }, refusSiCompteDemo: m.refusDemo }))
vi.mock("@/lib/upload-garde", async (original) => ({ ...await original<typeof import("@/lib/upload-garde")>(), refusEnvoiFichier: m.refusEnvoi }))

import { POST } from "./route"

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const envoyer = (parcelle: string, contenu: BlobPart = PNG, type = "image/png") => {
  const form = new FormData()
  form.set("parcelle", parcelle)
  form.set("file", new Blob([contenu], { type }), "fond.png")
  return POST(new NextRequest("http://localhost/api/jardin/fond", { method: "POST", body: form }))
}

beforeEach(() => {
  vi.clearAllMocks()
  m.refusDemo.mockResolvedValue(null)
  m.refusEnvoi.mockResolvedValue(null)
  m.parcelle.mockResolvedValue({ id: "parcelle-1" })
  m.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({ ...create, updatedAt: new Date() }))
})

describe("POST /api/jardin/fond : gardes de stockage (revue de sécurité du 2026-11-11)", () => {
  it("refuse le compte de démonstration sans rien écrire", async () => {
    m.refusDemo.mockResolvedValue(NextResponse.json({ error: "refus démo" }, { status: 403 }))
    expect((await envoyer("global")).status).toBe(403)
    expect(m.ecrire).not.toHaveBeenCalled()
    expect(m.upsert).not.toHaveBeenCalled()
  })

  it("refuse une clé qui n'est pas une parcelle de l'exploitation", async () => {
    m.parcelle.mockResolvedValue(null)
    expect((await envoyer("inexistante-1")).status).toBe(404)
    expect(m.parcelle).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "inexistante-1", userId: "ferme" } }))
    expect(m.ecrire).not.toHaveBeenCalled()
  })

  it("applique le quota et le débit du compte avant d'écrire", async () => {
    m.refusEnvoi.mockResolvedValue(NextResponse.json({ code: "QUOTA_STOCKAGE" }, { status: 413 }))
    expect((await envoyer("parcelle-1")).status).toBe(413)
    expect(m.refusEnvoi).toHaveBeenCalledWith("fondPlan", "ferme", PNG.length)
    expect(m.ecrire).not.toHaveBeenCalled()
  })

  it("refuse un contenu qui n'est pas l'image annoncée", async () => {
    expect((await envoyer("parcelle-1", "pas une image")).status).toBe(400)
    expect(m.ecrire).not.toHaveBeenCalled()
  })

  it("enregistre le fond commun et celui d'une parcelle de l'exploitation", async () => {
    expect((await envoyer("global")).status).toBe(201)
    expect((await envoyer("parcelle-1")).status).toBe(201)
    expect(m.ecrire).toHaveBeenCalledTimes(2)
    expect(m.ecrire.mock.calls[1][0]).toMatch(/plan-fonds\/ferme\/parcelle-1\.png$/)
  })
})
