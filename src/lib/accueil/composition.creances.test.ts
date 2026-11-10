import { describe, expect, it, vi } from "vitest"

/**
 * Revue du 2026-11-04 — l'accueil relisait le `totalTTC` des factures émises :
 * une facture soldée par un avoir restait « à relancer » pour toujours, et une
 * facture réglée en partie s'affichait pour son montant entier. Les créances
 * viennent désormais de `chargerEncoursCompta`, comme le Bilan.
 */

const mocks = vi.hoisted(() => ({
  factureFindMany: vi.fn(),
  chargerEncoursCompta: vi.fn(),
  chargerCheptelEnStock: vi.fn(),
}))

// Toute autre lecture rend « rien » ; seules les factures comptent ici.
vi.mock("@/lib/prisma", () => {
  const vide = new Proxy(
    {},
    { get: (_c, methode) => async () => (methode === "findMany" ? [] : methode === "count" ? 0 : null) },
  )
  return {
    default: new Proxy({}, { get: (_c, modele) => (modele === "facture" ? { findMany: mocks.factureFindMany } : vide) }),
  }
})
vi.mock("@/lib/comptabilite/encours", () => ({ chargerEncoursCompta: mocks.chargerEncoursCompta }))
vi.mock("@/lib/elevage/stock-cheptel", () => ({ chargerCheptelEnStock: mocks.chargerCheptelEnStock }))
vi.mock("@/lib/taches-potager", () => ({ getTachesPotager: vi.fn().mockResolvedValue(null) }))
vi.mock("@/lib/kpi", () => ({ getKpiMaraichage: vi.fn().mockResolvedValue(null), getKpiCompta: vi.fn().mockResolvedValue(null) }))
vi.mock("@/lib/elevage/agenda.server", () => ({
  chargerAgendaElevage: vi.fn().mockResolvedValue({ echeances: [], counts: { total: 0, urgent: 0 } }),
}))
vi.mock("@/lib/elevage/declarations-reglementaires.server", () => ({
  chargerDeclarationsReglementaires: vi.fn().mockResolvedValue(null),
}))

import { composerAujourdhui } from "./composition.server"
import type { SessionExploitation } from "@/lib/auth-utils"

const maintenant = new Date(2026, 10, 4, 9, 0)
const echue = new Date(2026, 8, 1)

describe("composerAujourdhui — créances et cheptel", () => {
  it("ne relance pas une facture soldée par un avoir, et relance le reste dû d'une facture réglée en partie", async () => {
    mocks.factureFindMany.mockImplementation(async (args: { where: { id?: unknown } }) =>
      args.where.id
        ? [{ id: 2, numero: "F-2026-0002", clientNom: "Restaurant", dateEcheance: echue }]
        : [
            { id: 1, numero: "F-2026-0001", statut: "emise", clientNom: "Épicerie", totalTTC: 500, dateEcheance: echue, date: echue },
            { id: 2, numero: "F-2026-0002", statut: "emise", clientNom: "Restaurant", totalTTC: 500, dateEcheance: echue, date: echue },
          ],
    )
    // F1 : soldée par un avoir (absente des créances) ; F2 : 300 € reçus sur 500 €.
    mocks.chargerEncoursCompta.mockResolvedValue({
      creances: { items: [{ id: 2, source: "Facture", montant: 200 }], total: 260 },
      dettes: { total: 0, nombre: 0 },
    })
    const session = {
      user: { id: "u1", acteurId: "u1", modulesExploitation: ["comptabilite"] },
    } as unknown as SessionExploitation

    const accueil = await composerAujourdhui(session, { maintenant, tuiles: ["tresorerie"] })

    const creances = accueil.elements.filter((e) => e.source === "creance")
    expect(creances.map((e) => e.id)).toEqual(["creance:2"])
    expect(creances[0].meta.join(" ")).toMatch(/200,00/)
    expect(accueil.optionnelles.tresorerie?.creances).toEqual([
      expect.objectContaining({ id: 2, montant: 200 }),
    ])
    // Ventes d'atelier et ventes à crédit comprises, comme le Bilan.
    expect(accueil.optionnelles.tresorerie?.totalCreances).toBe(260)
  })

  it("compte les têtes des lots dans le cheptel, pas seulement les fiches individuelles", async () => {
    mocks.chargerCheptelEnStock.mockResolvedValue({
      individuels: [{ especeAnimaleId: "chevre", tetes: 2 }],
      lots: [{ id: 1, especeAnimaleId: "poule", nom: "Pondeuses", tetes: 200 }],
    })
    const session = {
      user: { id: "u1", acteurId: "u1", modulesExploitation: ["elevage"] },
    } as unknown as SessionExploitation

    const accueil = await composerAujourdhui(session, { maintenant })
    expect(accueil.elevage?.animauxActifs).toBe(202)
  })
})
