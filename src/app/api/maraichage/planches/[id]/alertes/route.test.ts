import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  cultureFindMany: vi.fn(),
  alertesAssociations: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({ default: { culture: { findMany: mocks.cultureFindMany } } }))
vi.mock("@/lib/associations-alertes", () => ({ alertesAssociations: mocks.alertesAssociations }))

import { GET } from "./route"

const AUJOURDHUI = new Date(2026, 6, 15, 12)
const jour = (mois: number, j: number, annee = 2026) => new Date(annee, mois - 1, j)

const culture = (id: number, especeId: string, extra: Record<string, unknown> = {}) => ({
  id,
  especeId,
  varieteId: null,
  annee: 2026,
  terminee: null,
  semisFait: true,
  plantationFaite: true,
  recolteFaite: false,
  dateSemis: jour(3, 1),
  datePlantation: jour(4, 15),
  dateRecolte: null,
  finRecolte: null,
  espece: { vivace: false },
  ...extra,
})

const appel = () =>
  GET(new NextRequest("http://localhost/api/maraichage/planches/p1/alertes"), {
    params: Promise.resolve({ id: "p1" }),
  })

describe("GET /api/maraichage/planches/[id]/alertes", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(AUJOURDHUI)
    mocks.requireAuthApi.mockReset()
    mocks.cultureFindMany.mockReset()
    mocks.alertesAssociations.mockReset()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "exploitation-1" } } })
    mocks.alertesAssociations.mockResolvedValue([])
    return () => {
      vi.useRealTimers()
    }
  })

  it("compare les cultures réellement sur la planche, pas les cases « récolte »", async () => {
    mocks.cultureFindMany.mockResolvedValue([
      // En cours de récolte, toujours en place : comptait pour absente.
      culture(1, "Tomate", { recolteFaite: true, dateRecolte: jour(7, 1), finRecolte: jour(9, 30) }),
      culture(2, "Basilic"),
      // Campagne 2024 jamais close : comptait pour présente.
      culture(3, "Fenouil", { annee: 2024, dateSemis: jour(3, 1, 2024), datePlantation: jour(4, 15, 2024) }),
      // Close.
      culture(4, "Haricot", { terminee: "x" }),
      // Prévue pour l'automne, pas encore sur la planche.
      culture(5, "Mâche", {
        semisFait: false,
        plantationFaite: false,
        dateSemis: jour(9, 10),
        datePlantation: null,
      }),
      // Vivace non close, sans millésime récent.
      culture(6, "Rhubarbe", { annee: 2022, espece: { vivace: true }, dateSemis: null, datePlantation: jour(4, 1, 2022) }),
    ])

    const res = await appel()
    expect(res.status).toBe(200)
    expect(mocks.alertesAssociations.mock.calls[0][1]).toEqual(["Tomate", "Basilic", "Rhubarbe"])
    const corps = await res.json()
    expect(corps.cultures).toEqual([
      { id: 1, especeId: "Tomate", varieteId: null },
      { id: 2, especeId: "Basilic", varieteId: null },
      { id: 6, especeId: "Rhubarbe", varieteId: null },
    ])
  })

  it("borne la lecture à l'exploitation et à la planche", async () => {
    mocks.cultureFindMany.mockResolvedValue([])
    await appel()
    expect(mocks.cultureFindMany.mock.calls[0][0].where).toMatchObject({ userId: "exploitation-1", plancheId: "p1" })
  })

  it("rend une erreur lisible au lieu de planter", async () => {
    mocks.cultureFindMany.mockRejectedValue(new Error("base indisponible"))
    const res = await appel()
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBeTruthy()
  })
})
