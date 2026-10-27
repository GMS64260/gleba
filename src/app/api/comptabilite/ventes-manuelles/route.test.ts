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
  sourceUpdateMany: vi.fn(),
  clientFindFirst: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/kpi", () => ({ invalidateKpi: vi.fn() }))
vi.mock("@/lib/prisma", () => {
  const db = {
    $queryRaw: async () => [{ id: 167 }],
    venteManuelle: {
      findFirst: mocks.venteFindFirst,
      update: mocks.venteUpdate,
      create: mocks.venteCreate,
    },
    venteProduit: { updateMany: mocks.sourceUpdateMany },
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
  mocks.sourceUpdateMany.mockResolvedValue({ count: 1 })
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

/**
 * Ticket cmvgdzsf7 (2026-10-20) — suivi d'une écriture dérivée depuis
 * Comptabilité > Transactions > Revenus (« Règlement et pièce »). Corps réel de
 * `saveSuivi` : l'id du miroir et les seuls champs modifiés parmi
 * `CHAMPS_DE_SUIVI_SAISIS_VENTE` (vide → null).
 */
describe("PATCH /api/comptabilite/ventes-manuelles — écriture dérivée", () => {
  // Miroir de la vente d'œufs « v8-Nathalie 2010 Œufs marché » (86,40 €).
  const miroirVenteProduit = {
    ...venteManuelle,
    id: 909,
    auto: true,
    sourceType: "vente_produit",
    sourceId: 167,
    montant: 86.4,
  }

  beforeEach(() => {
    mocks.venteFindFirst.mockResolvedValue(miroirVenteProduit)
  })

  it("enregistre le règlement, la pièce et les notes envoyés par l'écran", async () => {
    const res = await PATCH(
      requete("PATCH", { id: 909, modeReglement: "Chèque", numeroPiece: "CHQ-0042", notes: "Remis en banque" })
    )

    expect(res.status).toBe(200)
    expect(mocks.venteFindFirst).toHaveBeenCalledWith({ where: { id: 909, userId: "u1" } })
    expect(mocks.venteUpdate).toHaveBeenCalledWith({
      where: { id: 909, userId: "u1" },
      data: { modeReglement: "Chèque", numeroPiece: "CHQ-0042", notes: "Remis en banque" },
    })
  })

  it("efface un champ vidé (null) sans toucher au reste", async () => {
    const res = await PATCH(requete("PATCH", { id: 909, numeroPiece: null }))

    expect(res.status).toBe(200)
    expect(mocks.venteUpdate).toHaveBeenCalledWith({ where: { id: 909, userId: "u1" }, data: { numeroPiece: null } })
  })

  it("refuse le montant d'une ligne dérivée, nomme le champ et dit où corriger", async () => {
    const res = await PATCH(requete("PATCH", { id: 909, montant: 90, numeroPiece: "CHQ-0042" }))

    expect(res.status).toBe(400)
    const corps = await res.json()
    expect(corps.champ).toBe("montant")
    expect(corps.error).toContain("une vente de l'atelier d'élevage")
    expect(mocks.venteUpdate).not.toHaveBeenCalled()
  })

  it("garde « marquer comme payé » des impayés ouvert sur une ligne dérivée", async () => {
    const res = await PATCH(requete("PATCH", { id: 909, paye: true }))

    expect(res.status).toBe(200)
    expect(mocks.venteUpdate).toHaveBeenCalledWith({ where: { id: 909, userId: "u1" }, data: { paye: true } })
    expect(mocks.sourceUpdateMany).toHaveBeenCalledWith({ where: { id: 167, userId: "u1", annule: false, factureId: null }, data: { paye: true } })
  })

  it("nomme un mode de règlement hors liste refusé par la validation", async () => {
    const res = await PATCH(requete("PATCH", { id: 909, modeReglement: "Troc" }))

    expect(res.status).toBe(400)
    const corps = await res.json()
    expect(Object.keys(corps.details.fieldErrors)).toEqual(["modeReglement"])
    expect(mocks.venteUpdate).not.toHaveBeenCalled()
  })
})


describe("pointage et source d’élevage", () => {
  it("défaire un pointage corrige aussi la vente d’origine", async () => {
    mocks.venteFindFirst.mockResolvedValue({ ...venteManuelle, auto: true, sourceType: "vente_produit", sourceId: 167 })
    expect((await PATCH(requete("PATCH", { id: 12, paye: false, modeReglement: "Chèque" }))).status).toBe(200)
    expect(mocks.sourceUpdateMany).toHaveBeenCalledWith({ where: { id: 167, userId: "u1", annule: false, factureId: null }, data: { paye: false } })
    expect(mocks.venteUpdate).toHaveBeenCalledWith({ where: { id: 12, userId: "u1" }, data: { paye: false, modeReglement: "Chèque" } })
  })
  it("refuse une source disparue, annulée, facturée ou hors du compte sans écrire le miroir", async () => {
    mocks.venteFindFirst.mockResolvedValue({ ...venteManuelle, auto: true, sourceType: "vente_produit", sourceId: 167 })
    mocks.sourceUpdateMany.mockResolvedValue({ count: 0 })
    expect((await PATCH(requete("PATCH", { id: 12, paye: true }))).status).toBe(409)
    expect(mocks.venteUpdate).not.toHaveBeenCalled()
  })
  it("renvoie le paiement d’une commande vers la boutique", async () => {
    mocks.venteFindFirst.mockResolvedValue({ ...venteManuelle, auto: true, sourceType: "commande_boutique", sourceId: 167 })
    expect((await PATCH(requete("PATCH", { id: 12, paye: true }))).status).toBe(409)
    expect(mocks.sourceUpdateMany).not.toHaveBeenCalled()
    expect(mocks.venteUpdate).not.toHaveBeenCalled()
  })
})
