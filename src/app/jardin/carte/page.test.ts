// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }))
// La carte Leaflet et ses outils ne se montent pas sous jsdom.
vi.mock("next/dynamic", () => ({ default: () => () => null }))
// `toast` doit garder son identité : le chargement des parcelles en dépend.
const toast = vi.hoisted(() => vi.fn())
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }))

import CartePage from "./page"

const parcelle = {
  id: "parcelle-fictive",
  nom: "Parcelle témoin",
  geometry: JSON.stringify({ type: "Polygon", coordinates: [[[2.44, 44.93], [2.45, 44.93], [2.45, 44.94], [2.44, 44.93]]] }),
  surface: 1200,
  couches: [],
}

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo | URL) => {
    if (String(url) === "/api/carte") return Response.json([parcelle])
    return new Response(null, { status: 404 })
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("carte des parcelles sur téléphone", () => {
  it("masque la fiche pendant l'édition du tracé pour laisser les sommets recevoir le geste", async () => {
    render(createElement(CartePage))
    fireEvent.click(await screen.findByText("Parcelle témoin"))

    const fiche = () => screen.getByText("Modifier la parcelle").closest("div.absolute")
    expect(fiche()?.className).not.toContain("max-md:hidden")

    fireEvent.click(screen.getByRole("button", { name: /Modifier le tracé/ }))
    // La fiche reste montée (saisie gardée), seulement masquée sous 768 px.
    expect(fiche()?.className).toContain("max-md:hidden")
    expect(screen.getByRole("button", { name: /Valider/ })).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: /Annuler/ }))
    expect(fiche()?.className).not.toContain("max-md:hidden")
  })

  it("la masque aussi pendant le déplacement de la parcelle", async () => {
    render(createElement(CartePage))
    fireEvent.click(await screen.findByText("Parcelle témoin"))
    fireEvent.click(screen.getByRole("button", { name: /Déplacer/ }))
    expect(screen.getByText("Modifier la parcelle").closest("div.absolute")?.className).toContain("max-md:hidden")
  })
})
