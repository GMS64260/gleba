import { describe, expect, it, vi } from "vitest"

/**
 * Accueil du 2026-10-25 (compte réel) : « Planter Aubergine S1P2 —
 * aujourd'hui » pour une plantation hors de la fenêtre S16–S18 de son ITP. La
 * ligne le dit désormais (« hors saison ITP »), sans toucher au retard ;
 * l'ail en retard de 286 jours, dans sa fenêtre, ne porte rien de plus.
 */

const mocks = vi.hoisted(() => ({ getTachesPotager: vi.fn() }))

// Toute lecture directe en base rend « rien » : seules les tâches comptent ici.
vi.mock("@/lib/prisma", () => {
  const modele = new Proxy(
    {},
    { get: (_c, methode) => async () => (methode === "findMany" ? [] : methode === "count" ? 0 : null) },
  )
  return { default: new Proxy({}, { get: () => modele }) }
})
vi.mock("@/lib/taches-potager", () => ({ getTachesPotager: mocks.getTachesPotager }))
vi.mock("@/lib/kpi", () => ({ getKpiMaraichage: vi.fn().mockResolvedValue(null), getKpiCompta: vi.fn().mockResolvedValue(null) }))
vi.mock("@/lib/elevage/agenda.server", () => ({ chargerAgendaElevage: vi.fn().mockResolvedValue(null) }))
vi.mock("@/lib/elevage/declarations-reglementaires.server", () => ({
  chargerDeclarationsReglementaires: vi.fn().mockResolvedValue(null),
}))

import { composerAujourdhui } from "./composition.server"
import type { SessionExploitation } from "@/lib/auth-utils"

const plantation = (id: number, especeNom: string, plancheId: string, date: string, retardJours: number, horsSaison: string | null) => ({
  id,
  type: "plantation" as const,
  especeId: especeNom,
  especeNom,
  varieteId: null,
  varieteNom: null,
  plancheId,
  plancheRefId: `planche-${plancheId}`,
  date,
  fait: false,
  couleur: null,
  retardJours,
  horsSaison,
})

describe("composerAujourdhui — plantation hors saison de l'ITP", () => {
  it("ajoute « hors saison ITP » à la ligne de l'aubergine, rien à celle de l'ail", async () => {
    const maintenant = new Date(2026, 9, 25, 15, 0)
    mocks.getTachesPotager.mockResolvedValue({
      semis: [],
      plantations: [
        plantation(2001, "Ail", "S1P1", new Date(2026, 0, 12).toISOString(), 286, null),
        plantation(
          2002,
          "Aubergine",
          "S1P2",
          new Date(2026, 9, 25).toISOString(),
          0,
          "Hors fenêtre de l'itinéraire (plantation S16–S18) : plantation prévue S43.",
        ),
      ],
      recoltes: [],
      irrigation: [],
      irrigationHorsTournee: [],
      stats: {},
    })
    const session = {
      user: { id: "u1", acteurId: "u1", modulesExploitation: ["maraichage"] },
    } as unknown as SessionExploitation

    const accueil = await composerAujourdhui(session, { maintenant })
    const aubergine = accueil.elements.find((e) => e.id === "plantation:2002")
    const ail = accueil.elements.find((e) => e.id === "plantation:2001")
    expect(aubergine?.titre).toBe("Planter Aubergine S1P2")
    expect(aubergine?.meta).toEqual(["aujourd'hui", "hors saison ITP"])
    expect(ail?.meta).toEqual(["en retard de 286 j"])
  })
})
