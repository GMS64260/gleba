// @vitest-environment jsdom

import { createElement, Fragment } from "react"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import CulturesPage from "./page"
import { Toaster } from "@/components/ui/toaster"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/maraichage/cultures",
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null, status: "unauthenticated" }) }))
vi.mock("@/components/assistant", () => ({ AssistantDialog: () => null, AssistantButton: () => null }))
vi.mock("@/components/shell/AppHeader", () => ({ AppHeader: () => null, PageToolbar: () => null }))

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe("Page Cultures : dates des actions confirmées", () => {
  it("reprend les dates serveur, garde les relations et bloque les doubles confirmations", async () => {
    let culture = {
      id: 63, especeId: "laitue-test", varieteId: "batavia-test", plancheId: "planche-test",
      annee: 2027, dateSemis: "2027-10-01T00:00:00.000Z", datePlantation: "2027-10-15T00:00:00.000Z",
      dateRecolte: "2027-11-12T00:00:00.000Z", finRecolte: "2027-11-30T00:00:00.000Z",
      semisFait: false, plantationFaite: false, recolteFaite: false, terminee: null, notes: null,
    }
    const patch = vi.fn<() => Promise<Response>>()
    const fetchMock = vi.fn((url: string, options?: RequestInit) => {
      if (url === "/api/cultures/63" && options?.method === "PATCH") return patch()
      if (url === "/api/cultures?page=1&pageSize=50") return Promise.resolve(Response.json({
        data: [{ ...culture, etat: "Planifiée", type: "legume", quantite: 100,
          espece: { id: "laitue-test", nom: "Laitue témoin", famille: null },
          variete: { id: "batavia-test", nom: "Batavia témoin" },
          planche: { id: "planche-test", nom: "Planche témoin" }, _count: { recoltes: 2 },
        }], totalPages: 1,
      }))
      throw new Error(`Requête inattendue : ${url}`)
    })
    vi.stubGlobal("fetch", fetchMock)
    render(createElement(Fragment, null, createElement(CulturesPage), createElement(Toaster)))
    const ligne = (await screen.findByText("Laitue témoin")).closest("tr")!
    const cellule = (titre: string) => {
      const index = screen.getAllByRole("columnheader", { hidden: true }).findIndex(h => h.textContent === titre)
      return within(ligne).getAllByRole("cell", { hidden: true })[index].textContent
    }
    const actions = [
      { nom: "le semis fait", champ: "semisFait", date: "dateSemis", colonne: "Semis", etat: "Semée" },
      { nom: "la plantation faite", champ: "plantationFaite", date: "datePlantation", colonne: "Plantation", etat: "Plantée" },
      { nom: "la récolte faite", champ: "recolteFaite", date: "dateRecolte", colonne: "Récolte", etat: "En récolte" },
    ] as const

    for (const action of actions) {
      const avant = cellule(action.colonne)
      let resoudre!: (r: Response) => void
      patch.mockReturnValueOnce(new Promise<Response>(resolve => { resoudre = resolve }))
      fireEvent.click(within(ligne).getByRole("button", { name: `Marquer ${action.nom} — confirmation requise` }))
      const dialogue = await screen.findByRole("dialog", { name: "Confirmer le changement" })
      const confirmer = within(dialogue).getByRole("button", { name: "Confirmer" })
      const nombreAvant = patch.mock.calls.length
      act(() => { fireEvent.click(confirmer); fireEvent.click(confirmer) })
      expect(patch).toHaveBeenCalledTimes(nombreAvant + 1)
      expect(cellule(action.colonne)).toBe(avant)
      for (const bouton of within(ligne).getAllByRole("button", { hidden: true }).filter(b => b.getAttribute("aria-label")?.includes("confirmation requise"))) {
        expect((bouton as HTMLButtonElement).disabled).toBe(true)
      }
      culture = { ...culture, [action.champ]: true, [action.date]: "2026-11-15T00:00:00.000Z" }
      await act(async () => { resoudre(Response.json(culture)) })
      await waitFor(() => expect(cellule(action.colonne)).toBe("15/11"))
      expect(cellule("État")).toBe(action.etat)
      expect(cellule("Espèce")).toBe("Laitue témoin")
      expect(cellule("Variété")).toBe("Batavia témoin")
      expect(cellule("Planche")).toBe("Planche témoin")
      expect(cellule("Récoltes")).toBe("2")
      expect(cellule("Plants")).toBe("100")
    }
    expect(fetchMock).toHaveBeenCalledTimes(4)

    patch.mockResolvedValueOnce(Response.json({ error: "Des récoltes sont déjà enregistrées." }, { status: 409 }))
    fireEvent.click(within(ligne).getByRole("button", { name: "Annuler le semis fait — confirmation requise" }))
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Confirmer le changement" })).getByRole("button", { name: "Confirmer" }))
    expect(await screen.findByText("Des récoltes sont déjà enregistrées.")).toBeTruthy()
    expect(cellule("Semis")).toBe("15/11")
    expect(cellule("État")).toBe("En récolte")
    await waitFor(() => expect((within(ligne).getByRole("button", { name: "Annuler le semis fait — confirmation requise" }) as HTMLButtonElement).disabled).toBe(false))
  })
})
