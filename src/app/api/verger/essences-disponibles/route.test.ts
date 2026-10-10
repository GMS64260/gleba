/**
 * Ticket cmv2908du (QA 2026-10-10) — à l'étape Essences de l'assistant
 * Plantation, « Citrus paradisi » s'affichait sous son cuid : la route prenait
 * l'id de l'espèce pour son nom.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  especeFindMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/terroir", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/terroir")>()),
  zoneEffectiveUser: vi.fn().mockResolvedValue(null),
}))
vi.mock("@/lib/prisma", () => ({
  default: { espece: { findMany: mocks.especeFindMany } },
}))

import { GET } from "./route"

describe("GET /api/verger/essences-disponibles?type=verger", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } })
  })

  it("affiche le nom d'une espèce dont l'id est un cuid", async () => {
    mocks.especeFindMany.mockResolvedValue([
      {
        id: "cmuu5t8mx005gk6bhtdop6pt9",
        nom: "Pamplemoussier",
        nomLatin: "Citrus paradisi",
        type: "arbre_fruitier",
        zonesAdaptees: null,
        besoinFroid: null,
        _count: { portesGreffe: 0 },
      },
      {
        id: "Pommier",
        nom: null,
        nomLatin: "Malus domestica",
        type: "arbre_fruitier",
        zonesAdaptees: null,
        besoinFroid: null,
        _count: { portesGreffe: 2 },
      },
    ])

    const res = await GET(new NextRequest("http://localhost/api/verger/essences-disponibles?type=verger"))
    expect(res.status).toBe(200)
    const body = await res.json()

    const pamplemoussier = body.data.find((e: { nomLatin: string }) => e.nomLatin === "Citrus paradisi")
    expect(pamplemoussier).toMatchObject({
      id: "fruitier::cmuu5t8mx005gk6bhtdop6pt9",
      nom: "Pamplemoussier",
    })
    // Catalogue historique : id = nom, nom parfois absent.
    const pommier = body.data.find((e: { nomLatin: string }) => e.nomLatin === "Malus domestica")
    expect(pommier.nom).toBe("Pommier")

    const args = mocks.especeFindMany.mock.calls[0][0]
    expect(args.select.nom).toBe(true)
  })
})
