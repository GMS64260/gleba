import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  findMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({ default: { association: { findMany: mocks.findMany } } }))

import { GET } from "./route"

type Detail = {
  id: number
  especeId: string | null
  familleId: string | null
  groupe: string | null
  requise: boolean
  notes: string | null
  espece: { id: string; nom: string | null; userId?: string | null; partageCommunaute?: boolean } | null
}

let prochainId = 1
const detail = (especeId: string | null, extra: Partial<Detail> = {}): Detail => ({
  id: prochainId++,
  especeId,
  familleId: null,
  groupe: null,
  requise: false,
  notes: null,
  espece: especeId ? { id: especeId, nom: especeId } : null,
  ...extra,
})

const asso = (id: string, nom: string, type: string, details: Detail[], description: string | null = null) => ({
  id,
  nom,
  type,
  description,
  notes: null,
  details,
})

async function fiche(especeId: string) {
  const res = await GET(new NextRequest("http://localhost/api/maraichage/especes/x/associations"), {
    params: Promise.resolve({ id: encodeURIComponent(especeId) }),
  })
  return { status: res.status, data: ((await res.json()).data ?? []) as Record<string, unknown>[] }
}

describe("GET /api/maraichage/especes/[id]/associations", () => {
  beforeEach(() => {
    mocks.requireAuthApi.mockReset()
    mocks.findMany.mockReset()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u1" } } })
  })

  it("n'affiche pas une association neutre comme favorable", async () => {
    mocks.findMany.mockResolvedValue([asso("n", "Ail Thym", "neutre", [detail("Ail"), detail("Thym")])])
    expect((await fiche("Ail")).data).toEqual([])
  })

  it("ne présente pas la propre famille de l'espèce comme incompatible", async () => {
    mocks.findMany.mockResolvedValue([
      asso("chou-fenouil", "Chou Fenouil !", "incompatible", [
        detail("Fenouil", { requise: true, familleId: "Apiaceae" }),
        detail(null, { familleId: "Brassicaceae", groupe: "Chou" }),
      ]),
    ])
    const { data } = await fiche("Fenouil")
    expect(data.map((d) => [d.partenaire, d.type, d.niveau])).toEqual([["Chou", "defavorable", "Groupe"]])
  })

  it("applique la même règle du pivot que les alertes quand la règle a plusieurs pivots", async () => {
    mocks.findMany.mockResolvedValue([
      asso("milpa", "Courge + Haricot, Maïs", "favorable", [
        detail("Courge", { requise: true }),
        detail("Haricot", { requise: true }),
        detail("Maïs", { requise: true }),
      ]),
    ])
    expect((await fiche("Haricot")).data.map((d) => d.partenaire)).toEqual(["Courge", "Maïs"])
  })

  it("étoile : une compagne n'a que le pivot, un couple sans pivot a l'autre membre", async () => {
    mocks.findMany.mockResolvedValue([
      asso("poireau", "Poireau +", "favorable", [
        detail("Poireau", { requise: true }),
        detail("Artichaut"),
        detail("Tomate"),
      ]),
      asso("ail-tomate", "Ail Tomate", "favorable", [detail("Ail"), detail("Tomate")]),
    ])
    expect((await fiche("Tomate")).data.map((d) => d.partenaire)).toEqual(["Ail", "Poireau"])
  })

  it("ne rend qu'une ligne par partenaire, l'incompatibilité l'emportant", async () => {
    mocks.findMany.mockResolvedValue([
      asso("a-plus", "Groseillier +", "favorable", [detail("Groseillier", { requise: true }), detail("Haricot")]),
      asso("b-plus", "Groseillier-Haricot", "favorable", [detail("Groseillier"), detail("Haricot")]),
      asso("c-contre", "Groseillier !", "incompatible", [detail("Groseillier", { requise: true }), detail("Haricot")]),
    ])
    const { data } = await fiche("Groseillier")
    expect(data.map((d) => [d.associationId, d.partenaire, d.type])).toEqual([["c-contre", "Haricot", "defavorable"]])
  })

  it("justifie chaque partenaire par sa propre note, pas par la description d'un autre", async () => {
    mocks.findMany.mockResolvedValue([
      asso(
        "brocoli",
        "Chou brocoli +",
        "favorable",
        [
          detail("Chou brocoli", { requise: true }),
          detail("Concombre", { notes: "Bon voisinage." }),
          detail("Oignon"),
        ],
        "Concombre: Bon voisinage."
      ),
    ])
    const { data } = await fiche("Chou brocoli")
    expect(data.map((d) => [d.partenaire, d.description])).toEqual([
      ["Concombre", "Bon voisinage."],
      ["Oignon", null],
    ])
  })

  it("nomme une espèce personnelle par son nom et élargit la recherche aux alias", async () => {
    mocks.findMany.mockResolvedValue([
      asso("ail-contre", "Ail !", "incompatible", [
        detail("Ail", { requise: true }),
        detail("Haricot"),
        detail("cmxyz", { espece: { id: "cmxyz", nom: "Fève du jardin" } }),
      ]),
    ])
    const { data } = await fiche("Ail")
    expect(data.map((d) => [d.partenaire, d.partenaireId])).toEqual([
      ["Haricot", "Haricot"],
      ["Fève du jardin", "cmxyz"],
    ])

    await fiche("Haricot vert")
    const where = mocks.findMany.mock.calls.at(-1)?.[0].where
    expect(where.details.some.especeId.in).toEqual(expect.arrayContaining(["Haricot vert", "Haricot"]))
  })

  it("ne nomme pas l'espèce personnelle d'un autre compte", async () => {
    mocks.findMany.mockResolvedValue([
      asso("ail-plus", "Ail +", "favorable", [
        detail("Ail", { requise: true }),
        detail("cmautre", { espece: { id: "cmautre", nom: "Tomate de Paul", userId: "u2", partageCommunaute: false } }),
        detail("cmpartage", { espece: { id: "cmpartage", nom: "Oca", userId: "u2", partageCommunaute: true } }),
        detail("cmmien", { espece: { id: "cmmien", nom: "Ma fraise", userId: "u1", partageCommunaute: false } }),
      ]),
    ])
    expect((await fiche("Ail")).data.map((d) => d.partenaire)).toEqual(["Oca", "Ma fraise"])
  })

  it("rend une erreur lisible au lieu de planter", async () => {
    mocks.findMany.mockRejectedValue(new Error("base indisponible"))
    const res = await GET(new NextRequest("http://localhost/x"), { params: Promise.resolve({ id: "100%" }) })
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBeTruthy()
    expect(mocks.findMany.mock.calls[0][0].where.details.some.especeId.in).toEqual(["100%"])
  })
})
