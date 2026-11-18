import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  executeRaw: vi.fn(),
  plancheFindFirst: vi.fn(),
  itpFindFirst: vi.fn(),
  especeFindFirst: vi.fn(),
  invalidateKpi: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/kpi", () => ({ invalidateKpi: mocks.invalidateKpi }))
const tx = {
  // Verrou d'exploitation ($executeRaw) puis verrou commun des étapes ($queryRaw).
  $executeRaw: mocks.executeRaw,
  $queryRaw: async () => [],
  recolte: { findFirst: async () => null },
  culture: { findMany: mocks.findMany, updateMany: mocks.updateMany, update: mocks.update },
  planche: { findFirst: mocks.plancheFindFirst },
  iTP: { findFirst: mocks.itpFindFirst },
  espece: { findFirst: mocks.especeFindFirst },
}
vi.mock("@/lib/prisma", () => ({ default: { $transaction: mocks.transaction } }))

import { POST } from "./route"

const requete = (corps: unknown) =>
  new NextRequest("http://localhost/api/cultures/bulk-fait", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  })

const occupationVide = {
  terminee: null,
  plancheId: null,
  itpId: null,
  especeId: "e-annuelle",
  longueur: null,
  nbRangs: null,
  finRecolte: null,
}

const etapesVides = {
  ...occupationVide,
  dateSemis: null,
  datePlantation: null,
  dateRecolte: null,
  dateSemisPlan: null,
  datePlantationPlan: null,
  dateRecoltePlan: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "exploitation-1" } } })
  mocks.transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx))
  mocks.especeFindFirst.mockImplementation(async ({ where }: { where: { id: string } }) =>
    ({ vivace: where.id === "e-vivace" }))
})

