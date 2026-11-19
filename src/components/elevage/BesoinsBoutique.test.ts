// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"

const acces = vi.hoisted(() => ({ tenantId: "ferme-a", confirme: true, modules: null as string[] | null, actif: true, loading: false }))
vi.mock("@/hooks/use-exploitation", () => ({ useExploitation: () => ({ contexteConfirme: acces.confirme, contexte: { tenantId: acces.tenantId, modules: acces.modules } }) }))
vi.mock("@/hooks/use-modules", () => ({ useModules: () => ({ loading: acces.loading, isActif: () => acces.actif }) }))
vi.mock("@/hooks/use-acces-service", () => ({ useAccesService: () => ({ acces: null }) }))
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "authenticated", data: { user: { id: "acteur" } } }) }))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("sub=oeufs"), usePathname: () => "/aujourdhui",
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, prefetch() {} }),
}))

import { BesoinsBoutique } from "./BesoinsBoutique"

const oeufs = { type: "oeufs", ref: "stock", nom: "Œufs", unite: "pièce", quantite: 72, commandes: 3, retraitLePlusProche: "2026-11-27T12:00:00Z", disponible: 12, manque: 60 }
const miel = { type: "ruche", ref: "miel", nom: "Miel", unite: "kg", quantite: 2.75, commandes: 2, retraitLePlusProche: "2026-11-29T12:00:00Z", disponible: 0.5, manque: 2.25 }
const reponse = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } })
const fetchMock = vi.fn<typeof fetch>()
const lecture = vi.fn<() => Promise<Response>>()
const bloc = () => screen.getByRole("region", { name: "À produire pour la boutique" })

beforeEach(() => {
  Object.assign(acces, { tenantId: "ferme-a", confirme: true, modules: null, actif: true, loading: false })
  window.localStorage.clear()
  lecture.mockReset().mockImplementation(async () => reponse([oeufs, miel]))
  fetchMock.mockReset().mockImplementation(async (url) => String(url) === "/api/elevage/besoins-boutique" ? lecture() : reponse({ error: "Indisponible" }, 503))
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe("lecture partagée : états et cloisonnement", () => {
  it("n’affiche aucun encadré pendant le chargement ni quand il n’y a rien à produire", async () => {
    let terminer!: (r: Response) => void
    lecture.mockImplementationOnce(() => new Promise((resolve) => { terminer = resolve }))
    render(createElement(BesoinsBoutique))
    expect(lecture).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("region")).toBeNull()
    await act(async () => terminer(reponse([])))
    expect(screen.queryByRole("region")).toBeNull()
    expect(screen.queryByText(/Aucune commande/)).toBeNull()
  })
  it("n’affiche aucun encadré quand les besoins ne concernent pas l’atelier affiché", async () => {
    lecture.mockResolvedValueOnce(reponse([miel]))
    render(createElement(BesoinsBoutique, { type: "oeufs" }))
    await waitFor(() => expect(lecture).toHaveBeenCalledTimes(1))
    await act(async () => {})
    expect(screen.queryByRole("region")).toBeNull()
  })
  it.each([403, 500])("affiche un échec HTTP %s, puis permet une nouvelle tentative", async (status) => {
    lecture.mockResolvedValueOnce(reponse({}, status))
    render(createElement(BesoinsBoutique))
    expect((await screen.findByRole("alert")).textContent).toContain(status === 403 ? "pas accès" : "Impossible")
    expect(screen.queryByText(/Aucune commande/)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    await waitFor(() => expect(within(bloc()).getAllByRole("listitem")).toHaveLength(2))
    expect(lecture).toHaveBeenCalledTimes(2)
  })
  it("traduit une erreur réseau et permet de réessayer", async () => {
    lecture.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    render(createElement(BesoinsBoutique))
    expect((await screen.findByRole("alert")).textContent).toContain("Vérifiez votre connexion")
    expect(screen.queryByText(/Failed to fetch/)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    await screen.findByText("Œufs")
  })
  it("permet d’actualiser après livraison ou annulation sans recalculer le manque", async () => {
    render(createElement(BesoinsBoutique))
    await screen.findByText("Œufs")
    lecture.mockResolvedValueOnce(reponse([{ ...oeufs, quantite: 24, manque: 7, commandes: 1 }]))
    fireEvent.click(screen.getByRole("button", { name: "Actualiser les besoins" }))
    await waitFor(() => expect(bloc().textContent).toContain("Reste à produire : 7 pièce"))
    expect(bloc().textContent).toContain("24 pièce à fournir pour 1 commande")
    expect(screen.queryByText("Miel")).toBeNull()
  })
  it.each([
    { modules: ["maraichage"] }, { actif: false }, { confirme: false }, { loading: true }, { tenantId: "" },
  ])("n’émet aucune lecture des besoins sans accès confirmé : %j", (restriction) => {
    Object.assign(acces, restriction)
    render(createElement(BesoinsBoutique))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.queryByRole("region")).toBeNull()
  })
  it("efface le tenant précédent et ignore sa réponse tardive, même si fetch ignore l’annulation", async () => {
    let ancienne!: (r: Response) => void
    lecture.mockImplementationOnce(() => new Promise((resolve) => { ancienne = resolve }))
    const vue = render(createElement(BesoinsBoutique))
    const signal = fetchMock.mock.calls[0][1]?.signal
    acces.tenantId = "ferme-b"
    lecture.mockResolvedValueOnce(reponse([{ ...miel, nom: "Besoin nouvelle ferme" }]))
    vue.rerender(createElement(BesoinsBoutique))
    expect(signal?.aborted).toBe(true)
    await screen.findByText("Besoin nouvelle ferme")
    await act(async () => ancienne(reponse([oeufs])))
    expect(screen.queryByText("Œufs")).toBeNull()
    acces.tenantId = "ferme-c"
    lecture.mockImplementationOnce(() => new Promise(() => {}))
    vue.rerender(createElement(BesoinsBoutique))
    expect(screen.queryByText("Besoin nouvelle ferme")).toBeNull()
    expect(screen.queryByRole("region")).toBeNull()
  })
  it("purge immédiatement les besoins affichés à la révocation de l’accès", async () => {
    const vue = render(createElement(BesoinsBoutique))
    await screen.findByText("Œufs")
    acces.modules = ["maraichage"]
    vue.rerender(createElement(BesoinsBoutique))
    expect(screen.queryByText("Œufs")).toBeNull()
    expect(screen.queryByRole("region")).toBeNull()
  })
})
