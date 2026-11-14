import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { isValidElement, type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"

const hooks = vi.hoisted(() => ({ index: 0, states: [] as unknown[], toast: vi.fn() }))
// Même banc de hooks que CalendrierLunaire.test.ts : vrais composants et
// gestionnaires, aucun serveur ni navigateur. Les effets réseau sont neutralisés.
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: <T,>(initial: T | (() => T)) => {
    const index = hooks.index++
    if (!(index in hooks.states)) hooks.states[index] = typeof initial === "function" ? (initial as () => T)() : initial
    return [hooks.states[index], (next: T | ((old: T) => T)) => {
      hooks.states[index] = typeof next === "function" ? (next as (old: T) => T)(hooks.states[index] as T) : next
    }]
  },
  useEffect: () => {},
  useMemo: <T,>(fn: () => T) => fn(),
  useCallback: <T,>(fn: T) => fn,
  useRef: <T,>(value: T) => ({ current: value }),
  useId: () => "phyto-test",
}))
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { id: "ferme-fictive" } } }) }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: hooks.toast }) }))
vi.mock("@/components/shell/AppHeader", () => ({ AppHeader: () => null }))

import InterventionsPage from "@/app/interventions/page"
import { SanteTab } from "@/components/verger/SanteTab"
import { DarField } from "./DarField"
import { MotifRectificationField } from "./MotifRectificationField"

type Props = Record<string, unknown> & { children?: ReactNode; actions?: ReactNode }
type Element = ReactElement<Props>
function elements(root: ReactNode): Element[] {
  if (Array.isArray(root)) return root.flatMap(elements)
  if (!isValidElement<Props>(root)) return []
  return [root, ...elements(root.props.children), ...elements(root.props.actions)]
}
function find(root: ReactNode, predicate: (e: Element) => boolean): Element {
  const found = elements(root).find(predicate)
  expect(found, "contrôle présent dans le vrai formulaire").toBeDefined()
  return found!
}
function change(element: Element, value: string) {
  const onChange = element.props.onChange as (event: { target: { value: string } }) => void
  onChange({ target: { value } })
}
function rerender(component: () => ReactNode) {
  hooks.index = 0
  return component()
}
function subTab(name: string): () => ReactNode {
  const element = find(SanteTab(), (e) => typeof e.type === "function" && e.type.name === name)
  return element.type as () => ReactNode
}
const observation = {
  id: 41, arbreId: 7, date: "2026-01-02T00:00:00.000Z", type: "maladie",
  methodeTraitement: "biologique_purin", produit: "Purin d’ortie", doseAppliquee: 2,
  uniteDose: "L/ha", dar: 0, gravite: "faible", resolu: false,
  arbre: { id: 7, nom: "Pommier fictif", type: "pommier", espece: "Pommier" },
}
const intervention = {
  ...observation, type: "traitement_phyto", fait: true, source: "intervention",
  produitPhyto: observation.produit, cultureId: null, plancheId: null,
}
const submit = async (root: ReactNode, index = 0) => {
  const form = elements(root).filter((e) => e.type === "form")[index]
  expect(form).toBeDefined()
  await (form.props.onSubmit as (e: { preventDefault: () => void }) => Promise<void>)({ preventDefault() {} })
}
const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ error: "Réponse fictive" }), { status: 400 }))
function body() {
  expect(fetchMock).toHaveBeenCalledTimes(1)
  return JSON.parse(fetchMock.mock.calls[0][1]!.body as string) as Record<string, unknown>
}
function selectPurin(root: ReactNode) {
  const methode = find(root, (e) => typeof e.props.onValueChange === "function" &&
    elements(e.props.children).some((child) => child.props.value === "biologique_purin"))
  ;(methode.props.onValueChange as (v: string) => void)("biologique_purin")
}
function changeDar(root: ReactNode, value: string) {
  const champ = find(root, (e) => e.type === DarField)
  const props = champ.props as unknown as Parameters<typeof DarField>[0]
  const rendered = DarField(props)
  expect(renderToStaticMarkup(rendered)).toContain("0 = aucun délai")
  change(find(rendered, (e) => e.props.type === "number"), value)
}
function changeMotif(root: ReactNode, value: string) {
  const champ = find(root, (e) => e.type === MotifRectificationField)
  const rendered = MotifRectificationField(champ.props as unknown as Parameters<typeof MotifRectificationField>[0])
  expect(renderToStaticMarkup(rendered)).toContain("Motif de la rectification")
  const input = find(rendered, (e) => e.props.maxLength === 500)
  expect(input.props.required).toBe(true)
  change(input, value)
}

