/**
 * Comptabilité > Clients — compteur de ventes (ticket cmvgeecem, 2026-10-20).
 *
 * Constat sur la démo : une vente de récolte facturée (F-2026-0007, 48 €) porte
 * le `clientId` sur la récolte et sur la facture, mais n'a pas d'écriture
 * `VenteManuelle` (la facture la porte). Le compteur lisait
 * `_count.ventesManuelles` : « 0 ventes ». Il compte désormais écritures et
 * factures rattachées par `clientId` (`compterVentesParClient`).
 */

import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  clientFindMany: vi.fn(),
  venteGroupBy: vi.fn(),
  factureGroupBy: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    client: { findMany: mocks.clientFindMany },
    venteManuelle: { groupBy: mocks.venteGroupBy },
    facture: { groupBy: mocks.factureGroupBy },
  },
}))

import { GET } from "./route"

/** Requête envoyée par l'écran Clients (`fetchData`) : `actif=true` sauf « Afficher inactifs ». */
const requete = (query: string) => new NextRequest(`http://localhost/api/comptabilite/clients?${query}`)

const fiche = (id: number, nom: string, actif = true) => ({ id, userId: "u1", nom, type: "particulier", actif })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u1" } } })
})

describe("GET /api/comptabilite/clients — nbVentes", () => {
  it("compte la vente de récolte facturée d'un client qui n'a aucune écriture", async () => {
    // Cas du ticket, inactifs affichés (corps réel de l'écran : pas de `actif`).
    mocks.clientFindMany.mockResolvedValue([
      fiche(99, "v8-Nathalie Amap 2010", false),
      fiche(100, "v8-Nathalie Boutique 2010"),
    ])
    // Boutique 2010 : l'écriture de sa commande boutique ; Amap 2010 : aucune.
    mocks.venteGroupBy.mockResolvedValue([{ clientId: 100, _count: { _all: 1 } }])
    // Amap 2010 : F-2026-0007 (vente de récolte facturée).
    mocks.factureGroupBy.mockResolvedValue([{ clientId: 99, _count: { _all: 1 } }])

    const res = await GET(requete(""))

    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.map((c: { id: number; nbVentes: number }) => [c.id, c.nbVentes])).toEqual([
      [99, 1],
      [100, 1],
    ])
  })

  it("additionne écritures et factures et ne compte ni avoir, ni brouillon, ni facture annulée", async () => {
    mocks.clientFindMany.mockResolvedValue([fiche(7, "Restaurant"), fiche(8, "Sans vente")])
    mocks.venteGroupBy.mockResolvedValue([{ clientId: 7, _count: { _all: 2 } }])
    mocks.factureGroupBy.mockResolvedValue([{ clientId: 7, _count: { _all: 3 } }])

    const res = await GET(requete("actif=true"))
    const { data } = await res.json()

    expect(data.find((c: { id: number }) => c.id === 7).nbVentes).toBe(5)
    expect(data.find((c: { id: number }) => c.id === 8).nbVentes).toBe(0)
    // Lecture scopée au compte et aux fiches listées.
    expect(mocks.clientFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1", actif: true } }),
    )
    expect(mocks.venteGroupBy).toHaveBeenCalledWith({
      by: ["clientId"],
      where: { userId: "u1", clientId: { in: [7, 8] } },
      _count: { _all: true },
    })
    expect(mocks.factureGroupBy).toHaveBeenCalledWith({
      by: ["clientId"],
      where: {
        userId: "u1",
        clientId: { in: [7, 8] },
        type: { not: "avoir" },
        statut: { notIn: ["annulee", "brouillon"] },
      },
      _count: { _all: true },
    })
  })

  it("n'interroge pas les ventes quand aucune fiche ne correspond", async () => {
    mocks.clientFindMany.mockResolvedValue([])

    const res = await GET(requete("actif=true&search=zzz"))

    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual([])
    expect(mocks.venteGroupBy).not.toHaveBeenCalled()
    expect(mocks.factureGroupBy).not.toHaveBeenCalled()
  })
})
