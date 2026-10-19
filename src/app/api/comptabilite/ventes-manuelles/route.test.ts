/**
 * Ventes manuelles — appartenance du client, au POST comme au PATCH.
 *
 * Défaut corrigé (2026-10-19) : le POST vérifiait que `clientId` désigne un
 * client du compte, le PATCH réaffectait `clientId` sans rien vérifier. Un
 * appel direct à l'API rattachait donc une vente au client d'un autre compte
 * (l'id est un entier facile à deviner). Les deux passent désormais par
 * `exigerClientDuCompte`, avec le même refus qui nomme le champ.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  venteFindFirst: vi.fn(),
  venteUpdate: vi.fn(),
  venteCreate: vi.fn(),
  clientFindFirst: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/kpi", () => ({ invalidateKpi: vi.fn() }))
vi.mock("@/lib/prisma", () => {
  const db = {
    venteManuelle: {
      findFirst: mocks.venteFindFirst,
      update: mocks.venteUpdate,
      create: mocks.venteCreate,
    },
    client: { findFirst: mocks.clientFindFirst },
  }
  return { default: { ...db, $transaction: (callback: (tx: unknown) => unknown) => callback(db) } }
})

import { PATCH, POST } from "./route"

const requete = (method: "POST" | "PATCH", body: object) =>
  new NextRequest("http://localhost/api/comptabilite/ventes-manuelles", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

const venteManuelle = {
  id: 12,
  userId: "u1",
  auto: false,
  sourceType: null,
  sourceId: null,
  montant: 30,
  tauxTVA: 5.5,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u1" } } })
  mocks.venteFindFirst.mockResolvedValue(venteManuelle)
  mocks.venteUpdate.mockImplementation(({ data }: { data: object }) => ({ ...venteManuelle, ...data }))
  mocks.venteCreate.mockImplementation(({ data }: { data: object }) => ({ id: 13, ...data }))
})

describe("PATCH /api/comptabilite/ventes-manuelles — clientId", () => {
  it("refuse le client d'un autre compte, nomme le champ et n'écrit rien", async () => {
    mocks.clientFindFirst.mockResolvedValue(null)

    const res = await PATCH(requete("PATCH", { id: 12, clientId: 999 }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: "Client 999 introuvable pour ce compte",
      champ: "clientId",
    })
    // La recherche est bornée au compte de la session.
    expect(mocks.clientFindFirst).toHaveBeenCalledWith({
      where: { id: 999, userId: "u1" },
      select: { id: true },
    })
    expect(mocks.venteUpdate).not.toHaveBeenCalled()
  })

  it("accepte un client du compte", async () => {
    mocks.clientFindFirst.mockResolvedValue({ id: 7 })

    const res = await PATCH(requete("PATCH", { id: 12, clientId: 7 }))

    expect(res.status).toBe(200)
    expect(mocks.venteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clientId: 7 }) })
    )
  })

  it("détacher le client (null) ne demande aucune vérification", async () => {
    const res = await PATCH(requete("PATCH", { id: 12, clientId: null }))

    expect(res.status).toBe(200)
    expect(mocks.clientFindFirst).not.toHaveBeenCalled()
    expect(mocks.venteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clientId: null }) })
    )
  })

  it("le corps de la modale « Corriger l'écriture » (sans clientId) passe comme avant", async () => {
    const res = await PATCH(
      requete("PATCH", { id: 12, date: "2026-10-01", categorie: "legumes", clientNom: "Marché", paye: true })
    )

    expect(res.status).toBe(200)
    expect(mocks.clientFindFirst).not.toHaveBeenCalled()
  })
})

describe("POST /api/comptabilite/ventes-manuelles — clientId", () => {
  it("refuse le client d'un autre compte avec le même refus qu'au PATCH", async () => {
    mocks.clientFindFirst.mockResolvedValue(null)

    const res = await POST(
      requete("POST", { categorie: "legumes", description: "Panier", montant: 20, clientId: 999 })
    )

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: "Client 999 introuvable pour ce compte",
      champ: "clientId",
    })
    expect(mocks.venteCreate).not.toHaveBeenCalled()
  })
})
