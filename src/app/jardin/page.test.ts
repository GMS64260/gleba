// @vitest-environment jsdom

import * as React from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const contexte = vi.hoisted(() => ({ tenantId: "ferme-a", confirme: true }))
vi.mock("@/hooks/use-exploitation", () => ({
  useExploitation: () => ({ contexte: { tenantId: contexte.tenantId }, contexteConfirme: contexte.confirme }),
}))
vi.mock("next/navigation", async () => {
  const { useMemo, useSyncExternalStore } = await import("react")
  const abonnement = (fn: () => void) => {
    window.addEventListener("test:navigation", fn)
    return () => window.removeEventListener("test:navigation", fn)
  }
  return {
    usePathname: () => "/jardin",
    useSearchParams: () => {
      const query = useSyncExternalStore(abonnement, () => window.location.search)
      return useMemo(() => new URLSearchParams(query), [query])
    },
  }
})
vi.mock("next/dynamic", () => ({ default: () => () => null }))
vi.mock("@/components/shell/AppHeader", () => ({ AppHeader: () => null }))
vi.mock("@/hooks/use-fond-plan", () => ({ useFondPlan: () => ({ fond: null }) }))
vi.mock("@/components/garden/GardenView", () => ({
  DEFAULT_LAYERS: { fond: true, grille: true, etiquettes: true, associations: false },
  GardenView: ({ planches, onPlancheMove }: {
    planches: { id: string; posX: number; cultures: { espece: { nom: string } }[] }[]
    onPlancheMove: (id: string, x: number, y: number) => void
  }) => React.createElement("div", { "data-testid": "plan" }, planches.map(p =>
    React.createElement("div", { key: p.id },
      React.createElement("span", null, p.cultures.map(c => c.espece.nom).join(", ")),
      React.createElement("span", { "data-testid": "position" }, String(p.posX)),
      React.createElement("button", { onClick: () => onPlancheMove(p.id, 17, 8) }, "Déplacer la planche"),
    ))),
}))
// Les menus sont simplifiés ; le sélecteur d'année, la page, ses chargements
// et sa fusion des éditions locales sont ceux de l'application.
vi.mock("@/components/ui/select", async () => {
  const r = await import("react")
  const contenu = ({ children }: { children: React.ReactNode }) => r.createElement(r.Fragment, null, children)
  return {
    Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) =>
      r.createElement("select", { "aria-label": "Parcelle de test", value, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onValueChange(e.target.value) }, children),
    SelectTrigger: () => null, SelectValue: () => null,
    SelectContent: contenu, SelectGroup: contenu, SelectLabel: () => null,
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => r.createElement("option", { value }, children),
  }
})
vi.mock("@/components/ui/dropdown-menu", async () => {
  const r = await import("react")
  const contenu = ({ children }: { children: React.ReactNode }) => r.createElement(r.Fragment, null, children)
  return {
    DropdownMenu: contenu, DropdownMenuTrigger: contenu, DropdownMenuContent: contenu,
    DropdownMenuLabel: contenu, DropdownMenuSeparator: () => null,
    DropdownMenuCheckboxItem: () => null,
    DropdownMenuItem: ({ children, onSelect, onClick }: { children: React.ReactNode; onSelect?: () => void; onClick?: () => void }) =>
      r.createElement("button", { onClick: onSelect ?? onClick }, children),
  }
})

import JardinPage from "./page"

const N = new Date().getFullYear()
const fetchMock = vi.fn<typeof fetch>()
const planche = (annee: number, tenant = "ferme-a") => ({
  id: "planche-fictive", nom: "Planche témoin", largeur: 1, longueur: 4,
  posX: 2, posY: 3, rotation2D: 0, ilot: null, type: null, parcelleGeoId: "a",
  cultures: [{ id: 1, nbRangs: 1, espacement: 1, dateSemis: null, datePlantation: null,
    dateRecolte: null, finRecolte: null, itp: null,
    espece: { id: `espece-${annee}`, nom: `Culture ${tenant} ${annee}`, couleur: "#22c55e", etalement: 1, vivace: false, famille: null },
  }],
})
function differee<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => { resolve = r })
  return { promise, resolve }
}
const appelsPlan = () => fetchMock.mock.calls.filter(([url]) => new URL(String(url), "http://localhost").pathname === "/api/jardin")
function repondre(url: string | URL | Request, options?: RequestInit) {
  const u = new URL(String(url), "http://localhost")
  if (options?.method) return Response.json({ id: "nouvelle-planche" })
  if (u.pathname === "/api/jardin") {
    return Response.json(u.searchParams.get("parcelle") === "none" ? [] : [planche(Number(u.searchParams.get("annee")), contexte.tenantId)])
  }
  if (u.pathname === "/api/carte") return Response.json([
    { id: "a", nom: "Parcelle A", usage: "culture", geometry: "", _count: { planches: 1 } },
    { id: "b", nom: "Parcelle B", usage: "culture", geometry: "", _count: { planches: 1 } },
  ])
  return Response.json([])
}
function choisir(annee: number) { fireEvent.change(screen.getByRole("combobox", { name: "Saison" }), { target: { value: String(annee) } }) }
const cultureAffichee = () => screen.getByTestId("plan").textContent

