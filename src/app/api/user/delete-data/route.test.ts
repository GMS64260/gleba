/**
 * DELETE /api/user/delete-data — le compte de démonstration ne se vide pas.
 *
 * Défaut corrigé (2026-10-19) : `estEmailDemo()` gardait les préférences et
 * l'authentification, pas cette route. Avec les identifiants publics du bouton
 * « Essayer la démo », n'importe quel visiteur pouvait vider la ferme de
 * démonstration pour tous les suivants.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  userFindUnique: vi.fn(),
  transaction: vi.fn(),
  stockCommercialCount: vi.fn(),
  executeRaw: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    mouvementStockCommercial: { count: mocks.stockCommercialCount },
    user: { findUnique: mocks.userFindUnique },
    $transaction: mocks.transaction,
    $executeRaw: mocks.executeRaw,
  },
}))

import { DELETE } from "./route"
import { LOT_SUPPRESSION_MESURES } from "@/lib/capteurs/agregats"

// L'écran Paramètres envoie un DELETE sans corps.
const compteur = () => ({ deleteMany: vi.fn().mockResolvedValue({ count: 2 }) })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.stockCommercialCount.mockResolvedValue(0)
  mocks.requireAuthApi.mockResolvedValue({
    error: null,
    session: { user: { id: "u1", role: "USER", estProprietaireExploitation: true } },
  })
  mocks.transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback(transactionComplete()))
  mocks.executeRaw.mockResolvedValue(0)
})

function transactionComplete() {
  return {
    irrigationPlanifiee: compteur(),
    recolte: compteur(),
    culture: compteur(),
    fertilisation: compteur(),
    analyseSol: compteur(),
    planche: compteur(),
    objetJardin: compteur(),
    arbre: compteur(),
    note: compteur(),
    connecteurCapteurs: compteur(),
    mouvementStockCommercial: compteur(),
    lotTransforme: compteur(),
  }
}

describe("DELETE /api/user/delete-data — compte de démonstration", () => {
  it("refuse en 403 avec un message qui explique, et ne supprime RIEN", async () => {
    mocks.userFindUnique.mockResolvedValue({ email: "demo@gleba.fr" })

    const res = await DELETE()

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.code).toBe("COMPTE_DEMO")
    expect(json.error).toContain("compte de démonstration")
    expect(json.error).toContain("ne peuvent pas être vidées")
    expect(mocks.transaction).not.toHaveBeenCalled()
    // L'identité est lue en base par l'id de l'exploitation, pas dans la session.
    expect(mocks.userFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1" } })
    )
  })

  it("refuse quelle que soit la casse de l'adresse", async () => {
    mocks.userFindUnique.mockResolvedValue({ email: " Demo@Gleba.FR " })

    const res = await DELETE()

    expect(res.status).toBe(403)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})

describe("DELETE /api/user/delete-data — compte réel", () => {
  it("vide les données comme avant", async () => {
    mocks.userFindUnique.mockResolvedValue({ email: "maraicher@example.com" })

    const res = await DELETE()

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.message).toBe("22 enregistrements supprimés")
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
  })

  it("supprime les connecteurs de capteurs : capteurs, positions et mesures partent en cascade, le jeton ne sert plus", async () => {
    mocks.userFindUnique.mockResolvedValue({ email: "maraicher@example.com" })
    const tx = transactionComplete()
    mocks.transaction.mockImplementationOnce((callback: (t: unknown) => unknown) => callback(tx))

    await DELETE()

    expect(tx.connecteurCapteurs.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } })
  })

  it("supprime d'abord le brut des capteurs par lots, hors de la transaction principale", async () => {
    mocks.userFindUnique.mockResolvedValue({ email: "maraicher@example.com" })
    mocks.executeRaw.mockResolvedValueOnce(LOT_SUPPRESSION_MESURES).mockResolvedValueOnce(7)

    const res = await DELETE()

    expect(res.status).toBe(200)
    expect(mocks.executeRaw).toHaveBeenCalledTimes(2)
    expect(mocks.executeRaw.mock.calls[0][0].join("?")).toMatch(/DELETE FROM "mesures_capteurs"[\s\S]*LIMIT/)
    expect(mocks.executeRaw.mock.calls[0]).toContain("u1")
    expect(mocks.executeRaw.mock.invocationCallOrder.at(-1)).toBeLessThan(mocks.transaction.mock.invocationCallOrder[0])
    const json = await res.json()
    expect(json.details.mesuresCapteurs).toBe(LOT_SUPPRESSION_MESURES + 7)
    expect(json.message).toBe(`${22 + LOT_SUPPRESSION_MESURES + 7} enregistrements supprimés`)
  })

  it("garde le refus des invités avant toute lecture", async () => {
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "u1", role: "USER", estProprietaireExploitation: false } },
    })

    const res = await DELETE()

    expect(res.status).toBe(403)
    expect(mocks.userFindUnique).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})

it("conserve les lots liés à des documents commerciaux au lieu de déclencher une erreur de clé étrangère", async () => {
  mocks.userFindUnique.mockResolvedValue({ email: "ferme@example.test" })
  mocks.stockCommercialCount.mockResolvedValue(1)
  const res = await DELETE()
  expect(res.status).toBe(409)
  expect((await res.json()).error).toContain("bons ou factures")
  expect(mocks.transaction).not.toHaveBeenCalled()
  // Rien n'est supprimé, pas même le brut des capteurs.
  expect(mocks.executeRaw).not.toHaveBeenCalled()
})

it("une perte du verger ne bloque pas l'effacement : seules les livraisons comptent, les sorties physiques partent avec leurs lots", async () => {
  mocks.userFindUnique.mockResolvedValue({ email: "ferme@example.test" })
  const tx = transactionComplete()
  mocks.transaction.mockImplementation((callback: (t: unknown) => unknown) => callback(tx))
  const res = await DELETE()
  expect(res.status).toBe(200)
  expect(mocks.stockCommercialCount).toHaveBeenCalledWith({ where: { userId: "u1", nature: "livraison" } })
  expect(tx.mouvementStockCommercial.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1", nature: { not: "livraison" } } })
  // Avant les arbres, dont les lots portent ces sorties sans cascade.
  expect(tx.mouvementStockCommercial.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(tx.arbre.deleteMany.mock.invocationCallOrder[0])
  // Les produits transformés jamais livrés partent après les fruits qui les tracent.
  expect(tx.lotTransforme.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } })
  expect(tx.mouvementStockCommercial.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(tx.lotTransforme.deleteMany.mock.invocationCallOrder[0])
})
