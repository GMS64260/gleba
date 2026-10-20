/**
 * QA 2026-10-19 — Dashboard élevage : la tuile « Soins à planifier » annonçait
 * 3 soins « prévus dans les 30 prochains jours » pour deux retards (19/08,
 * 24/08) et un seul soin à venir (26/10). La route rend désormais les comptes
 * des lignes mêmes de la liste « Soins à faire ».
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  soinFindMany: vi.fn(),
  queryRaw: vi.fn(),
  lotFindMany: vi.fn(),
  reconstituerEffectifsLots: vi.fn(),
  calculerTetesNonPondeuses: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
// Règle pondeuse réelle (estEspecePondeuse, effectifPondeuses) ; seules les
// lectures en base sont simulées.
vi.mock("@/lib/elevage/pondeuses", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/elevage/pondeuses")>()),
  effectifsPondeursLots: vi.fn().mockResolvedValue(new Map()),
  calculerTetesNonPondeuses: mocks.calculerTetesNonPondeuses,
}))
vi.mock("@/lib/elevage/effectif", () => ({ reconstituerEffectifsLots: mocks.reconstituerEffectifsLots }))
vi.mock("@/lib/elevage/fenetre-mise-bas", () => ({ chargerFenetresMiseBas: vi.fn().mockResolvedValue([]) }))
vi.mock("@/lib/prisma", () => ({
  default: {
    soinAnimal: { findMany: mocks.soinFindMany },
    productionOeuf: { findMany: vi.fn().mockResolvedValue([]) },
    consommationAliment: { findMany: vi.fn().mockResolvedValue([]) },
    lotAnimaux: { findMany: mocks.lotFindMany },
    animal: { count: vi.fn().mockResolvedValue(0) },
    saillie: { findMany: vi.fn().mockResolvedValue([]) },
    $queryRaw: mocks.queryRaw,
  },
}))

import { GET } from "./route"

const soin = (id: number, datePrevue: string, fait = false) => ({
  id,
  date: new Date(datePrevue),
  datePrevue: new Date(datePrevue),
  type: "Vermifuge",
  description: null,
  produit: null,
  dose: null,
  voie: null,
  cout: null,
  fait,
  finAttenteLait: null,
  finAttenteOeufs: null,
  finAttenteViande: null,
  animal: { id, nom: `Animal ${id}`, identifiant: null },
  lot: null,
})

describe("GET /api/elevage/taches — comptes des soins à faire", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 19, 20, 59))
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } })
    mocks.queryRaw.mockResolvedValue([])
    mocks.soinFindMany.mockResolvedValue([])
    mocks.lotFindMany.mockResolvedValue([])
    mocks.reconstituerEffectifsLots.mockResolvedValue(new Map())
    mocks.calculerTetesNonPondeuses.mockResolvedValue(new Map())
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it("sépare les retards des soins prévus d'ici J+30, sur les lignes de la liste", async () => {
    mocks.soinFindMany.mockResolvedValue([
      soin(1, "2026-08-19T00:00:00Z"),
      soin(2, "2026-08-24T00:00:00Z"),
      soin(3, "2026-10-26T00:00:00Z"),
      soin(4, "2026-10-01T00:00:00Z", true), // fait : hors comptes
    ])
    mocks.queryRaw.mockResolvedValue([
      // Injection annulée : ni dans la liste, ni dans les comptes.
      { injectionId: "i-1", soinId: 9, numero: 2, nombreInjections: 2, datePrevue: new Date("2026-10-20T00:00:00Z"), dateRealisee: null, statut: "annulee", type: "Traitement vétérinaire", description: null, produit: null, dose: null, voie: null, finAttenteLait: null, finAttenteOeufs: null, finAttenteViande: null, cout: null, animalId: 9, animalNom: "A9", animalIdentifiant: null, lotId: null, lotNom: null },
      // Injection à faire la plus en retard : elle doit passer en tête de liste.
      { injectionId: "i-2", soinId: 8, numero: 2, nombreInjections: 3, datePrevue: new Date("2026-07-01T00:00:00Z"), dateRealisee: null, statut: "a_faire", type: "Traitement vétérinaire", description: null, produit: null, dose: null, voie: null, finAttenteLait: null, finAttenteOeufs: null, finAttenteViande: null, cout: null, animalId: 8, animalNom: "A8", animalIdentifiant: null, lotId: null, lotNom: null },
    ])
    const url = "http://localhost/api/elevage/taches?start=2026-09-19T18:59:00.000Z&end=2026-11-18T22:59:59.999Z&retards=1"
    const json = await (await GET(new NextRequest(url))).json()

    expect(json.stats.echeancesSoins).toEqual({ total: 4, enRetard: 3, aVenir: 1, auDela: 0, horizonJours: 30 })
    expect(json.stats.soinsRestants).toBe(json.stats.echeancesSoins.total)
    // Un seul ordre par échéance, soins et injections mêlés (plus en retard d'abord).
    const ordre = json.soins
      .filter((x: { fait: boolean; statutInjection?: string }) => !x.fait && x.statutInjection !== "annulee")
      .map((x: { injectionId: string | null; id: number }) => x.injectionId ?? `soin-${x.id}`)
    expect(ordre).toEqual(["i-2", "soin-1", "soin-2", "soin-3"])
  })

  // Revue 2026-10-20 — les lots « vivants » (collecte attendue, nombre de lots
  // pondeurs) étaient retenus sur le compteur stocké `quantiteActuelle > 0`,
  // qui dérive dans les deux sens. Ils le sont désormais sur l'effectif
  // reconstitué, après reconstitution.
  it("retient les lots dont l'effectif reconstitué est > 0, quel que soit le compteur stocké", async () => {
    const espece = { ponteAnnuelle: 200, production: "mixte", nom: "Pintade perle", dureeElevage: 150 }
    // Lot démo 71 : compteur 5, effectif 4.
    const pintades = { id: 71, quantiteInitiale: 2, quantiteActuelle: 5, statut: "actif", especeAnimale: espece }
    // Compteur 0, deux fiches nominatives rattachées : lot vivant.
    const fiches = { id: 90, quantiteInitiale: 2, quantiteActuelle: 0, statut: "actif", especeAnimale: espece }
    // Compteur 1, sa seule tête (fiche rattachée) est morte : lot vide.
    const fantome = { id: 91, quantiteInitiale: 1, quantiteActuelle: 1, statut: "actif", especeAnimale: espece }
    mocks.lotFindMany.mockResolvedValue([pintades, fiches, fantome])
    mocks.reconstituerEffectifsLots.mockResolvedValue(new Map([
      [71, { effectifCalcule: 4 }],
      [90, { effectifCalcule: 2 }],
      [91, { effectifCalcule: 0 }],
    ]))
    mocks.calculerTetesNonPondeuses.mockResolvedValue(new Map([[71, 1]]))

    const url = "http://localhost/api/elevage/taches?start=2026-10-19T00:00:00.000Z&end=2026-10-25T23:59:59.999Z"
    const json = await (await GET(new NextRequest(url))).json()

    expect(mocks.lotFindMany.mock.calls[0][0].where).toEqual({ userId: "user-1" })
    expect(mocks.reconstituerEffectifsLots).toHaveBeenCalledWith("user-1", [pintades, fiches, fantome])
    expect(mocks.calculerTetesNonPondeuses.mock.calls[0][1]).toEqual([pintades, fiches])
    expect(json.stats.nbLotsPondeuses).toBe(2)
    // (4 − 1 jeune) + 2 pondeuses = 5 pondeuses × 40 % (octobre, profil standard) = 2 œufs/jour.
    expect(json.stats.estimationOeufsJour).toBe(2)
  })
})
