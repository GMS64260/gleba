import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Revue du 2026-10-25 (après le ticket cmvnopnsu) : la régénération du
 * calendrier d'entretien ignorait le plancher d'une plantation à venir et
 * replanifiait une récolte sur un arbre non productif, deux règles que la
 * création applique. Le test rejoue le bouton de la liste des arbres, qui
 * envoie un corps vide (ArbresTab, handleGenererCalendrier).
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  arbreFindFirst: vi.fn(),
  operationDeleteMany: vi.fn(),
  operationCreateMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    arbre: { findFirst: mocks.arbreFindFirst },
    operationArbre: { deleteMany: mocks.operationDeleteMany, createMany: mocks.operationCreateMany },
  },
}))

import { POST } from "./route"
import { findTreeCareProfile, generateCareOperations } from "@/lib/tree-care-calendar"
import { planCalendrierEntretien } from "@/lib/verger/creation-arbre"

const POMMIER = {
  id: 881,
  userId: "u1",
  nom: "Pommier 1",
  type: "fruitier",
  espece: "Pommier",
  variete: null,
  datePlantation: new Date(2027, 2, 1),
  productif: false,
}

const regenerer = (body: Record<string, unknown> = {}) =>
  POST(
    new Request("http://localhost/api/arbres/881/generer-calendrier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ id: "881" }) }
  )

type Borne = { gte?: Date; lte?: Date; lt?: Date }
type OperationStockee = {
  arbreId: number
  userId: string
  notes: string | null
  fait: boolean
  abandonneeLe: Date | null
  datePrevue: Date
}

/** Applique le `where` du deleteMany (champs utilisés par la route) à une opération. */
function seraitSupprimee(op: OperationStockee, where: Record<string, unknown>): boolean {
  const dansBorne = (d: Date, b: Borne) =>
    (b.gte === undefined || d >= b.gte) && (b.lte === undefined || d <= b.lte) && (b.lt === undefined || d < b.lt)
  return (
    op.arbreId === where.arbreId &&
    op.userId === where.userId &&
    op.notes === where.notes &&
    op.fait === where.fait &&
    op.abandonneeLe === where.abandonneeLe &&
    (where.OR as { datePrevue: Borne }[]).some((c) => dansBorne(op.datePrevue, c.datePrevue))
  )
}

describe("POST /api/arbres/[id]/generer-calendrier — même règle que la création", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 9, 25, 10, 0, 0))
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u1" } } })
    mocks.operationDeleteMany.mockResolvedValue({ count: 0 })
    mocks.operationCreateMany.mockResolvedValue({ count: 0 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("arbre à planter, non productif : rien avant la plantation, aucune récolte", async () => {
    mocks.arbreFindFirst.mockResolvedValue(POMMIER)

    const res = await regenerer()

    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.year).toBe(2027)
    const operations = mocks.operationCreateMany.mock.calls[0][0].data
    expect(operations.length).toBeGreaterThan(0)
    expect(operations.some((op: { type: string }) => op.type === "recolte")).toBe(false)
    for (const op of operations) {
      expect(op.datePrevue.getTime()).toBeGreaterThanOrEqual(POMMIER.datePlantation.getTime())
    }
    // Ne sont remplacées que des opérations automatiques non faites et non
    // abandonnées : de l'année régénérée, ou antérieures à la plantation.
    expect(mocks.operationDeleteMany.mock.calls[0][0].where).toEqual({
      arbreId: 881,
      userId: "u1",
      notes: "auto:calendrier",
      fait: false,
      abandonneeLe: null,
      OR: [
        { datePrevue: { gte: new Date(2027, 0, 1), lte: new Date(2027, 11, 31, 23, 59, 59) } },
        { datePrevue: { lt: new Date(2027, 2, 1) } },
      ],
    })
  })

  it("plantation corrigée après coup : les opérations automatiques antérieures disparaissent", async () => {
    // Arbre créé depuis le plan le 25/10/2026 (plantation = aujourd'hui) : son
    // calendrier 2026 est généré. La plantation est ensuite corrigée au
    // 15/02/2027 dans la fiche, puis « Recalculer » est cliqué.
    const profil = findTreeCareProfile("Pommier", "fruitier")!
    const creees = planCalendrierEntretien(profil, { ...POMMIER, datePlantation: new Date(2026, 9, 25) }, "u1")
    expect(creees.annee).toBe(2026)
    expect(creees.operations.length).toBeGreaterThan(0)
    const stockees: OperationStockee[] = [
      ...creees.operations.map((op) => ({ ...op, abandonneeLe: null })),
      // Témoins conservés : une opération faite et une fenêtre abandonnée.
      { arbreId: 881, userId: "u1", notes: "auto:calendrier", fait: true, abandonneeLe: null, datePrevue: new Date(2026, 10, 12) },
      { arbreId: 881, userId: "u1", notes: "auto:calendrier", fait: false, abandonneeLe: new Date(2026, 10, 1), datePrevue: new Date(2026, 10, 12) },
    ]
    const plantationCorrigee = new Date(2027, 1, 15)
    mocks.arbreFindFirst.mockResolvedValue({ ...POMMIER, datePlantation: plantationCorrigee })

    const res = await regenerer()

    expect(res.status).toBe(200)
    expect((await res.json()).year).toBe(2027)
    const where = mocks.operationDeleteMany.mock.calls[0][0].where
    const restantes = stockees.filter((op) => !seraitSupprimee(op, where))
    expect(restantes).toHaveLength(2)
    expect(restantes.every((op) => op.fait || op.abandonneeLe !== null)).toBe(true)
    for (const op of mocks.operationCreateMany.mock.calls[0][0].data) {
      expect(op.datePrevue.getTime()).toBeGreaterThanOrEqual(plantationCorrigee.getTime())
    }
  })

  it("année passée demandée explicitement : générée en entier", async () => {
    mocks.arbreFindFirst.mockResolvedValue({ ...POMMIER, datePlantation: new Date(2020, 2, 1), productif: true })

    const res = await regenerer({ year: 2025 })

    expect(res.status).toBe(200)
    const attendu = generateCareOperations(findTreeCareProfile("Pommier", "fruitier")!, 2025, 881, "u1", null, null)
    expect(mocks.operationCreateMany.mock.calls[0][0].data).toEqual(attendu)
  })

  it("année demandée avant la plantation : aucune opération", async () => {
    mocks.arbreFindFirst.mockResolvedValue(POMMIER)

    const res = await regenerer({ year: 2026 })

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ count: 0, year: 2026 })
    expect(mocks.operationCreateMany).not.toHaveBeenCalled()
  })

  it.each([["deux-mille"], [1e21], [99999], [1899], [2032], [2025.5]])(
    "refuse l'année %s en désignant le champ",
    async (year) => {
      mocks.arbreFindFirst.mockResolvedValue(POMMIER)

      const res = await regenerer({ year })

      expect(res.status).toBe(400)
      expect((await res.json()).champ).toBe("year")
      expect(mocks.operationDeleteMany).not.toHaveBeenCalled()
    }
  )
})