beforeEach(() => {
  hooks.index = 0
  hooks.states = []
  hooks.toast.mockClear()
  fetchMock.mockClear()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe("Intervention maraîchère (traitement_phyto, purin sans sélecteur de méthode)", () => {
  function creer() {
    let root = rerender(InterventionsPage)
    const type = find(root, (e) => e.type === "select" && elements(e.props.children).some((c) => c.props.value === "traitement_phyto"))
    change(type, "traitement_phyto")
    root = rerender(InterventionsPage)
    change(find(root, (e) => e.props.placeholder === "Nom commercial"), "Purin d’ortie")
    return rerender(InterventionsPage)
  }
  it.each(["", "0"])("DAR visible avec aide, saisie %j préservée dans la requête", async (dar) => {
    changeDar(creer(), dar)
    await submit(rerender(InterventionsPage))
    expect(body().dar).toBe(dar === "" ? null : 0)
    expect(body().motif).toBeUndefined()
  })
  it("ne demande pas de motif pour corriger un traitement encore planifié", async () => {
    creer()
    hooks.states[0] = [{ ...intervention, fait: false }]
    hooks.states[2] = false
    let root = rerender(InterventionsPage)
    ;(find(root, (e) => e.props.title === "Modifier").props.onClick as () => void)()
    root = rerender(InterventionsPage)
    expect(elements(root).some((e) => e.type === MotifRectificationField)).toBe(false)
    await submit(root)
    expect(body()).toMatchObject({ id: 41, fait: false, dar: 0 })
    expect(body().motif).toBeUndefined()
  })
  it("demande le motif d’un traitement réalisé et l’envoie même en décochant réalisé", async () => {
    creer()
    hooks.states[0] = [intervention]
    hooks.states[2] = false // chargement terminé : rendre la ligne fictive
    let root = rerender(InterventionsPage)
    ;(find(root, (e) => e.props.title === "Modifier").props.onClick as () => void)()
    root = rerender(InterventionsPage)
    expect(find(root, (e) => e.type === DarField).props.value).toBe("0")
    change(find(root, (e) => e.props.value === "2" && e.props.step === "0.01"), "3")
    root = rerender(InterventionsPage)
    changeMotif(root, "   ")
    await submit(rerender(InterventionsPage))
    expect(fetchMock).not.toHaveBeenCalled()
    root = rerender(InterventionsPage)
    ;(find(root, (e) => e.props.type === "checkbox").props.onChange as (e: { target: { checked: boolean } }) => void)({ target: { checked: false } })
    root = rerender(InterventionsPage)
    changeMotif(root, "  Correction de dose  ")
    await submit(rerender(InterventionsPage))
    expect(body()).toMatchObject({ id: 41, motif: "Correction de dose", dar: 0, fait: false, doseAppliquee: "3" })
    expect(fetchMock.mock.calls[0][1]?.method).toBe("PATCH")
  })
})

describe("Observation santé", () => {
  const component = subTab("ObservationsSubTab")
  function creer() {
    let root = rerender(component)
    change(find(root, (e) => e.props.name === "arbreId"), "7")
    root = rerender(component)
    change(find(root, (e) => e.props.name === "type"), "maladie")
    root = rerender(component)
    selectPurin(root)
    return rerender(component)
  }
  it.each(["", "0"])("purin/décoction : DAR visible avec aide et saisie %j envoyée", async (dar) => {
    changeDar(creer(), dar)
    await submit(rerender(component))
    expect(body().dar).toBe(dar === "" ? null : 0)
  })
  it("modification d’un traitement : motif requis et transmis", async () => {
    rerender(component)
    hooks.states[0] = [observation]
    hooks.states[2] = false
    let root = rerender(component)
    // Le bouton Modifier contient le crayon ; son gestionnaire réel ouvre la fiche.
    const button = find(root, (e) => typeof e.props.onClick === "function" && elements(e.props.children).some((c) => c.props.className === "h-4 w-4 text-lime-600"))
    ;(button.props.onClick as () => void)()
    root = rerender(component)
    expect(find(root, (e) => e.type === DarField).props.value).toBe("0")
    change(find(root, (e) => e.props.value === "2" && e.props.step === "0.01"), "3")
    root = rerender(component)
    changeMotif(root, "   ")
    await submit(rerender(component))
    expect(fetchMock).not.toHaveBeenCalled()
    changeMotif(rerender(component), "Correction de dose")
    await submit(rerender(component))
    expect(body()).toMatchObject({ motif: "Correction de dose", dar: 0, doseAppliquee: "3" })
    expect(fetchMock.mock.calls[0][0]).toBe("/api/arbres/observations/41")
    expect(fetchMock.mock.calls[0][1]?.method).toBe("PUT")
  })
})

describe("Registre phyto du verger", () => {
  const component = subTab("RegistrePhytoSubTab")
  it.each(["", "0"])("ajout purin/décoction : DAR visible avec aide et saisie %j envoyée", async (dar) => {
    let root = rerender(component)
    change(find(root, (e) => e.props.name === "arbreId"), "7")
    root = rerender(component)
    // Le second formulaire est l’ajout ; le premier est l’édition.
    const addForm = elements(root).filter((e) => e.type === "form")[1]
    selectPurin(addForm)
    root = rerender(component)
    changeDar(elements(root).filter((e) => e.type === "form")[1], dar)
    await submit(rerender(component), 1)
    expect(body().dar).toBe(dar === "" ? null : 0)
  })
  it.each(["", "0"])("édition : DAR %j, motif requis et conservé après changement de méthode", async (dar) => {
    rerender(component)
    hooks.states[0] = [observation]
    hooks.states[2] = false
    let root = rerender(component)
    const button = find(root, (e) => typeof e.props.onClick === "function" && elements(e.props.children).some((c) => c.props.className === "h-4 w-4 text-lime-600"))
    ;(button.props.onClick as () => void)()
    root = rerender(component)
    changeDar(elements(root).filter((e) => e.type === "form")[0], dar)
    root = rerender(component)
    const form = elements(root).filter((e) => e.type === "form")[0]
    changeMotif(form, "   ")
    await submit(rerender(component))
    expect(fetchMock).not.toHaveBeenCalled()
    const methode = find(form, (e) => typeof e.props.onValueChange === "function" &&
      elements(e.props.children).some((c) => c.props.value === "biologique_purin"))
    ;(methode.props.onValueChange as (v: string) => void)("mecanique_manuel")
    changeMotif(rerender(component), "  Correction de dose  ")
    await submit(rerender(component))
    expect(body()).toMatchObject({ motif: "Correction de dose", dar: dar === "" ? null : 0 })
    expect(fetchMock.mock.calls[0][1]?.method).toBe("PUT")
  })
})
