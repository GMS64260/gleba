// @vitest-environment jsdom

import { Fragment, createElement } from "react"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ArbresTab } from "./ArbresTab"
import { Toaster } from "@/components/ui/toaster"

const navigation = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => navigation, usePathname: () => "/verger" }))
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null, status: "unauthenticated" }) }))
vi.mock("@/components/gps/GpsMapPickerDialog", () => ({ GpsMapPickerDialog: () => null }))
vi.mock("@/components/verger/ReleveGpsDialog", () => ({ ReleveGpsDialog: () => null }))

const arbre = {
  id: 71, nom: "Pommier témoin", type: "fruitier", espece: "Pommier", variete: "Variété témoin",
  datePlantation: "2024-11-01", productif: true, etat: "bon", prixAchat: 24, dateAchat: "2024-10-15",
}
const fetchMock = vi.fn<typeof fetch>()
const mutation = vi.fn<() => Promise<Response>>()
const ecritures = () => fetchMock.mock.calls.filter(([, options]) => options?.method === "POST")

beforeEach(() => {
  vi.clearAllMocks()
  mutation.mockReset().mockResolvedValue(Response.json({ arbres: [{ nom: "Copie témoin" }], calendriers: 1 }))
  fetchMock.mockReset().mockImplementation(async (url, options) => {
    if (options?.method === "POST") return mutation()
    if (String(url).startsWith("/api/arbres?")) return Response.json([arbre])
    if (String(url).startsWith("/api/arbres/lots")) return Response.json([])
    if (String(url) === "/api/carte") return Response.json([])
    return Response.json({ data: [] })
  })
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

async function afficher() {
  render(createElement(Fragment, null, createElement(ArbresTab), createElement(Toaster)))
  return (await screen.findByText(arbre.nom)).closest("tr")!
}
async function actionsMobiles() {
  const ligne = await afficher()
  const bouton = within(ligne).getByRole("button", { name: `Actions pour ${arbre.nom}` })
  // Les actions sont dans la cellule Nom, hors des colonnes hidden md:table-cell.
  expect(bouton.closest("td")?.className).not.toContain("hidden")
  expect(bouton.closest("td")?.textContent).toContain(arbre.nom)
  fireEvent.click(bouton)
  expect(navigation.push).not.toHaveBeenCalled()
  return screen.getByRole("dialog")
}
async function ouvrirDuplication(panneau: HTMLElement) {
  // Le vrai menu Radix s'ouvre au clavier, sans simuler sa logique.
  fireEvent.keyDown(within(panneau).getByRole("button", { name: `Dupliquer ${arbre.nom}` }), { key: "ArrowDown" })
  return screen.findByRole("menu")
}
async function demanderRecalcul() {
  const panneau = await actionsMobiles()
  fireEvent.click(within(panneau).getByRole("button", { name: `Recalculer le calendrier d'entretien de ${arbre.nom}` }))
  return screen.getByRole("dialog", { name: "Recalculer le calendrier d'entretien ?" })
}

describe("ArbresTab : actions communes au téléphone et à l’ordinateur", () => {
  it.each([false, true])("transmet une seule duplication avec nombre et recopierAchat=%s", async (recopierAchat) => {
    const menu = await ouvrirDuplication(await actionsMobiles())
    if (recopierAchat) fireEvent.click(within(menu).getByRole("menuitemcheckbox"))
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Dupliquer ×3" }))
    await screen.findByText("Arbre dupliqué")
    expect(ecritures()).toEqual([["/api/arbres/71/dupliquer", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: 3, recopierAchat }),
    }]])
    expect(navigation.push).not.toHaveBeenCalled()
  })

  it("fermer la duplication n’écrit rien et remet la recopie d’achat à zéro", async () => {
    const panneau = await actionsMobiles()
    const menu = await ouvrirDuplication(panneau)
    fireEvent.click(within(menu).getByRole("menuitemcheckbox"))
    fireEvent.keyDown(menu, { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull())
    const nouveauMenu = await ouvrirDuplication(panneau)
    expect(within(nouveauMenu).getByRole("menuitemcheckbox").getAttribute("aria-checked")).toBe("false")
    fireEvent.keyDown(nouveauMenu, { key: "Escape" })
    expect(ecritures()).toHaveLength(0)
  })

  it("Annuler le recalcul ne provoque aucune mutation", async () => {
    const confirmation = await demanderRecalcul()
    expect(confirmation.textContent).toContain("réalisées ou abandonnées seront conservées")
    expect(ecritures()).toHaveLength(0)
    fireEvent.click(within(confirmation).getByRole("button", { name: "Annuler" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(ecritures()).toHaveLength(0)
    expect(navigation.push).not.toHaveBeenCalled()
  })

  it("confirme le recalcul puis n’envoie qu’une requête malgré deux clics rapprochés", async () => {
    let terminer!: (response: Response) => void
    mutation.mockImplementationOnce(() => new Promise((resolve) => { terminer = resolve }))
    const confirmation = await demanderRecalcul()
    expect(ecritures()).toHaveLength(0)
    const bouton = within(confirmation).getByRole("button", { name: "Recalculer" })
    act(() => { fireEvent.click(bouton); fireEvent.click(bouton) })
    expect(ecritures()).toEqual([["/api/arbres/71/generer-calendrier", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    }]])
    await act(async () => terminer(Response.json({ espece: "Pommier", year: 2026, count: 4 })))
    await screen.findByText("Calendrier recalculé pour Pommier (2026)")
    expect(screen.getByText("4 opérations créées.")).toBeTruthy()
    expect(ecritures()).toHaveLength(1)
  })

  it.each(["duplication", "recalcul"])("affiche le refus serveur de %s", async (action) => {
    const refus = action === "duplication" ? "Duplication refusée pour cet arbre." : "Aucun calendrier d'entretien connu pour cette espèce."
    mutation.mockResolvedValueOnce(Response.json({ error: refus }, { status: 409 }))
    if (action === "duplication") {
      const menu = await ouvrirDuplication(await actionsMobiles())
      fireEvent.click(within(menu).getByRole("menuitem", { name: "Dupliquer" }))
    } else {
      const confirmation = await demanderRecalcul()
      fireEvent.click(within(confirmation).getByRole("button", { name: "Recalculer" }))
    }
    expect(await screen.findByText(refus)).toBeTruthy()
    expect(ecritures()).toHaveLength(1)
  })

  it("l’action ordinateur demande la même confirmation", async () => {
    const ligne = await afficher()
    fireEvent.click(within(ligne).getByRole("button", { name: `Recalculer le calendrier d'entretien de ${arbre.nom}` }))
    expect(screen.getByRole("dialog", { name: "Recalculer le calendrier d'entretien ?" })).toBeTruthy()
    expect(ecritures()).toHaveLength(0)
  })
})
