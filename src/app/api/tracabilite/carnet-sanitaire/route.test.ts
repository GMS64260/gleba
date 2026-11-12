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
  reconstituerEffectifsLots: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/elevage/effectif", () => ({ reconstituerEffectifsLots: mocks.reconstituerEffectifsLots }))
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
    mocks.reconstituerEffectifsLots.mockResolvedValue(new Map())
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

  // C10 (revue réglementaire du 2026-11-12) : « (N animaux) » derrière le lot
  // d'un soin donnait l'effectif d'AUJOURD'HUI (reconstitué), présenté comme
  // le groupe traité. Le test précédent (revue du 2026-10-20) entérinait cette
  // règle : un lot de 100 poules traité en mars puis réduit à 60 affichait
  // « (60 animaux) » pour le traitement de mars. Seul l'effectif figé au jour
  // du soin (`effectifTraite`) est désormais affiché.
  it("affiche l'effectif figé au jour du soin, jamais l'effectif actuel du lot", async () => {
    const pondeuses = { id: 71, nom: "Pondeuses A", quantiteInitiale: 100, quantiteActuelle: 60, especeAnimale: { nom: "Poule" } }
    const soinLot = (id: number, effectifTraite: number | null) => ({
      ...soin(id, "Vermifuge", "2026-03-15T00:00:00Z"),
      animalId: null,
      animal: null,
      lotId: pondeuses.id,
      lot: pondeuses,
      effectifTraite,
    })
    mocks.soinFindMany.mockResolvedValue([soinLot(1, 100), soinLot(2, null), soinLot(3, 1)])
    mocks.reconstituerEffectifsLots.mockResolvedValue(new Map([[71, { effectifCalcule: 60 }]]))

    const json = await (await GET(new NextRequest("http://localhost/api/tracabilite/carnet-sanitaire?annee=2026"))).json()

    expect(json.carnet.map((e: { animalLot: string }) => e.animalLot)).toEqual([
      "Pondeuses A (100 animaux traités)",
      "Pondeuses A",
      "Pondeuses A (1 animal traité)",
    ])
    expect(json.carnet.map((e: { effectifTraite: number | null }) => e.effectifTraite)).toEqual([100, null, 1])
    expect(mocks.reconstituerEffectifsLots).not.toHaveBeenCalled()
  })

  it("se présente comme un résumé et renvoie au dossier complet", async () => {
    mocks.soinFindMany.mockResolvedValue([])
    const json = await (await GET(new NextRequest("http://localhost/api/tracabilite/carnet-sanitaire?annee=2026"))).json()
    expect(json.meta.type).toBe("resume_sanitaire")
    expect(json.meta.dossierComplet).toMatchObject({ url: "/elevage?tab=alimentation&sub=registre" })
    expect(json.meta.avertissement).toMatch(/résumé/i)
  })
})
