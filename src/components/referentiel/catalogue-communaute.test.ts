import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { OrigineControls, filtrerParOrigine } from "./catalogue-communaute"

vi.mock("@/hooks/use-exploitation", () => ({ useExploitation: () => ({ contexte: { tenantId: "ferme-fictive" } }) }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))

const proprietaireId = "ferme-fictive"
const acteurId = "membre-fictif"
const actions = { togglePartage: vi.fn(), remove: vi.fn() }
const entrees = [
  { id: "officiel", userId: null, partageCommunaute: false },
  { id: "prive-ferme", userId: proprietaireId, partageCommunaute: false },
  { id: "partage-ferme", userId: proprietaireId, partageCommunaute: true },
  { id: "tiers", userId: "communaute", partageCommunaute: true },
]

function rendre(entree: typeof entrees[number], tenant: string | null = proprietaireId) {
  return renderToStaticMarkup(React.createElement(OrigineControls, {
    entree, nom: entree.id, currentUserId: acteurId, proprietaireId: tenant, actions,
    signalerRefType: "ITP",
  }))
}

describe("origine du catalogue pour un membre de l’exploitation", () => {
  it.each(entrees.slice(1, 3))("marque $id Perso, y compris quand l’ITP est partagé", (entree) => {
    const html = rendre(entree)
    expect(html).toContain(">Perso<")
    expect(html).not.toContain(">Communauté<")
    expect(html).not.toContain("Signaler à la modération")
  })

  it("résout le propriétaire pour un ancien appelant sans prop de contexte", () => {
    const html = renderToStaticMarkup(React.createElement(OrigineControls, {
      entree: entrees[1], nom: "ITP privé", currentUserId: acteurId, actions,
    }))
    expect(html).toContain(">Perso<")
    expect(html).not.toContain(">Communauté<")
  })

  it("conserve Communauté et le signalement pour la contribution d’une autre exploitation", () => {
    const html = rendre(entrees[3])
    expect(html).toContain(">Communauté<")
    expect(html).toContain("Signaler à la modération")
  })

  it("conserve Gleba pour le catalogue officiel", () => {
    expect(rendre(entrees[0])).toContain(">Gleba<")
  })

  it("n’invente pas une origine communautaire si le contexte est indisponible", () => {
    expect(rendre(entrees[1], null)).not.toContain(">Communauté<")
  })

  it("filtre avec le propriétaire : ses références partagées restent personnelles", () => {
    expect(filtrerParOrigine(entrees, "perso", proprietaireId).map((e) => e.id)).toEqual(["prive-ferme", "partage-ferme"])
    expect(filtrerParOrigine(entrees, "communaute", proprietaireId).map((e) => e.id)).toEqual(["tiers"])
    expect(filtrerParOrigine(entrees, "gleba", proprietaireId).map((e) => e.id)).toEqual(["officiel"])
    expect(filtrerParOrigine(entrees, "tout", proprietaireId)).toBe(entrees)
  })
})
