import { beforeEach, describe, expect, it, vi } from "vitest"

const reglements = vi.hoisted(() => ({
  suiviReglementActif: vi.fn(),
  verifierSuppressionSourceReglee: vi.fn(),
}))
const verrou = vi.hoisted(() => ({ verrouillerStockCommercial: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ default: {} }))
vi.mock("@/lib/comptabilite/ensure-client", () => ({ ensureClientForUser: vi.fn(async () => 1) }))
vi.mock("@/lib/comptabilite/suivi-reglement-source", () => reglements)
vi.mock("@/lib/stocks/verrou-commercial", () => verrou)

import {
  annulerCommandeBoutique,
  confirmCommandeBoutique,
  ErreurCommandeBoutique,
  livrerCommandeBoutique,
} from "./commande-boutique"

type Champs = Record<string, unknown>

function transaction(commande: Champs) {
  const ordre: string[] = []
  const etat = {
    id: 12, userId: "ferme", numero: "CMD-2026-0001", clientNom: "Client", clientEmail: null,
    clientTelephone: null, total: 4.8, createdAt: new Date("2026-11-11T08:00:00Z"),
    statut: "confirmee", paiementStatut: "En attente", paiementProvider: null, paiementRef: null,
    venteManuelleId: null as number | null,
    lignes: [{ quantite: 1, total: 4.8, produit: { id: 3, nom: "Œufs", unite: "douzaine", stockDispo: 10, categorie: "oeufs", statutBio: null, recolteId: null } }],
    ...commande,
  }
  const tx = {
    $executeRawUnsafe: vi.fn(async () => { ordre.push("ligne") }),
    commandeBoutique: {
      findUnique: vi.fn(async () => etat),
      update: vi.fn(async ({ data }: { data: Champs }) => Object.assign(etat, data)),
    },
    produitBoutique: { update: vi.fn(async () => ({ stockDispo: 9 })) },
    recolte: { updateMany: vi.fn() },
    venteManuelle: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: Champs }) => ({ id: 77, ...data })),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }
  verrou.verrouillerStockCommercial.mockImplementation(async () => { ordre.push("compte") })
  return { tx: tx as never, brut: tx, ordre }
}

beforeEach(() => {
  vi.clearAllMocks()
  reglements.suiviReglementActif.mockResolvedValue(null)
  reglements.verifierSuppressionSourceReglee.mockResolvedValue(undefined)
})

describe("commande boutique : transitions refusées", () => {
  it("ne confirme pas le paiement d'une commande annulée, sans recette ni stock", async () => {
    const { tx, brut } = transaction({ statut: "annulee", paiementStatut: "Annulé" })
    await expect(confirmCommandeBoutique(12, {}, tx)).rejects.toMatchObject({ status: 409 })
    expect(brut.venteManuelle.create).not.toHaveBeenCalled()
    expect(brut.produitBoutique.update).not.toHaveBeenCalled()
  })

  it("ne livre pas une commande annulée", async () => {
    const { tx, brut } = transaction({ statut: "annulee" })
    await expect(livrerCommandeBoutique(12, tx)).rejects.toBeInstanceOf(ErreurCommandeBoutique)
    expect(brut.venteManuelle.create).not.toHaveBeenCalled()
  })

  it("ne pointe pas « payé » une recette qui porte des versements au journal", async () => {
    reglements.suiviReglementActif.mockResolvedValue({ dossierId: "d", regle: 200, actifs: 1 })
    const { tx, brut } = transaction({ statut: "livree", venteManuelleId: 77 })
    await expect(confirmCommandeBoutique(12, {}, tx)).rejects.toMatchObject({ status: 409 })
    expect(brut.venteManuelle.update).not.toHaveBeenCalled()
    expect(brut.commandeBoutique.update).not.toHaveBeenCalled()
  })

  it("n'annule pas une commande dont la recette a un règlement actif", async () => {
    reglements.verifierSuppressionSourceReglee.mockRejectedValue(new Error("Cette pièce a des règlements."))
    const { tx, brut } = transaction({ statut: "livree", venteManuelleId: 77 })
    await expect(annulerCommandeBoutique(12, "Annulé", tx)).rejects.toThrow("règlements")
    expect(brut.venteManuelle.delete).not.toHaveBeenCalled()
    expect(brut.produitBoutique.update).not.toHaveBeenCalled()
    expect(brut.commandeBoutique.update).not.toHaveBeenCalled()
  })

  it("n'annule pas deux fois : le stock n'est rendu qu'une fois", async () => {
    const { tx, brut } = transaction({ statut: "annulee", paiementStatut: "Annulé" })
    await annulerCommandeBoutique(12, "Annulé", tx)
    expect(brut.produitBoutique.update).not.toHaveBeenCalled()
    expect(brut.commandeBoutique.update).not.toHaveBeenCalled()
  })
})

describe("commande boutique : paiement confirmé", () => {
  it("ne suppose aucun mode de règlement quand il n'est pas déclaré", async () => {
    const { tx, brut } = transaction({})
    await confirmCommandeBoutique(12, { provider: "Manuel" }, tx)
    expect(brut.venteManuelle.create.mock.calls[0][0].data).toMatchObject({ paye: true, modeReglement: null })
  })

  it("conserve le mode déclaré", async () => {
    const { tx, brut } = transaction({})
    await confirmCommandeBoutique(12, { provider: "Manuel", modeReglement: "Chèque" }, tx)
    expect(brut.venteManuelle.create.mock.calls[0][0].data.modeReglement).toBe("Chèque")
  })

  it("prend les verrous du compte avant la ligne de la commande", async () => {
    const { tx, ordre } = transaction({})
    await confirmCommandeBoutique(12, {}, tx)
    expect(ordre).toEqual(["compte", "ligne"])
    expect(verrou.verrouillerStockCommercial).toHaveBeenCalledWith(tx, "ferme")
  })
})