describe("POST /api/cultures/bulk-fait", () => {
  // Revue du 2026-11-11 : la « surface cultivée » des indicateurs compte les
  // cultures dont une étape est faite ; sans invalidation, « Marquer fait »
  // depuis le calendrier laissait l'indicateur périmé jusqu'à l'expiration du
  // cache, alors que la même action à l'unité (PATCH) le rafraîchit.
  it("invalide les indicateurs de l'exploitation après l'écriture", async () => {
    mocks.findMany.mockResolvedValue([{ id: 1, ...etapesVides }, { id: 2, ...etapesVides }])
    const res = await POST(requete({ ids: [1, 2], type: "semis" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ updated: 2, ignores: 0, refusees: [] })
    expect(mocks.findMany.mock.calls[0][0].where.userId).toBe("exploitation-1")
    // Verrou d'exploitation pris avant la relecture.
    expect(mocks.executeRaw.mock.invocationCallOrder[0]).toBeLessThan(mocks.findMany.mock.invocationCallOrder[0])
    expect(mocks.invalidateKpi).toHaveBeenCalledWith("exploitation-1")
  })

  it("n'invalide rien quand aucune culture n'est concernée", async () => {
    mocks.findMany.mockResolvedValue([])
    const res = await POST(requete({ ids: [9], type: "recolte" }))
    expect(await res.json()).toEqual({ updated: 0, ignores: 1, refusees: [] })
    expect(mocks.invalidateKpi).not.toHaveBeenCalled()
  })

  it("refuse un corps invalide sans rien lire", async () => {
    const res = await POST(requete({ ids: [], type: "semis" }))
    expect(res.status).toBe(400)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  // Contre-revue PR #73 (revue-adv-97) : le recalage d'une étape faite avance
  // le cycle ; s'il fait déborder la planche, la culture est refusée et non
  // écrite, les autres du lot passent. Preuve PostgreSQL :
  // ../occupation-chemins.postgres.test.ts.
  it("refuse la culture dont le recalage déborde la planche et marque les autres", async () => {
    const dans = (jours: number) => new Date(Date.now() + jours * 86_400_000)
    const pleine = { ...etapesVides, id: 1, plancheId: "p1", itpId: "itp", longueur: 20, nbRangs: 3,
      dateSemis: dans(20), dateRecolte: dans(60) }
    const sansDate = { ...etapesVides, id: 2 }
    mocks.findMany.mockResolvedValue([pleine, sansDate])
    mocks.itpFindFirst.mockResolvedValue({ espacementRangs: 25 })
    mocks.plancheFindFirst.mockResolvedValue({
      nom: "P1", longueur: 20, largeur: 0.8,
      cultures: [{ id: 9, espece: { id: "e", vivace: false }, dateSemis: dans(-10), datePlantation: null,
        dateRecolte: dans(10), finRecolte: null, nbRangs: 3, longueur: 20, itp: { espacementRangs: 25 } }],
    })
    const res = await POST(requete({ ids: [1, 2], type: "semis" }))
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps).toMatchObject({ updated: 1, ignores: 0 })
    expect(corps.refusees).toHaveLength(1)
    expect(corps.refusees[0].id).toBe(1)
    expect(mocks.update).toHaveBeenCalledTimes(1)
    expect(mocks.update.mock.calls[0][0].where).toEqual({ id: 2, userId: "exploitation-1" })
    expect(mocks.plancheFindFirst.mock.calls[0][0].where).toEqual({ id: "p1", userId: "exploitation-1" })
  })

  // ADV33 (contre-revue PR #73) : l'état final d'une vivace est évalué sans fin
  // de cycle. Vivace prévue à J+20 (3 rangs), sans date de récolte ; voisine :
  // une annuelle de 3 rangs de J-10 à J+5. En place à partir de J+20, la vivace
  // ne la croise pas ; recalée à J0 elle la côtoie : nouveau dépassement, refus.
  // Lue comme une annuelle sans fin de cycle, toutes les voisines comptent avant
  // comme après (prudence) : dépassement hérité non aggravé, elle passait.
  // ADV39 : les voisines successives ne s'additionnent plus (tranches de temps).
  it("évalue l'état final d'une vivace sans fin de cycle (même contrôle que reporter)", async () => {
    const dans = (jours: number) => new Date(Date.now() + jours * 86_400_000)
    const voisine = (id: number, debut: number, fin: number, nbRangs: number) => ({ id, espece: { id: "e-annuelle", vivace: false },
      dateSemis: dans(debut), datePlantation: null, dateRecolte: dans(fin), finRecolte: null, nbRangs, longueur: 20,
      itp: { espacementRangs: 25 } })
    const culture = (especeId: string) => ({ ...etapesVides, id: 1, plancheId: "p1", itpId: "itp", especeId,
      longueur: 20, nbRangs: 3, dateSemis: dans(20), dateRecolte: null })
    mocks.itpFindFirst.mockResolvedValue({ espacementRangs: 25 })
    mocks.plancheFindFirst.mockResolvedValue({
      nom: "P1", longueur: 20, largeur: 0.8, cultures: [voisine(8, -10, 5, 3)],
    })

    mocks.findMany.mockResolvedValue([culture("e-vivace")])
    const vivace = await (await POST(requete({ ids: [1], type: "semis" }))).json()
    expect(vivace).toMatchObject({ updated: 0, refusees: [{ id: 1 }] })
    expect(vivace.refusees[0].error).toMatch(/Largeur insuffisante/)
    expect(mocks.especeFindFirst.mock.calls[0][0].where).toEqual({ id: "e-vivace" })
    expect(mocks.update).not.toHaveBeenCalled()

    // Contrôle positif : la même culture annuelle passe.
    mocks.findMany.mockResolvedValue([culture("e-annuelle")])
    expect(await (await POST(requete({ ids: [1], type: "semis" }))).json()).toMatchObject({ updated: 1, refusees: [] })
    expect(mocks.update).toHaveBeenCalledTimes(1)
  })

  it("refuse un membre en lecture seule sans rien lire", async () => {
    mocks.requireAuthApi.mockResolvedValue({
      error: null, session: { user: { id: "exploitation-1", peutEcrireExploitation: false } },
    })
    const res = await POST(requete({ ids: [1], type: "semis" }))
    expect(res.status).toBe(403)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})
