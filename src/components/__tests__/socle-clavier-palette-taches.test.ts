/**
 * Tests DOM des vrais composants (sans serveur Next ni base).
 * jsdom et @testing-library/dom sont des devDependencies obligatoires.
 */
import { createRequire } from "node:module"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { act, createElement } from "react"
import type { Root } from "react-dom/client"
import { accesComplet } from "@/lib/abonnement/politique"

const requireOutil = createRequire(import.meta.url)
const JSDOM = requireOutil("jsdom").JSDOM
const getQueriesForElement = requireOutil("@testing-library/dom").getQueriesForElement

const { router, toast, searchParams } = vi.hoisted(() => ({
  router: { push: vi.fn() },
  toast: vi.fn(),
  searchParams: new URLSearchParams(),
}))
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/aide",
  useSearchParams: () => searchParams,
}))
vi.mock("@/hooks/use-acces-service", () => ({ useAccesService: () => ({ acces: { ...accesComplet("libre"), ia: false } }) }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }))

let dom: InstanceType<typeof JSDOM>
let root: Root
let container: HTMLDivElement
let createRoot: typeof import("react-dom/client").createRoot
let GlobalSearch: typeof import("../global-search").GlobalSearch
let TachesPage: typeof import("@/app/taches/page").default

beforeAll(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/aide",
    pretendToBeVisual: true,
  })
  for (const key of ["window", "document", "navigator", "HTMLElement", "HTMLInputElement", "Node", "Event", "CustomEvent", "MutationObserver", "getComputedStyle"]) {
    vi.stubGlobal(key, dom.window[key])
  }
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal("self", dom.window)
  vi.stubGlobal("requestAnimationFrame", dom.window.requestAnimationFrame.bind(dom.window))
  vi.stubGlobal("cancelAnimationFrame", dom.window.cancelAnimationFrame.bind(dom.window))
  // cmdk mesure sa liste et fait défiler l'option active dans un navigateur.
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  ;({ createRoot } = await import("react-dom/client"))
  // Initialiser le DOM avant ReactDOM et les composants qui le consultent à
  // l'import (cmdk, Radix, Link), comme dans un navigateur.
  ;({ GlobalSearch } = await import("../global-search"))
  ;({ default: TachesPage } = await import("@/app/taches/page"))
}, 30_000)

beforeEach(() => {
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

afterAll(() => {
  dom.window.close()
  vi.unstubAllGlobals()
})

async function raccourci(cible: Element, key: string, ctrlKey = false) {
  await act(async () => {
    cible.dispatchEvent(new window.KeyboardEvent("keydown", { key, ctrlKey, bubbles: true, cancelable: true }))
  })
}

async function rendrePalette() {
  await act(async () => {
    root.render(createElement("div", null,
      createElement("button", null, "Raccourcis clavier"),
      createElement(GlobalSearch),
    ))
  })
  const commandes = getQueriesForElement(container)
  const origine = commandes.getByRole("button", { name: "Raccourcis clavier" })
  origine.focus()
  await raccourci(origine, "k", true)
  const champ = commandes.getByRole("combobox", { name: "Recherche globale" })
  expect(document.activeElement).toBe(champ)
  return { commandes, origine, champ }
}

describe("Palette de recherche : clavier et focus", () => {
  it("Ctrl+K ouvre, puis Échap depuis le champ retire la palette et restitue le focus", async () => {
    const { commandes, origine, champ } = await rendrePalette()
    await raccourci(champ, "Escape")
    expect(commandes.queryByRole("combobox")).toBeNull()
    expect(document.activeElement).toBe(origine)
  })

  it("Ctrl+K ouvre et referme toujours la palette depuis son champ", async () => {
    const { commandes, champ } = await rendrePalette()
    await raccourci(champ, "k", true)
    expect(commandes.queryByRole("combobox")).toBeNull()
  })
})

// Données inventées : trois libellés sans accent, deux avec accent, plusieurs groupes.
const resultats = [
  { id: "culture-a", label: "Épinard fictif A", type: "Culture", href: "/maraichage/cultures/fictif-a" },
  { id: "culture-b", label: "Epinard fictif B", type: "Culture", href: "/maraichage/cultures/fictif-b" },
  { id: "variete-c", label: "Épinard fictif C", type: "Variété", href: "/maraichage/cultures?variete=fictif-c" },
  { id: "variete-d", label: "Epinard fictif D", type: "Variété", href: "/maraichage/cultures?variete=fictif-d" },
  { id: "variete-e", label: "Epinard fictif E", type: "Variété", href: "/maraichage/cultures?variete=fictif-e" },
]

function reponse(items = resultats) {
  return new Response(JSON.stringify({ items }), { headers: { "Content-Type": "application/json" } })
}

async function saisir(champ: Element, texte: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!
    setter.call(champ, texte)
    champ.dispatchEvent(new window.Event("input", { bubbles: true }))
  })
}

async function temporisation() {
  await act(async () => { await vi.advanceTimersByTimeAsync(201) })
}

function differee() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>(r => { resolve = r })
  return { promise, resolve }
}

