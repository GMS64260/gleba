/**
 * Revue 2026-10-20 — le plafond de ponte plausible d'une collecte de lot lisait
 * le compteur stocké `quantiteActuelle`, qui dérive : la mort d'une fiche
 * nominative rattachée ne le décrémente pas. Lot démo « Pintades perle A3
 * 1708 » : compteur 5, effectif reconstitué 4 (écran Lots). Le plafond et le
 * message de refus suivent désormais l'effectif reconstitué.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  lotFindFirst: vi.fn(),
  productionFindFirst: vi.fn(),
  productionCreate: vi.fn(),
  reconstituerEffectifsLots: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/elevage/effectif", () => ({ reconstituerEffectifsLots: mocks.reconstituerEffectifsLots }))
vi.mock("@/lib/prisma", () => ({
  default: {
    lotAnimaux: { findFirst: mocks.lotFindFirst },
    productionOeuf: { findFirst: mocks.productionFindFirst, create: mocks.productionCreate },
    animal: { findFirst: vi.fn() },
  },
}))

import { POST } from "./route"

const LOT_PINTADES = {
  id: 71,
  quantiteInitiale: 2,
  quantiteActuelle: 5,
  statut: "actif",
  nom: "Pintades perle A3 1708",
  especeAnimale: { nom: "Pintade perle" },
}

// Corps envoyé par Élevage > Production > « Saisir une collecte » (ProductionTab).
const corpsEcran = (quantite: number, extra: Record<string, unknown> = {}) => ({
  lotId: 71,
  date: "2026-10-20",
  quantite,
  casses: 0,
  sales: 0,
  calibre: null,
  notes: null,
  ...extra,
})

const post = (body: object) =>
  POST(new NextRequest("http://localhost/api/elevage/production-oeufs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }))

describe("POST /api/elevage/production-oeufs — plafond sur l'effectif reconstitué", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } })
    mocks.lotFindFirst.mockResolvedValue(LOT_PINTADES)
    mocks.reconstituerEffectifsLots.mockResolvedValue(
      new Map([[71, { effectifCalcule: 4, nominatifsActifs: 0, naissancesVivantes: 3, abattagesTotal: 0, sortiesNominatives: 1 }]]),
    )
    mocks.productionFindFirst.mockResolvedValue(null)
    mocks.productionCreate.mockImplementation(async ({ data }: { data: object }) => ({ id: 1, ...data }))
  })

  it("refuse 6 œufs pour 4 pintades (le compteur stocké en annonçait 5, plafond 6)", async () => {
    const res = await post(corpsEcran(6))
    const json = await res.json()

    expect(mocks.reconstituerEffectifsLots).toHaveBeenCalledWith("user-1", [LOT_PINTADES])
    expect(res.status).toBe(422)
    expect(json.code).toBe("COLLECTE_OVER_SEUIL")
    expect(json.details).toMatchObject({ quantite: 6, seuilMax: 5, effectif: 4, lotNom: "Pintades perle A3 1708" })
    expect(json.details.message).toBe(
      "4 Pintade perle ne peuvent pas pondre 6 œufs en 1 jour (plafond plausible ≈ 5). Confirmer pour forcer la saisie.",
    )
    expect(mocks.productionCreate).not.toHaveBeenCalled()
  })

  it("accepte une collecte sous le plafond de l'effectif reconstitué", async () => {
    const res = await post(corpsEcran(5))
    expect(res.status).toBe(201)
    expect(mocks.productionCreate).toHaveBeenCalledTimes(1)
  })

  it("retombe sur le compteur stocké quand le lot n'est pas reconstitué", async () => {
    mocks.reconstituerEffectifsLots.mockResolvedValue(new Map())
    const res = await post(corpsEcran(6))
    // Compteur 5 → plafond 6 : la collecte passe, comme avant.
    expect(res.status).toBe(201)
  })

  it("ne reconstitue rien quand l'éleveur force la saisie", async () => {
    const res = await post(corpsEcran(6, { overrideCoherence: true }))
    expect(res.status).toBe(201)
    expect(mocks.reconstituerEffectifsLots).not.toHaveBeenCalled()
  })
})
