// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("sub=lactation"), usePathname: () => "/elevage",
}))
vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: "authenticated", data: { user: { id: "acteur-fictif" } } }),
}))

import { LaitSubTab } from "./LaitSubTab"

const fetchMock = vi.fn<typeof fetch>()
const reponse = (origineLactation: string) => ({
  origineLactation, dimEstime: origineLactation === "premiere_collecte",
  dim: origineLactation === "inconnue" ? null : 300,
  courbe: origineLactation === "inconnue" ? [] : [{ dim: 0, date: "2026-01-22", volume: 2, moyenne7j: 2 }],
  moyenne7j: 0.3, joursMesures: 3, lactationLongue: false,
  // Une réponse incohérente ne doit pas afficher une suggestion sans origine certaine.
  suggererTarissement: true,
})
function preparer(origines: string[]) {
  fetchMock.mockImplementation(async (url) => {
    if (url === "/api/elevage/animaux?statut=actif") return Response.json({ data: origines.map((_, i) => ({
      id: i + 1, nom: `Laitière fictive ${i + 1}`, sexe: "femelle", especeAnimale: { nom: "Bovin", production: "lait" },
    })) })
    const id = Number(new URL(String(url), "http://localhost").searchParams.get("animalId"))
    return Response.json(reponse(origines[id - 1]))
  })
}

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe("Lactation : l’écran indique la provenance de l’âge", () => {
  it("nomme DIM l’âge depuis une mise-bas connue et conserve la suggestion", async () => {
    preparer(["mise_bas"])
    render(createElement(LaitSubTab))
    expect(await screen.findByText("DIM : 300 j")).toBeTruthy()
    expect(screen.getByText(/jours depuis la dernière mise-bas/)).toBeTruthy()
    expect(screen.getByText(/Tarissement à envisager/)).toBeTruthy()
  })

  it("nomme l’origine estimée et masque toute suggestion sans mise-bas", async () => {
    preparer(["premiere_collecte"])
    render(createElement(LaitSubTab))
    expect(await screen.findByText(/300 j depuis la première collecte disponible/)).toBeTruthy()
    expect(screen.getByText(/Courbe estimée/)).toBeTruthy()
    expect(screen.queryByText(/dernière mise-bas/)).toBeNull()
    expect(screen.queryByText(/DIM/)).toBeNull()
    expect(screen.queryByText(/Tarissement à envisager/)).toBeNull()
    expect(document.querySelectorAll("polyline")).toHaveLength(2)
  })

  it("sans origine : aucun âge calculé ni suggestion et un état vide explicite", async () => {
    preparer(["inconnue"])
    render(createElement(LaitSubTab))
    expect(await screen.findByText("Âge de lactation inconnu")).toBeTruthy()
    expect(screen.getByText(/Pas encore de données de collecte/)).toBeTruthy()
    expect(screen.queryByText(/dernière mise-bas|DIM|Tarissement à envisager/)).toBeNull()
  })

  it("change les libellés avec l’animal et les retrouve après remontage sans aucune écriture", async () => {
    preparer(["mise_bas", "premiere_collecte", "inconnue"])
    const vue = render(createElement(LaitSubTab))
    await screen.findByText("DIM : 300 j")
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "2" } })
    await screen.findByText(/300 j depuis la première collecte disponible/)
    expect(screen.queryByText(/dernière mise-bas|DIM|Tarissement à envisager/)).toBeNull()
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "3" } })
    await screen.findByText("Âge de lactation inconnu")
    vue.unmount()
    preparer(["premiere_collecte"])
    render(createElement(LaitSubTab))
    await screen.findByText(/300 j depuis la première collecte disponible/)
    expect(fetchMock.mock.calls.every(([, options]) => !options?.method || options.method === "GET")).toBe(true)
  })
})