describe("Palette de recherche : résultats serveur", () => {
  beforeEach(() => {
    router.push.mockClear()
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
  })

  it.each(["epinard", "épinard"])("affiche les cinq résultats de %s et ouvre le lien sélectionné au clavier", async (query) => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async () => reponse())
    const { commandes, champ } = await rendrePalette()
    await saisir(champ, query)
    await temporisation()
    expect(fetch).toHaveBeenCalledWith(`/api/search?q=${encodeURIComponent(query)}`)
    expect(commandes.getAllByRole("option").map((el: HTMLElement) => el.textContent)).toEqual(resultats.map(r => r.label))
    await raccourci(champ, "Home")
    await raccourci(champ, "ArrowDown")
    expect(commandes.getByRole("option", { selected: true }).textContent).toBe(resultats[1].label)
    await raccourci(champ, "Enter")
    expect(router.push).toHaveBeenCalledTimes(1)
    expect(router.push).toHaveBeenCalledWith(resultats[1].href)
    expect(commandes.queryByRole("combobox")).toBeNull()
  })

  it("conserve les actions sans requête, le seuil de deux caractères et la liste vide", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async () => reponse([]))
    const { commandes, champ } = await rendrePalette()
    const actions = commandes.getAllByRole("option").map((el: HTMLElement) => el.textContent)
    expect(actions).toContain("Saisir une récolteQuantité, planche, date")
    await saisir(champ, " ")
    await temporisation()
    expect(fetch).not.toHaveBeenCalled()
    expect(commandes.getAllByRole("option").map((el: HTMLElement) => el.textContent)).toEqual(actions)
    await saisir(champ, "zz")
    await temporisation()
    expect(commandes.queryAllByRole("option")).toHaveLength(0)
    expect(commandes.getByText("Aucun résultat pour « zz ».")).toBeTruthy()
    await saisir(champ, "")
    expect(commandes.getAllByRole("option").map((el: HTMLElement) => el.textContent)).toEqual(actions)
    await saisir(champ, "e")
    await temporisation()
    expect(fetch).toHaveBeenCalledTimes(1)
    await saisir(champ, "")
    await temporisation()
    await raccourci(champ, "Home")
    await raccourci(champ, "Enter")
    expect(router.push).toHaveBeenCalledTimes(1)
    expect(router.push).toHaveBeenCalledWith("/taches")
  })

  it("ne lance que la dernière frappe de la temporisation", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async () => reponse())
    const { champ, commandes } = await rendrePalette()
    for (const query of ["ep", "epi", "epinard"]) await saisir(champ, query)
    await temporisation()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith("/api/search?q=epinard")
    expect(commandes.getAllByRole("option")).toHaveLength(5)
  })

  it("ignore une réponse précédente reçue pendant la temporisation suivante", async () => {
    const ancienne = differee()
    vi.spyOn(globalThis, "fetch").mockReturnValueOnce(ancienne.promise).mockResolvedValueOnce(reponse([]))
    const { champ, commandes } = await rendrePalette()
    await saisir(champ, "ep")
    await temporisation()
    await saisir(champ, "epinard")
    await act(async () => ancienne.resolve(reponse()))
    expect(commandes.queryAllByRole("option")).toHaveLength(0)
    await temporisation()
    expect(commandes.queryAllByRole("option")).toHaveLength(0)
  })

  it("ignore une réponse ancienne même si la même requête est saisie à nouveau", async () => {
    const ancienne = differee()
    const recente = differee()
    vi.spyOn(globalThis, "fetch").mockReturnValueOnce(ancienne.promise).mockResolvedValueOnce(reponse([])).mockReturnValueOnce(recente.promise)
    const { champ, commandes } = await rendrePalette()
    await saisir(champ, "epinard")
    await temporisation()
    await saisir(champ, "zz")
    await temporisation()
    await saisir(champ, "epinard")
    await temporisation()
    await act(async () => recente.resolve(reponse([resultats[1]])))
    await act(async () => ancienne.resolve(reponse()))
    expect(commandes.getAllByRole("option").map((el: HTMLElement) => el.textContent)).toEqual([resultats[1].label])
  })

  it("invalide aussi la recherche quand on efface ou ferme la palette", async () => {
    const ancienne = differee()
    vi.spyOn(globalThis, "fetch").mockReturnValueOnce(ancienne.promise).mockResolvedValueOnce(reponse([]))
    const { champ, commandes, origine } = await rendrePalette()
    await saisir(champ, "epinard")
    await temporisation()
    await saisir(champ, "")
    await raccourci(champ, "Escape")
    await act(async () => ancienne.resolve(reponse()))
    await raccourci(origine, "k", true)
    const nouveauChamp = commandes.getByRole("combobox")
    await saisir(nouveauChamp, "epinard")
    expect(commandes.queryAllByRole("option")).toHaveLength(0)
    await temporisation()
    expect(commandes.queryAllByRole("option")).toHaveLength(0)
  })
})

async function rendreTaches() {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
    semis: [], plantations: [], recoltes: [], irrigation: [],
    stats: { semisPrevus: 0, semisFaits: 0, plantationsPrevues: 0, plantationsFaites: 0, recoltesPrevues: 0, recoltesFaites: 0, aIrriguer: 0 },
  }), { status: 200, headers: { "Content-Type": "application/json" } }))
  await act(async () => root.render(createElement(TachesPage)))
  return getQueriesForElement(container)
}

describe("Tâches : commandes accessibles", () => {
  it("nomme les quatre commandes de l'en-tête par leur geste", async () => {
    const commandes = await rendreTaches()
    const retour = commandes.getByRole("link", { name: "Revenir à l'accueil" })
    expect(retour.getAttribute("href")).toBe("/")
    expect(retour.getAttribute("title")).toBe("Revenir à l'accueil")
    for (const name of ["Actualiser", "Semaine précédente", "Semaine suivante"]) {
      expect(commandes.getByRole("button", { name }).getAttribute("title")).toBe(name)
    }
  })

  it("n'imbrique aucun bouton dans un lien sur la page", async () => {
    await rendreTaches()
    expect(container.querySelector("a button")).toBeNull()
  })
})
