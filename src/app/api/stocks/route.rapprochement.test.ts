import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

/**
 * Ticket QA cmvnpe6ip (2026-10-25) — Gestion des stocks > Récoltes : Radis
 * compté 7,5 kg (« inventaire du 25/10/2026 ») ; Récoltes > Stock : quatre
 * lots vendables de 2 kg, sans rien qui relie les deux.
 *
 * `GET /api/stocks?type=recoltes` sert le stock de Gestion des stocks
 * (`calculerStocksNet`, réel) et sa comparaison avec les lots (réelle),
 * rejoués sur une base en mémoire reprenant les données du ticket, plus les
 * deux scénarios de la revue : lot vendu après le comptage, récolte saisie le
 * jour du comptage.
 */

type Lot = {
  id: number
  userId: string
  especeId: string
  date: Date
  quantite: number
  unite: string | null
  statut: string
  dateVente: Date | null
}

const COMPTAGE = new Date("2026-10-25T09:30:00.000Z")
const base = vi.hoisted(() => ({
  lots: [] as Lot[],
  comptage: null as null | { especeId: string; inventaire: number; dateInventaire: Date },
}))

/** Filtre Prisma minimal : égalité, `in`, `gt`, `notIn`, `equals`. */
function correspond(ligne: Record<string, unknown>, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([champ, cond]) => {
    const v = ligne[champ]
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as Record<string, unknown>
      if ("in" in c && !(c.in as unknown[]).includes(v)) return false
      if ("notIn" in c && (c.notIn as unknown[]).includes(v)) return false
      if ("gt" in c && !(v instanceof Date && v.getTime() > (c.gt as Date).getTime())) return false
      if ("equals" in c && v !== c.equals) return false
      return true
    }
    return v === cond
  })
}

vi.mock("@/lib/auth-utils", () => ({
  requireAuthApi: vi.fn().mockResolvedValue({ error: null, session: { user: { id: "u-demo" } } }),
}))
vi.mock("@/lib/prisma", () => ({
  default: {
    espece: {
      findMany: vi.fn(async (args: { select: Record<string, unknown> }) => {
        // Unités du stock (chargerUnitesStock).
        if (args.select.uniteRendement) return [{ id: "Radis", rendement: 2, uniteRendement: "kg_m2" }]
        // Liste de l'onglet Récoltes.
        if (args.select.userStocks) {
          return [
            {
              id: "Radis",
              familleId: "Brassicaceae",
              couleur: null,
              userStocks: base.comptage
                ? [{ inventaire: base.comptage.inventaire, dateInventaire: base.comptage.dateInventaire }]
                : [],
            },
          ]
        }
        // Espèces récoltées sans comptage (calculerStocksNet) : Radis a son comptage.
        return base.comptage ? [] : [{ id: "Radis" }]
      }),
    },
    userStockEspece: {
      findMany: vi.fn(async (args: { select: Record<string, unknown> }) =>
        args.select.rendement ? [] : base.comptage ? [base.comptage] : []
      ),
    },
    produitBoutique: { findMany: vi.fn(async () => []) },
    recolte: {
      findMany: vi.fn(async (args: { where: Record<string, unknown> }) =>
        base.lots.filter((l) => correspond(l, args.where))
      ),
    },
    consommation: { findMany: vi.fn(async () => []) },
  },
}))

import { GET } from "./route"

const radis = async () => {
  const res = await GET(new NextRequest("http://localhost/api/stocks?type=recoltes"))
  expect(res.status).toBe(200)
  const [ligne] = (await res.json()).data as Array<Record<string, unknown>>
  return ligne as { inventaire: number; comparaisonLots: Record<string, unknown> }
}

describe("GET /api/stocks?type=recoltes — lots comparés au stock (ticket cmvnpe6ip)", () => {
  beforeEach(() => {
    base.lots = ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-24"].map((jour, i) => ({
      id: 501 + i,
      userId: "u-demo",
      especeId: "Radis",
      date: new Date(`${jour}T00:00:00.000Z`),
      quantite: 2,
      unite: null,
      statut: "en_stock",
      dateVente: null,
    }))
    base.comptage = { especeId: "Radis", inventaire: 7.5, dateInventaire: COMPTAGE }
  })

  it("comptage de 7,5 kg sur quatre lots de 2 kg : écart de −0,5 kg, sans composante inventée", async () => {
    const r = await radis()

    expect(r.inventaire).toBe(7.5)
    expect(r.comparaisonLots).toEqual({
      unite: "kg",
      stockGestion: 7.5,
      dateComptage: COMPTAGE.toISOString(),
      lotsEnStock: 8,
      ecart: -0.5,
      vendusDepuisComptage: 0,
      sortiesConsommations: 0,
      lotsEnBoutique: 0,
      autresUnites: {},
    })
  })

  it("revue : lot du 05/10 vendu le 26/10, Gestion des stocks reste à 7,5 kg et la vente est nommée", async () => {
    Object.assign(base.lots[0], { statut: "vendu", dateVente: new Date("2026-10-26T10:00:00.000Z") })

    const r = await radis()

    expect(r.inventaire).toBe(7.5)
    expect(r.comparaisonLots).toMatchObject({ lotsEnStock: 6, ecart: 1.5, vendusDepuisComptage: 2 })
  })

  it("récolte saisie le jour du comptage, après lui : non ajoutée à Gestion des stocks, écart dit tel quel", async () => {
    base.lots.push({
      id: 505,
      userId: "u-demo",
      especeId: "Radis",
      date: new Date("2026-10-25T00:00:00.000Z"),
      quantite: 3,
      unite: null,
      statut: "en_stock",
      dateVente: null,
    })

    const r = await radis()

    expect(r.inventaire).toBe(7.5)
    expect(r.comparaisonLots).toMatchObject({ lotsEnStock: 11, ecart: -3.5, vendusDepuisComptage: 0 })
  })

  it("sans comptage, les lots font le stock : rien à dire", async () => {
    base.comptage = null
    const r = await radis()
    expect(r.inventaire).toBe(8)
    expect(r.comparaisonLots).toMatchObject({ stockGestion: 8, lotsEnStock: 8, ecart: 0 })
  })
})
