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
  animalFindMany: vi.fn(),
  abattageFindMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/elevage/effectif", () => ({ reconstituerEffectifsLots: mocks.reconstituerEffectifsLots }))
vi.mock("@/lib/prisma", () => ({
  default: {
    animal: { findMany: mocks.animalFindMany },
    naissanceAnimale: { findMany: vi.fn().mockResolvedValue([]) },
    soinAnimal: { findMany: vi.fn().mockResolvedValue([]) },
    lotAnimaux: { findMany: mocks.lotFindMany },
    abattage: { findMany: mocks.abattageFindMany },
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
    mocks.animalFindMany.mockResolvedValue([])
    mocks.abattageFindMany.mockResolvedValue([])
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

describe("GET /api/tracabilite/registre-elevage — un événement, une ligne", () => {
  const brebis = { nom: "Brebis" }
  const jour = (d: string) => new Date(`${d}T00:00:00Z`)
  const fiche = (surcharge: object) => ({
    id: 1, nom: "Blanchette", identifiant: "FR1", statut: "actif", especeAnimale: brebis, lot: null,
    dateArrivee: null, dateNaissance: null, dateSortie: null, causeSortie: null, provenance: null,
    nExploitationOrigine: null, prixAchat: null, ficheNaissance: null, ...surcharge,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } })
    mocks.lotFindMany.mockResolvedValue([])
    mocks.reconstituerEffectifsLots.mockResolvedValue(new Map())
  })

  it("n'inscrit qu'une sortie pour un animal abattu, et qu'une naissance pour un petit fiché", async () => {
    mocks.animalFindMany.mockResolvedValue([
      // Abattue : la ligne de l'abattage suffit.
      fiche({ id: 1, statut: "abattu", dateSortie: jour("2026-06-10"), causeSortie: "Abattage" }),
      // Petit né sur place avec sa fiche de naissance : déjà inscrit par la naissance.
      fiche({ id: 2, nom: "Agneau", dateArrivee: jour("2026-03-01"), dateNaissance: jour("2026-03-01"), ficheNaissance: { id: "p1" } }),
      // Né sur place sans naissance saisie : une naissance, pas une entrée.
      fiche({ id: 3, nom: "Cabri", dateArrivee: jour("2026-04-01"), dateNaissance: jour("2026-04-01") }),
      // Achetée : une entrée. Morte : un décès.
      fiche({ id: 4, nom: "Achetée", dateArrivee: jour("2026-05-01"), provenance: "Ferme voisine" }),
      fiche({ id: 5, nom: "Morte", statut: "mort", dateSortie: jour("2026-07-01") }),
    ])
    mocks.abattageFindMany.mockResolvedValue([
      { id: 9, animalId: 1, lotId: null, date: jour("2026-06-10"), quantite: 1, destination: "vente", poidsCarcasse: 18, animal: { nom: "Blanchette", identifiant: "FR1", especeAnimale: brebis }, lot: null },
    ])

    const json = await (await GET(new NextRequest("http://localhost/api/tracabilite/registre-elevage?annee=2026"))).json()
    const lignes = (json.data ?? json.entries ?? json.registre) as Array<{ type: string; animal: string; detail: string }>
    const de = (nom: string) => lignes.filter((l) => l.animal === nom).map((l) => l.type)

    expect(de("Blanchette")).toEqual(["sortie"])
    expect(lignes.find((l) => l.animal === "Blanchette")?.detail).toContain("Abattage")
    expect(de("Agneau")).toEqual([])
    expect(de("Cabri")).toEqual(["naissance"])
    expect(de("Achetée")).toEqual(["entree"])
    expect(de("Morte")).toEqual(["deces"])
  })
})
