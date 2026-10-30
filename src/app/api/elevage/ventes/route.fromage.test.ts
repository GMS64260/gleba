/**
 * Vente de fromage depuis la cave : la sortie de cave suit l'unité de vente.
 * QA 2026-10-19 — corps envoyé par la Cave (AffinageSubTab, « Sortie > Vente »)
 * pour 2 pièces à 2 €/pièce, champ poids vide.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  lotFindFirst: vi.fn(),
  lotUpdate: vi.fn(),
  venteCreate: vi.fn(),
  mouvementCreate: vi.fn(),
  executeRaw: vi.fn(),
  createVente: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/kpi", () => ({ invalidateKpi: vi.fn() }))
vi.mock("@/lib/auto-compta", () => ({
  createVenteFromVenteProduit: mocks.createVente,
  deleteAutoEntry: vi.fn(),
}))
vi.mock("@/lib/facture-utils", () => ({ creerFacture: vi.fn(), annulerFactureLiee: vi.fn() }))
vi.mock("@/lib/prisma", () => {
  const tx = {
    $executeRaw: mocks.executeRaw,
    lotFromage: { findFirst: mocks.lotFindFirst, update: mocks.lotUpdate },
    venteProduit: { create: mocks.venteCreate },
    mouvementFromage: { create: mocks.mouvementCreate },
  }
  return {
    default: {
      lotFromage: { findFirst: mocks.lotFindFirst },
      $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    },
  }
})

import { POST } from "./route"

const corpsCave = (surcharge: Record<string, unknown> = {}) => ({
  date: "2026-10-19",
  type: "fromage",
  description: "Crottin — L-2026-W01-01",
  quantite: 2,
  unite: "pièce",
  prixUnitaire: 2,
  client: null,
  lotFromageId: "lot-1",
  paye: true,
  ...surcharge,
})

const requete = (body: unknown) =>
  new NextRequest("http://localhost/api/elevage/ventes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

describe("POST /api/elevage/ventes — fromage", () => {
  let mouvements: Array<{ nbPieces: number; poidsKg: number }>

  beforeEach(() => {
    vi.clearAllMocks()
    mouvements = []
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } })
    mocks.lotFindFirst.mockImplementation(async () => ({
      id: "lot-1",
      userId: "user-1",
      nbPieces: 4,
      poidsTotalKg: 0.3,
      etat: "pret",
      mouvements: [...mouvements],
    }))
    mocks.venteCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 7, ...data }))
    mocks.mouvementCreate.mockImplementation(async ({ data }: { data: { nbPieces: number; poidsKg: number } }) => {
      mouvements.push({ nbPieces: data.nbPieces, poidsKg: data.poidsKg })
      return data
    })
  })

  it("une vente à la pièce sort des pièces, pas des kilos, et facture 2 × 2 €", async () => {
    const res = await POST(requete(corpsCave()))
    expect(res.status).toBe(201)
    expect(mocks.venteCreate.mock.calls[0][0].data).toMatchObject({ quantite: 2, unite: "pièce", prixTotal: 4 })
    expect(mocks.mouvementCreate.mock.calls[0][0].data).toMatchObject({ nbPieces: 2, poidsKg: 0, type: "sortie_vente" })
    // 2 pièces sur 4 : le lot n'est pas écoulé.
    expect(mocks.lotUpdate).not.toHaveBeenCalled()
  })

  // Décision du 2026-10-30 : une vente démarre payée, sauf vente à crédit.
  it("une sortie de cave vendue sans statut explicite est présumée payée, avec son mode", async () => {
    const res = await POST(requete(corpsCave({ paye: undefined, modeReglement: 'Virement' })))
    expect(res.status).toBe(201)
    expect(mocks.venteCreate.mock.calls[0][0].data).toMatchObject({ paye: true })
    expect(mocks.createVente).toHaveBeenCalledWith('user-1', expect.objectContaining({
      paye: true, modeReglement: 'Virement',
    }), expect.anything())
    expect(mocks.mouvementCreate.mock.calls[0][0].data).toMatchObject({ nbPieces: 2 })
  })

  it.each([
    [{ paye: false, modeReglement: 'Chèque' }, 'Chèque'],
    [{ paye: undefined, modeReglement: 'À crédit' }, 'À crédit'],
  ])("une vente décochée ou « À crédit » reste à encaisser (%o)", async (encaissement, mode) => {
    const res = await POST(requete(corpsCave(encaissement)))
    expect(res.status).toBe(201)
    expect(mocks.venteCreate.mock.calls[0][0].data).toMatchObject({ paye: false })
    expect(mocks.createVente).toHaveBeenCalledWith('user-1', expect.objectContaining({
      paye: false, modeReglement: mode,
    }), expect.anything())
  })

  it("refuse une vente déclarée payée et « À crédit » à la fois, sans sortie de cave", async () => {
    const res = await POST(requete(corpsCave({ paye: true, modeReglement: 'À crédit' })))
    expect(res.status).toBe(400)
    expect((await res.json()).details.fieldErrors.modeReglement).toBeDefined()
    expect(mocks.venteCreate).not.toHaveBeenCalled()
    expect(mocks.mouvementCreate).not.toHaveBeenCalled()
  })

  it("une vente au gramme sort son poids en kg", async () => {
    const res = await POST(requete(corpsCave({ quantite: 150, unite: "g", prixUnitaire: 0.02 })))
    expect(res.status).toBe(201)
    expect(mocks.mouvementCreate.mock.calls[0][0].data).toMatchObject({ nbPieces: 0, poidsKg: 0.15 })
  })

  it("refuse une unité sans sens pour un fromage en nommant le champ", async () => {
    const res = await POST(requete(corpsCave({ unite: "douzaine" })))
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.details.fieldErrors.unite).toBeDefined()
    expect(mocks.venteCreate).not.toHaveBeenCalled()
  })

  it("refuse plus de pièces que le compte n'en laisse", async () => {
    mouvements = [{ nbPieces: 3, poidsKg: 0 }]
    const res = await POST(requete(corpsCave({ quantite: 2 })))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain("1 pièce(s) en cave")
  })

  it("vend une pièce restante même si le poids moyen est déjà consommé", async () => {
    // 2 pièces données pesées 0,2 kg, 1 vendue sans pesée : 0 kg au calcul,
    // mais la 4e pièce existe et se vend.
    mouvements = [{ nbPieces: 2, poidsKg: 0.2 }, { nbPieces: 1, poidsKg: 0 }]
    const res = await POST(requete(corpsCave({ quantite: 1 })))
    expect(res.status).toBe(201)
  })

  it("la dernière pièce vendue passe le lot en écoulé", async () => {
    mouvements = [{ nbPieces: 3, poidsKg: 0 }]
    const res = await POST(requete(corpsCave({ quantite: 1 })))
    expect(res.status).toBe(201)
    expect(mocks.lotUpdate).toHaveBeenCalledWith({ where: { id: "lot-1" }, data: { etat: "ecoule" } })
  })
})
