// @vitest-environment jsdom
import { createElement, Fragment } from "react"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import ParametresPage from "./page"
import { Toaster } from "@/components/ui/toaster"

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("rubrique=donnees") }))
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }))
vi.mock("@/components/shell/AppHeader", () => ({ AppHeader: () => null }))
vi.mock("@/components/abonnement/AbonnementSection", () => ({ AbonnementSection: () => null }))
vi.mock("@/components/meteo", () => ({ StationMeteoConfig: () => null }))
vi.mock("@/hooks/use-modules", () => ({ useModules: () => ({ modules: [], save: vi.fn(), loading: false, isActif: () => false }) }))
vi.mock("@/hooks/use-elevage-modes", () => ({ useElevageModes: () => ({ modes: [], save: vi.fn(), loading: false }) }))
vi.mock("@/hooks/use-is-demo", () => ({ useIsDemoAccount: () => false }))
vi.mock("@/lib/global-dialog", () => ({ confirmDialog: vi.fn().mockResolvedValue(true) }))

const message = "Restauration annulée intégralement : 2 ligne(s) Culture dépendent d'une référence obligatoire indisponible (especeId). Aucune donnée n'a été enregistrée ni modifiée."
const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  window.history.replaceState(null, "", "/parametres?rubrique=donnees")
  Element.prototype.scrollIntoView = vi.fn()
  fetchMock.mockReset().mockImplementation(async (url) => {
    if (url === "/api/account/import") return Response.json({ error: message, code: "IMPORT_REFERENCE_OBLIGATOIRE_ABSENTE", modele: "Culture", champ: "especeId", nombre: 2 }, { status: 422 })
    return Response.json({})
  })
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(Element.prototype, "scrollIntoView")
})

describe("Paramètres : restauration refusée", () => {
  it("affiche le message du serveur sous Échec de la restauration et aucun succès", async () => {
    render(createElement(Fragment, null, createElement(ParametresPage), createElement(Toaster)))
    const bouton = screen.getByRole("button", { name: "Restaurer une sauvegarde" })
    const fichier = bouton.parentElement!.querySelector('input[type="file"]')!
    fireEvent.change(fichier, { target: { files: [new File(['{"format":"2.0","data":{}}'], "sauvegarde.json", { type: "application/json" })] } })
    const titre = await screen.findByText("Échec de la restauration")
    expect(within(titre.parentElement!).getByText(message)).toBeTruthy()
    expect(screen.queryByText("Restauration réussie")).toBeNull()
    await waitFor(() => expect((bouton as HTMLButtonElement).disabled).toBe(false))
    const appels = fetchMock.mock.calls.filter(([url]) => url === "/api/account/import")
    expect(appels).toHaveLength(1)
    expect(appels[0][1]?.method).toBe("POST")
    expect((appels[0][1]?.body as FormData).get("file")).toBeInstanceOf(File)
  })
})
