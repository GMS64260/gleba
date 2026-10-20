/**
 * Revue 2026-10-20 — la garde d'un abattage de lot (`ABATTAGE_OVER_EFFECTIF`)
 * lisait le compteur stocké `quantiteActuelle`, qui dérive : la mort d'une
 * fiche rattachée ne le décrémente pas. Lot démo « Pintades perle A3 1708 » :
 * compteur 5, effectif 4, on pouvait en abattre 5. Le plafond est désormais la
 * part collective reconstituée (effectif moins les fiches actives rattachées),
 * celle que l'écran Lots affiche et borne.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  lotFindFirst: vi.fn(),
  soinFindMany: vi.fn(),
  abattageCreate: vi.fn(),
  lotUpdate: vi.fn(),
  reconstituerEffectifsLots: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/elevage/effectif", () => ({ reconstituerEffectifsLots: mocks.reconstituerEffectifsLots }))
vi.mock("@/lib/auto-compta", () => ({ createVenteFromAbattage: vi.fn(), deleteAutoEntry: vi.fn() }))
vi.mock("@/lib/kpi", () => ({ invalidateKpi: vi.fn() }))
vi.mock("@/lib/facture-utils", () => ({ creerFacture: vi.fn(), annulerFactureLiee: vi.fn() }))
vi.mock("@/lib/prisma", () => {
  const tx = {
    abattage: { create: mocks.abattageCreate },
    animal: { findFirst: vi.fn(), update: vi.fn() },
    lotAnimaux: { findFirst: mocks.lotFindFirst, update: mocks.lotUpdate },
  }
  return {
    default: {
      lotAnimaux: { findFirst: mocks.lotFindFirst },
      animal: { findFirst: vi.fn().mockResolvedValue({ id: 500 }) },
      soinAnimal: { findMany: mocks.soinFindMany },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    },
  }
})

import { POST } from "./route"

const PINTADES = { id: 71, nom: "Pintades perle A3 1708", quantiteInitiale: 2, quantiteActuelle: 5, statut: "actif" }

// Corps envoyé par Élevage > Animaux > Lots > « Abattage depuis un lot » (AnimauxTab).
const corpsEcranLot = (lotId: number, quantite: number) => ({
  lotId,
  date: "2026-10-20",
  quantite,
  poidsVif: null,
  poidsCarcasse: null,
  destination: "auto_consommation",
  prixVente: null,
  lieu: null,
  nEtablissementDestination: null,
  notes: null,
})

const post = (body: object) =>
  POST(new NextRequest("http://localhost/api/elevage/abattages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }))

describe("POST /api/elevage/abattages — plafond d'un abattage de lot", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } })
    mocks.lotFindFirst.mockResolvedValue(PINTADES)
    mocks.soinFindMany.mockResolvedValue([])
    mocks.abattageCreate.mockImplementation(async ({ data }: { data: object }) => ({ id: 1, ...data, animal: null, lot: PINTADES }))
    mocks.reconstituerEffectifsLots.mockResolvedValue(new Map([
      [71, { effectifCalcule: 4, nominatifsActifs: 0, effectifCollectif: 4 }],
    ]))
  })

  it("refuse d'abattre 5 pintades quand 4 têtes collectives sont présentes (compteur stocké : 5)", async () => {
    const res = await post(corpsEcranLot(71, 5))
    const json = await res.json()

    expect(mocks.reconstituerEffectifsLots).toHaveBeenCalledWith("user-1", [PINTADES])
    expect(res.status).toBe(422)
    expect(json.code).toBe("ABATTAGE_OVER_EFFECTIF")
    expect(json.details).toMatchObject({ quantite: 5, effectifActuel: 4, effectifCollectif: 4, nominatifsActifs: 0 })
    expect(json.details.message).toBe(
      "4 têtes collectives présentes dans le lot « Pintades perle A3 1708 » : impossible d'en abattre 5.",
    )
    expect(mocks.abattageCreate).not.toHaveBeenCalled()
  })

  it("accepte d'abattre les 4 têtes collectives et décrémente le compteur stocké", async () => {
    const res = await post(corpsEcranLot(71, 4))

    expect(res.status).toBe(201)
    expect(mocks.abattageCreate).toHaveBeenCalledTimes(1)
    expect(mocks.lotUpdate).toHaveBeenCalledWith({ where: { id: 71 }, data: { quantiteActuelle: 1, statut: "actif" } })
  })

  it("plafonne à la part collective et renvoie vers la fiche quand une fiche active est rattachée", async () => {
    const lot = { id: 73, nom: "Canards Duclair", quantiteInitiale: 4, quantiteActuelle: 3, statut: "actif" }
    mocks.lotFindFirst.mockResolvedValue(lot)
    mocks.reconstituerEffectifsLots.mockResolvedValue(new Map([
      [73, { effectifCalcule: 4, nominatifsActifs: 1, effectifCollectif: 3 }],
    ]))

    const refus = await post(corpsEcranLot(73, 4))
    const json = await refus.json()
    expect(refus.status).toBe(422)
    expect(json.details).toMatchObject({ effectifCollectif: 3, nominatifsActifs: 1 })
    expect(json.details.message).toBe(
      "3 têtes collectives présentes dans le lot « Canards Duclair » : impossible d'en abattre 4. La fiche nominative rattachée au lot s'abat depuis sa fiche.",
    )

    expect((await post(corpsEcranLot(73, 3))).status).toBe(201)
  })

  it("ne plafonne pas l'abattage d'une fiche nominative (son propre parcours)", async () => {
    const res = await post({ ...corpsEcranLot(71, 1), lotId: undefined, animalId: 500 })
    expect(res.status).toBe(201)
    expect(mocks.reconstituerEffectifsLots).not.toHaveBeenCalled()
  })
})
