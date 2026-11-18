// @vitest-environment jsdom

import { createElement } from "react"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import SaisieRecoltePage from "./page"

vi.mock("@/components/shell/AppHeader", () => ({ AppHeader: () => null, PageToolbar: () => null }))
vi.mock("@/components/avis/PartagerRecolte", () => ({ BoutonPartagerRecolte: () => null }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))

function culture(id: number, nom = `Culture fictive ${id}`) {
  return {
    id, especeId: `espece-${id}`, varieteId: null, plancheId: null, longueur: null,
    dateRecolte: null, finRecolte: null, terminee: null as string | null,
    espece: { id: `espece-${id}`, nom, rendement: null, uniteRendement: "kg/m²" },
    variete: null, planche: null, totalRecolte: 0,
  }
}
// La plus ancienne est au-delà de l'ancienne limite de 500 ; une culture
// terminée partage son nom pour éprouver le filtre serveur enCours.
const cultures = [
  { ...culture(502, "Ancienne témoin terminée"), terminee: "2026-10-01" },
  ...Array.from({ length: 501 }, (_, i) => culture(501 - i, i === 500 ? "Ancienne témoin" : undefined)),
]
function reponseListe(url: string, donnees = cultures) {
  const params = new URL(url, "http://gleba.test").searchParams
  const page = Number(params.get("page") || 1)
  const pageSize = Number(params.get("pageSize") || 50)
  const recherche = (params.get("search") || "").toLocaleLowerCase("fr")
  const filtrees = donnees.filter(c =>
    (params.get("enCours") !== "1" || !c.terminee) && c.espece.nom.toLocaleLowerCase("fr").includes(recherche))
  return Response.json({
    data: filtrees.slice((page - 1) * pageSize, page * pageSize),
    total: filtrees.length, page, pageSize, totalPages: Math.ceil(filtrees.length / pageSize),
  })
}
const post = vi.fn<() => Promise<Response>>()
const fetchMock = vi.fn((url: string, options?: RequestInit): Promise<Response> => {
  if (url === "/api/recoltes" && options?.method === "POST") return post()
  return Promise.resolve(reponseListe(url))
})
const liste = () => screen.getByRole("combobox") as HTMLSelectElement
const recherche = () => screen.getByRole("searchbox", { name: "Rechercher une culture" })
function chercher(texte: string) { fireEvent.change(recherche(), { target: { value: texte } }) }
const suivante = () => screen.getByRole("button", { name: "Page suivante" })
const precedente = () => screen.getByRole("button", { name: "Page précédente" })
const ids = () => within(liste()).getAllByRole("option").map(o => (o as HTMLOptionElement).value).filter(Boolean)
async function pret() { await waitFor(() => expect(screen.queryByText("Chargement des cultures…")).toBeNull()) }
async function soumettre() {
  fireEvent.change(screen.getByLabelText("Date récolte"), { target: { value: "2026-11-18" } })
  fireEvent.change(screen.getByLabelText(/Quantité/), { target: { value: "2" } })
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer la récolte" }))
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
}

