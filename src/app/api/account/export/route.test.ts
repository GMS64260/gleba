/**
 * GET /api/account/export — le contenu omis de la sauvegarde (brut des
 * capteurs au-delà du seuil, revue du 2026-10-30) est dit à l'écran.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  exportAccount: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/account-transfer", () => ({ exportAccount: mocks.exportAccount }))

import { GET } from "./route"

const sauvegarde = (avertissements: string[]) => ({
  format: "2.0", exportDate: "2026-10-30T08:00:00.000Z", appVersion: "1", sourceUserId: "u1", data: {}, stats: {}, avertissements,
})

describe("GET /api/account/export", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u1", estProprietaireExploitation: true } } })
  })

  it("porte l'avertissement dans le fichier et dans un en-tête lisible par l'écran", async () => {
    const message = "Mesures brutes des capteurs non incluses : 350 000 mesures dépassent le seuil."
    mocks.exportAccount.mockResolvedValue(sauvegarde([message]))
    const res = await GET(new Request("http://localhost/api/account/export"))
    expect(res.status).toBe(200)
    expect(decodeURIComponent(res.headers.get("X-Gleba-Avertissements")!)).toBe(message)
    expect((await res.json()).avertissements).toEqual([message])
  })

  it("sans contenu omis, aucun en-tête d'avertissement", async () => {
    mocks.exportAccount.mockResolvedValue(sauvegarde([]))
    const res = await GET(new Request("http://localhost/api/account/export"))
    expect(res.headers.get("X-Gleba-Avertissements")).toBeNull()
  })
})
