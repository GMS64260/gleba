// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createElement, type FunctionComponent } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { EconomieLaitSubTab } from "./EconomieLaitSubTab"

// Le composant déclare ses props avec une valeur par défaut : createElement veut un type de composant explicite.
const Onglet = EconomieLaitSubTab as FunctionComponent<{ year?: number }>

const reponse = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } })
const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe("Économie lait & fromage : refus du serveur", () => {
  it("affiche le motif d’un refus 422 au lieu de planter, puis permet de réessayer", async () => {
    fetchMock.mockResolvedValue(reponse({ error: "La facture F-12 ne se ventile pas entre les lots de fromage." }, 422))
    render(createElement(Onglet, { year: 2026 }))
    expect((await screen.findByRole("alert")).textContent).toContain("F-12 ne se ventile pas")
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    await screen.findByRole("alert")
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/elevage/economie-lait?annee=2026")
  })
  it("affiche un message générique pour une erreur sans corps lisible ou une panne réseau", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>502</html>", { status: 502 }))
    const vue = render(createElement(Onglet, { year: 2026 }))
    expect((await screen.findByRole("alert")).textContent).toContain("n’a pas pu être chargé")
    vue.unmount()
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    render(createElement(Onglet, { year: 2026 }))
    expect((await screen.findByRole("alert")).textContent).toContain("Vérifiez votre connexion")
    expect(screen.queryByText(/Failed to fetch/)).toBeNull()
  })
})
