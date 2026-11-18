import { afterEach, describe, expect, it, vi } from "vitest"
import { isValidElement, type ReactElement, type ReactNode } from "react"

const mocks = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  effects: [] as (() => void)[],
  navigation: vi.fn(),
}))
// Même pilote de hooks que le formulaire Animaux : vrais rendus et gestionnaires,
// sans serveur Next. Les statistiques sont chargées par l'effet du composant.
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: <T,>(initial: T | (() => T)) => {
    const index = mocks.index++
    if (!(index in mocks.states)) mocks.states[index] = typeof initial === "function" ? (initial as () => T)() : initial
    return [mocks.states[index], (next: T | ((previous: T) => T)) => {
      mocks.states[index] = typeof next === "function" ? (next as (previous: T) => T)(mocks.states[index] as T) : next
    }]
  },
  useEffect: (effect: () => void) => { mocks.effects.push(effect) },
  useMemo: <T,>(compute: () => T) => compute(),
  useCallback: <T,>(callback: T) => callback,
}))
vi.mock("@/lib/dashboard-navigation", () => ({ updateDashboardSearchParams: mocks.navigation }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/lib/elevage/filiere-context", async (original) => ({
  ...await original<typeof import("@/lib/elevage/filiere-context")>(),
  useFiliereSelection: () => "toutes",
}))

import { DashboardTab } from "./DashboardTab"

type Element = ReactElement<Record<string, unknown>>
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<Record<string, unknown>>(node)) return []
  return [node, ...elements(node.props.children as ReactNode)]
}
function rendre() {
  mocks.index = 0
  mocks.effects = []
  return DashboardTab({ year: 2026 })
}
function carteAnimaux() {
  return elements(rendre()).find((element) => typeof element.props.href === "string"
    && elements(element).some((child) => child.props.children === "Animaux actifs"))
}

afterEach(() => vi.unstubAllGlobals())

describe("navigation du tableau de bord Élevage (FRONT-09)", () => {
  it("ouvre l’onglet Animaux au clic depuis Élevage, y compris après retour depuis Lots", async () => {
    vi.clearAllMocks()
    mocks.states = []
    const location = { pathname: "/elevage", search: "" }
    vi.stubGlobal("window", { location, localStorage: { getItem: () => null } })
    vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json(url.startsWith("/api/elevage/stats") ? {
      stats: { animauxActifs: 3, animauxTotal: 3, lotsActifs: 0, ventesAnnee: 0, ventesAnneePrecedente: 0, tauxPonte: null, fcr: null },
      productions: [], animauxParType: [], productionOeufsMois: [],
      ventesParCategorie: { categories: [], mois: [] },
    } : {})))
    rendre()
    for (const effect of mocks.effects) effect()
    await vi.waitFor(() => expect(carteAnimaux()).toBeDefined())

    const carte = carteAnimaux()!
    expect(carte.props.href).toBe("/elevage?tab=animaux")
    expect(carte.props.prefetch).toBe(false)
    const cliquer = carte.props.onClick as (event: unknown) => void
    expect(cliquer).toBeTypeOf("function")
    for (const search of ["", "?tab=animaux&sub=lots", ""]) {
      location.search = search
      const preventDefault = vi.fn()
      cliquer({ button: 0, preventDefault })
      expect(preventDefault).toHaveBeenCalledOnce()
      expect(mocks.navigation).toHaveBeenLastCalledWith(new URLSearchParams("tab=animaux"), "push")
    }
    expect(mocks.navigation).toHaveBeenCalledTimes(3)

    // L'ouverture dans un autre onglet conserve le comportement natif du lien.
    for (const modificateur of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      const preventDefault = vi.fn()
      cliquer({ button: 0, ...modificateur, preventDefault })
      expect(preventDefault).not.toHaveBeenCalled()
    }
    expect(mocks.navigation).toHaveBeenCalledTimes(3)
  })
})