beforeEach(() => {
  fetchMock.mockClear()
  post.mockReset().mockResolvedValue(Response.json({ id: 900, unite: "kg" }))
  fetchMock.mockImplementation((url: string, options?: RequestInit) => {
    if (url === "/api/recoltes" && options?.method === "POST") return post()
    return Promise.resolve(reponseListe(url))
  })
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe("Saisie de récolte : accès paginé aux cultures", () => {
  it("retrouve la 501e culture active par recherche et poste exactement son id", async () => {
    render(createElement(SaisieRecoltePage))
    await pret()
    expect(ids()).not.toContain("1")
    expect(fetchMock).toHaveBeenCalledTimes(1) // pas de chargement intégral au montage
    chercher("Ancienne témoin")
    await screen.findByRole("option", { name: "#1 · Ancienne témoin" })
    expect(ids()).toEqual(["1"])
    fireEvent.change(liste(), { target: { value: "1" } })
    await soumettre()
    const appel = fetchMock.mock.calls.find(([, options]) => options?.method === "POST")!
    expect(JSON.parse(appel[1]!.body as string)).toMatchObject({ cultureId: 1, especeId: "espece-1", quantite: 2 })
    for (const [url] of fetchMock.mock.calls.filter(([url]) => url.startsWith("/api/cultures"))) {
      const params = new URL(url, "http://gleba.test").searchParams
      expect(params.get("enCours")).toBe("1")
      expect(Number(params.get("pageSize"))).toBeLessThanOrEqual(50)
    }
  })

  it("parcourt les pages sans doublons et conserve la sélection, même hors recherche", async () => {
    render(createElement(SaisieRecoltePage))
    await pret()
    const premierePage = ids()
    expect(premierePage).toHaveLength(50)
    fireEvent.change(liste(), { target: { value: premierePage[0] } })
    fireEvent.click(suivante())
    await screen.findByText("Page 2 sur 11")
    expect(liste().value).toBe(premierePage[0])
    expect(new Set(ids()).size).toBe(ids().length)
    expect(ids().filter(id => premierePage.includes(id))).toEqual([premierePage[0]])
    chercher("Ancienne témoin")
    await screen.findByRole("option", { name: "#1 · Ancienne témoin" })
    expect(liste().value).toBe(premierePage[0])
    expect(new Set(ids()).size).toBe(ids().length)
    await soumettre()
    expect(JSON.parse(fetchMock.mock.calls.find(([, options]) => options?.method === "POST")![1]!.body as string).cultureId).toBe(Number(premierePage[0]))
    chercher("")
    await screen.findByText("Page 1 sur 11")
    expect(ids()).toEqual(premierePage)
    expect((precedente() as HTMLButtonElement).disabled).toBe(true)
    expect(new Set(ids()).size).toBe(ids().length)
  })

  it("atteint aussi la dernière culture par pagination seule et permet de revenir", async () => {
    render(createElement(SaisieRecoltePage))
    await pret()
    const visites = new Set(ids())
    for (let page = 2; page <= 11; page++) {
      fireEvent.click(suivante())
      await screen.findByText(`Page ${page} sur 11`)
      for (const id of ids()) {
        expect(visites.has(id)).toBe(false)
        visites.add(id)
      }
    }
    expect(visites.size).toBe(501)
    expect(ids()).toEqual(["1"])
    fireEvent.change(liste(), { target: { value: "1" } })
    fireEvent.click(precedente())
    await screen.findByText("Page 10 sur 11")
    expect(liste().value).toBe("1")
  })

  it("explique une recherche vide et garde la sélection", async () => {
    render(createElement(SaisieRecoltePage))
    await pret()
    fireEvent.change(liste(), { target: { value: "501" } })
    chercher("Introuvable")
    expect(await screen.findByText(/Aucune culture en cours ne correspond/)).toBeTruthy()
    expect(liste().value).toBe("501")
    chercher("")
    await screen.findByText("Page 1 sur 11")
    expect(liste().value).toBe("501")
  })

  it("distingue l'absence de cultures d'une recherche sans résultat", async () => {
    fetchMock.mockImplementation(url => Promise.resolve(reponseListe(url, [])))
    render(createElement(SaisieRecoltePage))
    expect(await screen.findByText(/Aucune culture en cours\. Créez une culture/)).toBeTruthy()
  })

  it("retire les doublons d'id d'une réponse et protège Entrée dans la recherche", async () => {
    fetchMock.mockImplementation(url => Promise.resolve(reponseListe(url, [culture(7), culture(7), culture(8)])))
    render(createElement(SaisieRecoltePage))
    await pret()
    expect(ids()).toEqual(["7", "8"])
    fireEvent.change(liste(), { target: { value: "7" } })
    fireEvent.change(screen.getByLabelText(/Quantité/), { target: { value: "2" } })
    const evenement = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
    fireEvent(recherche(), evenement)
    expect(evenement.defaultPrevented).toBe(true)
    expect(post).not.toHaveBeenCalled()
  })

  it("affiche l'erreur réseau et réessaie la page échouée sans perdre la sélection", async () => {
    render(createElement(SaisieRecoltePage))
    await pret()
    fireEvent.change(liste(), { target: { value: "501" } })
    fetchMock.mockRejectedValueOnce(new TypeError("Échec réseau fictif"))
    fireEvent.click(suivante())
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("n'ont pas pu être chargées"))
    expect(liste().value).toBe("501")
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    await screen.findByText("Page 2 sur 11")
    expect(liste().value).toBe("501")
  })

  it("écarte les réponses périmées et annule les recherches remplacées", async () => {
    render(createElement(SaisieRecoltePage))
    await pret()
    let resoudre!: (r: Response) => void
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { resoudre = resolve }))
    chercher("Culture fictive")
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const signal = fetchMock.mock.calls[1][1]!.signal!
    chercher("Ancienne témoin")
    await screen.findByRole("option", { name: "#1 · Ancienne témoin" })
    expect(signal.aborted).toBe(true)
    // Même un transport qui ignore AbortSignal ne doit pas rétablir l'ancienne réponse.
    await act(async () => { resoudre(reponseListe("/api/cultures?enCours=1&search=Culture%20fictive")) })
    expect(ids()).toEqual(["1"])
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("regroupe une frappe rapide en une seule requête et annule au démontage", async () => {
    render(createElement(SaisieRecoltePage))
    await pret()
    vi.useFakeTimers()
    for (const texte of ["A", "An", "Anc", "Ancienne témoin"]) chercher(texte)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(300) })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const signal = fetchMock.mock.calls[1][1]!.signal!
    cleanup()
    expect(signal.aborted).toBe(true)
  })

  it("garde visible le refus métier du POST après changement de recherche", async () => {
    post.mockResolvedValueOnce(Response.json({ error: "La récolte précède la plantation." }, { status: 400 }))
    render(createElement(SaisieRecoltePage))
    await pret()
    fireEvent.change(liste(), { target: { value: "501" } })
    await soumettre()
    expect(await screen.findByText("La récolte précède la plantation.")).toBeTruthy()
    chercher("Ancienne témoin")
    await screen.findByRole("option", { name: "#1 · Ancienne témoin" })
    expect(screen.getByText("La récolte précède la plantation.")).toBeTruthy()
    expect(liste().value).toBe("501")
  })
})
