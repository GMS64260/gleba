import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ lire: vi.fn(), session: { user: { id: "exploitation-a", acteurId: "membre" } } }))
vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: async () => ({ error: null, session: m.session }) }))
vi.mock("node:fs/promises", async (original) => ({ ...await original<typeof import("node:fs/promises")>(), readFile: m.lire }))

import { GET } from "./route"

const FICHIER = "0f8fad5b-d9cb-469f-a165-70867728950e-1200.jpg"
const lire = (proprietaire: string, fichier = FICHIER) =>
  GET(new Request("http://localhost/api/upload/photo/x/y"), { params: Promise.resolve({ proprietaire, fichier }) })

beforeEach(() => {
  vi.clearAllMocks()
  m.lire.mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff]))
})

describe("photos envoyées : servies aux seuls membres de l'exploitation (revue de sécurité du 2026-11-11)", () => {
  it("sert la photo de l'exploitation en cours à un de ses membres", async () => {
    const reponse = await lire("exploitation-a")
    expect(reponse.status).toBe(200)
    expect(reponse.headers.get("Content-Type")).toBe("image/jpeg")
    expect(reponse.headers.get("Cache-Control")).toContain("private")
    expect(m.lire.mock.calls[0][0]).toMatch(/public\/uploads\/exploitation-a\/0f8fad5b-.*-1200\.jpg$/)
  })

  it("répond 404 pour la photo d'une autre exploitation, sans lire le disque", async () => {
    expect((await lire("exploitation-b")).status).toBe(404)
    expect(m.lire).not.toHaveBeenCalled()
  })

  it.each(["justificatif.pdf", "..%2F..%2Fsecret.jpg", "../autre/" + FICHIER])("répond 404 pour un nom qui n'est pas une photo envoyée : %s", async (fichier) => {
    expect((await lire("exploitation-a", fichier)).status).toBe(404)
    expect(m.lire).not.toHaveBeenCalled()
  })

  it("répond 404 pour un fichier absent", async () => {
    m.lire.mockRejectedValue(new Error("ENOENT"))
    expect((await lire("exploitation-a")).status).toBe(404)
  })
})
