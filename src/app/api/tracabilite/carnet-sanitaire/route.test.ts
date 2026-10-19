/**
 * QA 2026-10-19 — Traçabilité > Carnet sanitaire : un Vermifuge et une
 * Vaccination saisis en Élevage s'affichaient « Autre », et le filtre Vermifuge
 * ne retrouvait pas la ligne, alors que le résumé les distinguait.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  soinFindMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: { soinAnimal: { findMany: mocks.soinFindMany } },
}))

import { GET } from "./route"

const soin = (id: number, type: string, date: string) => ({
  id,
  date: new Date(date),
  type,
  animalId: id,
  lotId: null,
  animal: { id, nom: `Animal ${id}`, identifiant: null, race: null, especeAnimale: { nom: "Ovin" } },
  lot: null,
  description: null,
  produit: "Produit",
  quantite: null,
  unite: null,
  cout: null,
  veterinaire: null,
  datePrevue: null,
  fait: true,
  notes: null,
})

describe("GET /api/tracabilite/carnet-sanitaire", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } })
  })

  it("garde le type saisi par l'écran, en clé et en libellé, et le résumé compte la même clé", async () => {
    mocks.soinFindMany.mockResolvedValue([
      soin(1, "Vermifuge", "2026-03-15T00:00:00Z"),
      soin(2, "Vaccination", "2026-10-19T00:00:00Z"),
      soin(3, "vermifuge", "2026-04-01T00:00:00Z"), // ancien code en minuscules
      soin(4, "Traitement vétérinaire", "2026-05-01T00:00:00Z"),
    ])
    const res = await GET(new NextRequest("http://localhost/api/tracabilite/carnet-sanitaire?annee=2026"))
    const json = await res.json()

    expect(json.carnet.map((e: { type: string; typeLabel: string }) => [e.type, e.typeLabel])).toEqual([
      ["Vermifuge", "Vermifuge"],
      ["Vaccination", "Vaccination"],
      ["Vermifuge", "Vermifuge"],
      ["Traitement vétérinaire", "Traitement vétérinaire"],
    ])
    expect(json.stats.parType).toEqual({ Vermifuge: 2, Vaccination: 1, "Traitement vétérinaire": 1 })
    // Le filtre de l'écran compare `type` à la clé choisie : les deux vermifuges sortent.
    expect(json.carnet.filter((e: { type: string }) => e.type === "Vermifuge")).toHaveLength(2)
    expect(mocks.soinFindMany.mock.calls[0][0].where).toMatchObject({ userId: "user-1", fait: true })
  })
})