beforeEach(() => {
  contexte.tenantId = "ferme-a"
  contexte.confirme = true
  window.localStorage.clear()
  window.history.replaceState(null, "", `/jardin?annee=${N}&parcelle=a`)
  const remplacer = window.history.replaceState.bind(window.history)
  vi.spyOn(window.history, "replaceState").mockImplementation((...args) => {
    remplacer(...args)
    window.dispatchEvent(new Event("test:navigation"))
  })
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockReset().mockImplementation(async (url, options) => repondre(url, options))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe("Plan 2D : année dans l'URL et dans chaque lecture", () => {
  it("N → N+1 → N change les données ; un rechargement conserve année et parcelle", async () => {
    const page = render(React.createElement(JardinPage))
    await waitFor(() => expect(cultureAffichee()).toContain(`Culture ferme-a ${N}`))
    choisir(N + 1)
    expect(window.location.search).toContain(`annee=${N + 1}`)
    await waitFor(() => expect(cultureAffichee()).toContain(`Culture ferme-a ${N + 1}`))
    choisir(N)
    await waitFor(() => expect(cultureAffichee()).toContain(`Culture ferme-a ${N}`))
    fireEvent.change(screen.getByRole("combobox", { name: "Parcelle de test" }), { target: { value: "b" } })
    await waitFor(() => expect(cultureAffichee()).toContain(`Culture ferme-a ${N}`))
    expect(window.location.search).toContain("parcelle=b")
    choisir(N + 1)
    await waitFor(() => expect(cultureAffichee()).toContain(`Culture ferme-a ${N + 1}`))
    page.unmount()
    const debut = fetchMock.mock.calls.length
    render(React.createElement(JardinPage))
    await waitFor(() => expect(cultureAffichee()).toContain(`Culture ferme-a ${N + 1}`))
    expect((screen.getByRole("combobox", { name: "Saison" }) as HTMLSelectElement).value).toBe(String(N + 1))
    expect(fetchMock.mock.calls.slice(debut).some(([url]) => String(url) === `/api/jardin?annee=${N + 1}&parcelle=b`)).toBe(true)
    for (const [url, options] of appelsPlan()) {
      expect([String(N), String(N + 1)]).toContain(new URL(String(url), "http://localhost").searchParams.get("annee"))
      expect(options?.method).toBeUndefined()
    }
    expect(appelsPlan().some(([url]) => String(url) === `/api/jardin?annee=${N + 1}&parcelle=none`)).toBe(true)
    expect(fetchMock.mock.calls.every(([, options]) => !options?.method)).toBe(true)
  })

  it("ignore N tardif après N+1, y compris après le retour à N", async () => {
    const ancienne = differee<Response>()
    fetchMock.mockImplementation(async (url, options) => String(url) === `/api/jardin?annee=${N}&parcelle=a` ? ancienne.promise : repondre(url, options))
    render(React.createElement(JardinPage))
    choisir(N + 1)
    await waitFor(() => expect(cultureAffichee()).toContain(`Culture ferme-a ${N + 1}`))
    await act(async () => ancienne.resolve(Response.json([planche(N)])))
    expect(cultureAffichee()).toContain(`Culture ferme-a ${N + 1}`)
    expect(cultureAffichee()).not.toContain(`Culture ferme-a ${N}`)
    fetchMock.mockImplementation(async (url, options) => repondre(url, options))
    choisir(N)
    await waitFor(() => expect(cultureAffichee()).toContain(`Culture ferme-a ${N}`))
  })

  it("conserve un déplacement non enregistré pendant le changement d'année", async () => {
    render(React.createElement(JardinPage))
    await screen.findByTestId("plan")
    fireEvent.click(screen.getByRole("button", { name: "Déplacer la planche" }))
    expect(screen.getByTestId("position").textContent).toBe("17")
    choisir(N + 1)
    await waitFor(() => expect(cultureAffichee()).toContain(`Culture ferme-a ${N + 1}`))
    expect(screen.getByTestId("position").textContent).toBe("17")
    choisir(N)
    await waitFor(() => expect(cultureAffichee()).toContain(`Culture ferme-a ${N}`))
    expect(screen.getByTestId("position").textContent).toBe("17")
    expect(fetchMock.mock.calls.every(([, options]) => !options?.method)).toBe(true)
  })

  it("sur échec de N+1 masque N, propose de réessayer et garde le déplacement local", async () => {
    render(React.createElement(JardinPage))
    await screen.findByTestId("plan")
    fireEvent.click(screen.getByRole("button", { name: "Déplacer la planche" }))
    fetchMock.mockImplementation(async (url, options) => String(url) === `/api/jardin?annee=${N + 1}&parcelle=a`
      ? Response.json({ error: "Échec fictif" }, { status: 500 }) : repondre(url, options))
    choisir(N + 1)
    await screen.findByRole("alert")
    expect(screen.queryByTestId("plan")).toBeNull()
    expect(screen.queryByText(`Culture ferme-a ${N}`)).toBeNull()
    fetchMock.mockImplementation(async (url, options) => repondre(url, options))
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    await waitFor(() => expect(cultureAffichee()).toContain(`Culture ferme-a ${N + 1}`))
    expect(screen.getByTestId("position").textContent).toBe("17")
  })

  it.each(["invalide", "1999", "9999", "2026oops"])("corrige l'année URL %s sans requête invalide", async (valeur) => {
    window.localStorage.setItem("gleba_dashboard_year", String(N + 1))
    window.history.replaceState(null, "", `/jardin?annee=${valeur}&parcelle=a`)
    render(React.createElement(JardinPage))
    await waitFor(() => expect(window.location.search).toMatch(/annee=\d{4}/))
    await screen.findByTestId("plan")
    for (const [url] of appelsPlan()) {
      expect([String(N), String(N + 1)]).toContain(new URL(String(url), "http://localhost").searchParams.get("annee"))
    }
  })

  it("restaure la préférence du module sans charger d'abord l'année courante", async () => {
    window.history.replaceState(null, "", "/jardin?parcelle=a")
    window.localStorage.setItem("gleba_dashboard_year", String(N + 1))
    render(React.createElement(JardinPage))
    await waitFor(() => expect(cultureAffichee()).toContain(`Culture ferme-a ${N + 1}`))
    expect(appelsPlan().every(([url]) => new URL(String(url), "http://localhost").searchParams.get("annee") === String(N + 1))).toBe(true)
    expect(window.location.search).toContain(`annee=${N + 1}`)
  })

  it("un changement d'exploitation détruit les données et éditions précédentes, et ignore leurs réponses tardives", async () => {
    const page = render(React.createElement(JardinPage))
    await screen.findByTestId("plan")
    fireEvent.click(screen.getByRole("button", { name: "Déplacer la planche" }))
    const retard = differee<Response>()
    fetchMock.mockImplementation(async (url, options) => String(url) === `/api/jardin?annee=${N + 1}&parcelle=a` ? retard.promise : repondre(url, options))
    choisir(N + 1)
    contexte.confirme = false
    page.rerender(React.createElement(JardinPage))
    expect(screen.queryByTestId("plan")).toBeNull()
    contexte.tenantId = "ferme-b"
    contexte.confirme = true
    fetchMock.mockImplementation(async (url, options) => repondre(url, options))
    page.rerender(React.createElement(JardinPage))
    await waitFor(() => expect(cultureAffichee()).toContain(`Culture ferme-b ${N + 1}`))
    expect(screen.getByTestId("position").textContent).toBe("2")
    await act(async () => retard.resolve(Response.json([planche(N + 1, "ferme-a")])))
    expect(screen.queryByText(/Culture ferme-a/)).toBeNull()
    expect(cultureAffichee()).toContain(`Culture ferme-b ${N + 1}`)
  })

  it("la création sur une autre parcelle relit cette parcelle avec la même année", async () => {
    render(React.createElement(JardinPage))
    await screen.findByTestId("plan")
    choisir(N + 1)
    await waitFor(() => expect(cultureAffichee()).toContain(`Culture ferme-a ${N + 1}`))
    fireEvent.click(screen.getAllByRole("button", { name: "Nouvelle planche" })[0])
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Planche créée" } })
    const selects = screen.getAllByRole("combobox", { name: "Parcelle de test" })
    fireEvent.change(selects[selects.length - 1], { target: { value: "b" } })
    fireEvent.click(screen.getByRole("button", { name: /^Créer$/ }))
    await waitFor(() => expect(appelsPlan().some(([url]) => String(url) === `/api/jardin?annee=${N + 1}&parcelle=b`)).toBe(true))
  })

  it("le rattachement des orphelines recharge le plan et leur liste avec l'année choisie", async () => {
    fetchMock.mockImplementation(async (url, options) => {
      const u = new URL(String(url), "http://localhost")
      if (u.pathname === "/api/jardin") return Response.json(u.searchParams.get("parcelle") === "none" ? [{ id: "orpheline", nom: "Orpheline fictive" }] : [])
      return repondre(url, options)
    })
    render(React.createElement(JardinPage))
    choisir(N + 1)
    fireEvent.click(await screen.findByRole("button", { name: "Rattacher à Parcelle A" }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, options]) => String(url) === "/api/planches/orpheline" && options?.method === "PUT")).toBe(true))
    await waitFor(() => expect(appelsPlan().filter(([url]) => String(url) === `/api/jardin?annee=${N + 1}&parcelle=none`).length).toBeGreaterThanOrEqual(2))
    expect(appelsPlan().filter(([url]) => String(url) === `/api/jardin?annee=${N + 1}&parcelle=a`).length).toBeGreaterThanOrEqual(2)
  })
})
