import { describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { TuileAgent } from "@/components/accueil/TuileAgent"
import { TuileAujourdhui } from "@/components/accueil/TuileAujourdhui"

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
  chargerAgendaElevage: vi.fn().mockResolvedValue({ echeances: [], counts: { total: 0, urgent: 0 } }),
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
  chargerAgendaElevage: mocks.chargerAgendaElevage,
}))
vi.mock("@/lib/elevage/declarations-reglementaires.server", () => ({
  chargerDeclarationsReglementaires: vi.fn().mockResolvedValue(null),
}))

import { composerAujourdhui } from "./composition.server"
// Type tiré de la fonction testée : pas d’import de `@/lib/auth-utils` (surcharge privée), le test reste publiable.
type SessionExploitation = Parameters<typeof composerAujourdhui>[0]

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
      // Items réels : la facture porte son instantané figé (devise), la vente d'atelier suit la devise courante.
      creances: {
        items: [{ id: 2, source: "Facture", montant: 200, emetteurSnapshot: { devise: "EUR" } }, { id: 7, source: "VenteProduit", montant: 60 }],
        total: 260,
      },
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
      expect.objectContaining({ id: 2, montant: 200, monnaie: "EUR" }),
    ])
    // Ventes d'atelier et ventes à crédit comprises, comme le Bilan.
    expect(accueil.optionnelles.tresorerie?.totalCreances).toBe(260)
  })

  it("signale une devise historique inconnue sans supposer celle de l’exploitation", async () => {
    mocks.factureFindMany.mockResolvedValue([
      { id: 2, numero: "F-2026-0002", clientNom: "Restaurant", dateEcheance: echue },
    ])
    mocks.chargerEncoursCompta.mockResolvedValue({
      creances: { items: [{ id: 2, source: "Facture", montant: 200 }], total: 200 },
      dettes: { total: 0, nombre: 0 },
    })
    const session = {
      user: { id: "u1", acteurId: "u1", modulesExploitation: ["comptabilite"] },
    } as unknown as SessionExploitation

    const accueil = await composerAujourdhui(session, { maintenant, tuiles: ["tresorerie"] })
    const creance = accueil.elements.find((e) => e.id === "creance:2")
    expect(creance?.meta).toContain("montant indisponible : devise historique inconnue")
    expect(accueil.optionnelles.tresorerie?.creances).toEqual([
      expect.objectContaining({ id: 2, montant: 200, monnaie: null }),
    ])
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

  it("Gleba et l'encart comptent l'attente œufs et le rappel échu, puis reviennent au calme", async () => {
    const session = {
      user: { id: "u1", acteurId: "u1", modulesExploitation: ["elevage"] },
    } as unknown as SessionExploitation
    const echeances = [
      { id: "attente-oeufs:1", kind: "attente_oeufs", joursRestants: 5, gravite: "urgent", titre: "Œufs non commercialisables — Pondeuses", detail: "Fin du délai dans 5 j" },
      { id: "rappel:1", kind: "soin_retard", joursRestants: -2, gravite: "urgent", titre: "Rappel sanitaire — Pondeuses", detail: "En retard de 2 j" },
    ]
    // Le compteur d'agenda couvre exactement les mêmes urgences.
    mocks.chargerAgendaElevage.mockResolvedValue({ echeances, counts: { total: 2, urgent: 2 } })
    const accueil = await composerAujourdhui(session, { maintenant })
    expect(accueil.elements.find((e) => e.id === "elevage:attente-oeufs:1")).toMatchObject({ etat: "info", urgent: true })
    expect(accueil.elevage?.counts.urgent).toBe(2)
    const rendre = (elements: typeof accueil.elements) => [
      renderToStaticMarkup(createElement(TuileAgent, { elements, alerteMeteo: null, chargement: false })),
      renderToStaticMarkup(createElement(TuileAujourdhui, { elements, sourcesEnErreur: [], erreur: null, chargement: false })),
    ]
    for (const html of rendre(accueil.elements)) {
      expect(html).toContain("2 urgences")
      expect(html).not.toContain("Rien d&#x27;urgent")
    }
    // Le délai seul reste une urgence même sans ligne visuellement critique.
    const attenteSeule = accueil.elements.filter((e) => e.etat === "info")
    for (const html of rendre(attenteSeule)) expect(html).toContain("1 urgence")
    mocks.chargerAgendaElevage.mockResolvedValue({ echeances: [], counts: { total: 0, urgent: 0 } })
    const calme = await composerAujourdhui(session, { maintenant: new Date(2026, 10, 10, 9) })
    for (const html of rendre(calme.elements)) expect(html).toContain("Rien d&#x27;urgent")
  })
})
