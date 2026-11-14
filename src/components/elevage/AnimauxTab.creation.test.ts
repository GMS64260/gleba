import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { isValidElement, type ReactElement, type ReactNode } from "react"

// Pilote les vrais gestionnaires du formulaire sans navigateur ni serveur Next.
// Les hooks conservent leur état entre deux rendus ; aucun index métier n’est injecté.
const mocks = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  toast: vi.fn(),
  fetch: vi.fn(),
}))
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: <T,>(initial: T | (() => T)) => {
    const index = mocks.index++
    if (!(index in mocks.states)) {
      mocks.states[index] = typeof initial === "function" ? (initial as () => T)() : initial
    }
    return [mocks.states[index], (next: T | ((previous: T) => T)) => {
      mocks.states[index] = typeof next === "function"
        ? (next as (previous: T) => T)(mocks.states[index] as T) : next
    }]
  },
  useEffect: () => {},
  useMemo: <T,>(compute: () => T) => compute(),
  useCallback: <T,>(callback: T) => callback,
  useRef: <T,>(current: T) => ({ current }),
}))
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("tab=animaux") }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock("@/hooks/use-elevage-modes", () => ({ useElevageModes: () => ({ filieres: ["rente"] }) }))
vi.mock("@/lib/elevage/filiere-context", async (original) => ({
  ...await original<typeof import("@/lib/elevage/filiere-context")>(),
  useFiliereSelection: () => "toutes",
}))

import { AnimauxTab } from "./AnimauxTab"
import { TabsContent } from "@/components/ui/tabs"

type Element = ReactElement<Record<string, unknown>>
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<Record<string, unknown>>(node)) return []
  return [node, ...elements(node.props.children as ReactNode)]
}
function trouver(node: ReactNode, predicate: (element: Element) => boolean): Element {
  const element = elements(node).find(predicate)
  if (!element) throw new Error("Élément du formulaire introuvable")
  return element
}

let formulaire: () => ReactNode
function rendre() {
  mocks.index = 0
  return formulaire()
}
function champ(nom: string) {
  return trouver(rendre(), (element) => element.props.name === nom)
}
function saisir(nom: string, value: string) {
  const change = champ(nom).props.onChange as (event: { target: { value: string } }) => void
  change({ target: { value } })
}
const NativeFormData = globalThis.FormData
async function soumettre() {
  const valeurs = ["identifiant", "typeIdentifiant", "dateNaissance", "dateArrivee"]
    .map((name) => [name, String(champ(name).props.value ?? "")])
  vi.stubGlobal("FormData", class extends NativeFormData {
    constructor() {
      super()
      for (const [name, value] of valeurs) this.set(name, value)
    }
  })
  const submit = trouver(rendre(), (element) => element.type === "form").props.onSubmit as
    (event: unknown) => Promise<void>
  await submit({ preventDefault() {}, currentTarget: { elements: { namedItem: () => null } } })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.states = []
  mocks.index = 0
  // Le sous-onglet est réellement celui monté par le module Élevage.
  const animaux = trouver(AnimauxTab(), (element) => element.type === TabsContent && element.props.value === "animaux")
  formulaire = (animaux.props.children as ReactElement).type as () => ReactNode
  mocks.states = []
  vi.stubGlobal("fetch", mocks.fetch)
  mocks.fetch.mockImplementation(async (_url: string, options?: RequestInit) => {
    if (options?.method === "POST") return Response.json({ data: { id: 9 } }, { status: 201 })
    return Response.json({ data: [] })
  })
  // Choisir le profil bovin par le même sélecteur que l’écran.
  const profil = trouver(rendre(), (element) => typeof element.props.onValueChange === "function"
    && element.props.value === "")
  ;(profil.props.onValueChange as (value: string) => void)("bovin")
})

afterEach(() => vi.unstubAllGlobals())

describe("formulaire complet des animaux (FRONT-09)", () => {
  it("conserve les champs d’identification et de statut sanitaire", () => {
    expect(champ("typeIdentifiant")).toBeDefined()
    expect(elements(rendre()).some((element) => element.props.children === "Statuts sanitaires")).toBe(true)
    expect(trouver(rendre(), (element) => element.type === "form")).toBeDefined()
  })

  it("affiche les deux avertissements de la réponse de création à l’écran", async () => {
    const warning = "Numéro EDE non renseigné : complétez-le. Statut sanitaire inconnu à l’introduction : complétez la fiche."
    mocks.fetch.mockResolvedValueOnce(Response.json({ data: { id: 9 }, warning }, { status: 201 }))

    await soumettre()

    expect(mocks.fetch).toHaveBeenCalledWith("/api/elevage/animaux", expect.objectContaining({ method: "POST" }))
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Prérequis réglementaire à compléter", description: warning,
    }))
  })

  it("refuse un BDNI invalide avec le champ et son format dans l’alerte visible", async () => {
    saisir("typeIdentifiant", "BDNI bovin")
    saisir("identifiant", "FICTIF-INVALIDE")
    await soumettre()

    expect(mocks.fetch).not.toHaveBeenCalled()
    const erreur = trouver(rendre(), (element) => element.props.role === "alert")
    expect(erreur.props.children).toContain("Identifiant invalide")
    expect(erreur.props.children).toContain("FR + 10 chiffres")
    expect(champ("identifiant").props["aria-invalid"]).toBe(true)
  })

  it("affiche aussi le nom du champ quand le serveur refuse l’identifiant", async () => {
    mocks.fetch.mockResolvedValueOnce(Response.json({
      error: "Données invalides",
      details: { fieldErrors: { identifiant: ["Identifiant invalide pour le type sélectionné"] } },
    }, { status: 400 }))
    await soumettre()

    expect(trouver(rendre(), (element) => element.props.role === "alert").props.children)
      .toBe("identifiant : Identifiant invalide pour le type sélectionné")
  })

  it("permet de choisir un identifiant auxiliaire pour créer le bovin", async () => {
    saisir("typeIdentifiant", "Auxiliaire éleveur")
    saisir("identifiant", "FICTIF-001")
    await soumettre()

    const body = JSON.parse(mocks.fetch.mock.calls[0][1].body)
    expect(body).toMatchObject({ especeAnimaleId: "bovin", typeIdentifiant: "Auxiliaire éleveur", identifiant: "FICTIF-001" })
    expect(mocks.toast).toHaveBeenCalledWith({ title: "Animal créé" })
  })
})
