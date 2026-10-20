/**
 * Revue 2026-10-20 — Traçabilité > Registre d'élevage : la sortie d'un lot
 * réformé inscrivait le compteur stocké `quantiteActuelle`, qui dérive (la
 * mort d'une fiche rattachée ne le décrémente pas). Elle suit désormais
 * l'effectif reconstitué, comme la déclaration de sortie, sans écrire « 0 ».
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  lotFindMany: vi.fn(),
  reconstituerEffectifsLots: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/elevage/effectif", () => ({ reconstituerEffectifsLots: mocks.reconstituerEffectifsLots }))
vi.mock("@/lib/prisma", () => ({
  default: {
    animal: { findMany: vi.fn().mockResolvedValue([]) },
    naissanceAnimale: { findMany: vi.fn().mockResolvedValue([]) },
    soinAnimal: { findMany: vi.fn().mockResolvedValue([]) },
    lotAnimaux: { findMany: mocks.lotFindMany },
    abattage: { findMany: vi.fn().mockResolvedValue([]) },
    user: { findUnique: vi.fn().mockResolvedValue({ name: "Ferme démo" }) },
  },
}))

import { GET } from "./route"

const espece = { nom: "Pintade perle" }
// Lot démo 71 réformé de force avec ses têtes : compteur 5, effectif 4.
const pintades = {
  id: 71, nom: "Pintades perle A3 1708", quantiteInitiale: 2, quantiteActuelle: 5,
  dateArrivee: new Date("2026-08-17T00:00:00Z"), dateReforme: new Date("2026-10-20T00:00:00Z"),
  provenance: null, prixAchatTotal: null, especeAnimale: espece,
}
// Lot soldé par ses abattages ; le compteur a gardé une tête fantôme.
const solde = {
  id: 80, nom: "Lapins 2025", quantiteInitiale: 3, quantiteActuelle: 1,
  dateArrivee: null, dateReforme: new Date("2026-09-01T00:00:00Z"),
  provenance: null, prixAchatTotal: null, especeAnimale: espece,
}

describe("GET /api/tracabilite/registre-elevage — sortie d'un lot réformé", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } })
    // Premier appel : lots arrivés dans l'année ; second : lots réformés.
    mocks.lotFindMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
      where.dateReforme ? [solde, pintades] : [pintades],
    )
    mocks.reconstituerEffectifsLots.mockResolvedValue(new Map([
      [71, { effectifCalcule: 4 }],
      [80, { effectifCalcule: 0 }],
    ]))
  })

  it("inscrit l'effectif reconstitué et n'annonce pas « 0 tête » pour un lot soldé", async () => {
    const json = await (await GET(new NextRequest("http://localhost/api/tracabilite/registre-elevage?annee=2026"))).json()
    const lignes = json.entries.map((e: { type: string; animal: string; identifiant: string; detail: string }) =>
      [e.type, e.animal, e.identifiant, e.detail.startsWith("Provenance") ? "Provenance" : e.detail])

    expect(mocks.reconstituerEffectifsLots).toHaveBeenCalledWith("user-1", [solde, pintades])
    expect(lignes).toEqual([
      ["entree", "Pintades perle A3 1708", "Lot 2 têtes", "Provenance"],
      ["sortie", "Lapins 2025", "Lot soldé", "Réforme du lot : aucune tête restante, sorties inscrites par leurs propres mouvements"],
      ["sortie", "Pintades perle A3 1708", "Lot 4 têtes", "Réforme du lot (4 têtes)"],
    ])
    expect(json.stats.totalSorties).toBe(2)
  })
})
