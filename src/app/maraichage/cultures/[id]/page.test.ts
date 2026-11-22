// @vitest-environment jsdom

import * as React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { format } from "date-fns"
import EditCulturePage from "./page"

const m = vi.hoisted(() => ({
  router: { push: vi.fn(), refresh: vi.fn() },
  toast: vi.fn(),
}))
vi.mock("next/navigation", () => ({ useRouter: () => m.router, useParams: () => ({ id: "49" }) }))
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { id: "ferme-test" } } }) }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock("@/components/shell/AppHeader", () => ({ AppHeader: () => null, PageToolbar: () => null }))

// Contrôles natifs pour les sélecteurs : pas de dépendance au placement des
// portails Radix dans jsdom. Le formulaire, son schéma et ses effets sont réels.
vi.mock("@/components/ui/select", async () => {
  const R = await import("react")
  type SelectProps = { children?: React.ReactNode; value?: string; disabled?: boolean; onValueChange?: (value: string) => void }
  const Context = R.createContext<SelectProps>({})
  const options = (children: React.ReactNode): React.ReactNode => R.Children.map(children, (child): React.ReactNode => {
    if (!R.isValidElement<{ value?: string; children?: React.ReactNode }>(child)) return null
    if (child.props.value) return R.createElement("option", { value: child.props.value }, child.props.value)
    return options(child.props.children)
  })
  const Trigger = R.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>((props, ref) => {
    const context = R.useContext(Context)
    return R.createElement("select", {
      ...props, ref, value: context.value ?? "", disabled: context.disabled,
      onChange: (event: React.ChangeEvent<HTMLSelectElement>) => context.onValueChange?.(event.target.value),
    }, R.createElement("option", { value: "" }, "Sélectionner"), options(context.children))
  })
  Trigger.displayName = "SelectTriggerTest"
  return {
    Select: (props: SelectProps) => R.createElement(Context.Provider, { value: props }, props.children),
    SelectTrigger: Trigger,
    SelectContent: () => null,
    SelectItem: () => null,
    SelectValue: () => null,
  }
})

const datesInitiales = {
  dateSemis: "2026-10-01T00:00:00.000Z",
  datePlantation: "2026-10-15T00:00:00.000Z",
  dateRecolte: "2026-11-12T00:00:00.000Z",
}
const cultureInitiale = {
  especeId: "laitue-test", itpId: "itp-initial", plancheId: "planche-10", annee: 2026,
  ...datesInitiales,
  semisFait: false, plantationFaite: false, recolteFaite: false,
  longueur: 5, nbRangs: 2, espacement: 25, quantite: 40,
}
const itpHiver = {
  id: "itp-hiver", nom: "Hiver", userId: "ferme-test", especeId: "laitue-test",
  semaineSemis: 49, semainePlantation: 52, semaineRecolte: 8,
  nbRangs: 2, espacement: 25, dureeRecolte: 28,
}
const planches = [
  { id: "planche-10", nom: "Dix mètres", longueur: 10, type: "Plein champ" },
  { id: "planche-8", nom: "Huit mètres", longueur: 8, type: "Plein champ" },
]

function differee<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

function reponse(data: unknown) {
  return { ok: true, json: async () => data } as Response
}

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>
let corpsEnvoye: Record<string, unknown> | undefined

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  corpsEnvoye = undefined
  fetchMock = vi.fn<typeof fetch>()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function ouvrir(culture: Partial<typeof cultureInitiale> & { recoltes?: unknown[] } = {}, renduLent = false) {
  const cultureChargee = differee<Response>()
  const planchesChargees = differee<Response>()
  fetchMock.mockImplementation(async (input, init) => {
    const url = String(input)
    if (url === "/api/cultures/49" && init?.method === "PUT") {
      corpsEnvoye = JSON.parse(String(init.body)) as Record<string, unknown>
      return reponse({})
    }
    if (url === "/api/cultures/49") return cultureChargee.promise
    if (url.startsWith("/api/planches?")) return planchesChargees.promise
    if (url.startsWith("/api/especes?")) return reponse({ data: [{ id: "laitue-test" }] })
    if (url === "/api/especes/laitue-test") return reponse({ varietes: [] })
    if (url.startsWith("/api/itps?")) return reponse({ data: [{ ...itpHiver, id: "itp-initial", nom: "Initial" }, itpHiver] })
    throw new Error(`Requête inattendue : ${url}`)
  })
  render(React.createElement(EditCulturePage))
  await act(async () => {
    cultureChargee.resolve(reponse({ ...cultureInitiale, ...culture }))
    await vi.advanceTimersByTimeAsync(150)
  })
  expect(screen.queryByLabelText("Longueur (m)")).toBeNull()
  await act(async () => {
    planchesChargees.resolve(reponse({ data: planches }))
    // Promise.all attend les planches. Un rendu lent peut laisser expirer le
    // délai d'initialisation avant le commit React des références et du reset.
    if (renduLent) await vi.advanceTimersByTimeAsync(150)
  })
  await act(async () => { vi.advanceTimersByTime(150) })
  expect(screen.getByRole("combobox", { name: "Itinéraire technique (ITP)" }).querySelectorAll("option")).toHaveLength(3)
}

function valeur(label: string | RegExp) {
  return (screen.getByLabelText(label) as HTMLInputElement).value
}
function choisir(label: string, value: string) {
  fireEvent.change(screen.getByRole("combobox", { name: label }), { target: { value } })
}
async function enregistrer() {
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Enregistrer" })) })
  expect(m.toast.mock.calls.filter(([options]) => options.variant === "destructive")).toEqual([])
  expect(corpsEnvoye).toBeDefined()
  expect(fetchMock).toHaveBeenCalledWith("/api/cultures/49", expect.objectContaining({ method: "PUT" }))
  return corpsEnvoye!
}

// Dates calculées à l'écran : envoyées en jour seul (`datesCalculeesEnJoursSeuls`),
// que le serveur lit sans fuseau.
const datesHiver = {
  dateSemis: "2026-11-30",
  datePlantation: "2026-12-21",
  dateRecolte: "2027-02-22",
}

describe("fiche culture : effets du formulaire d'édition", () => {
  it("garde 5 m et 40 plants avec les planches chargées après la culture, puis ne change que Terminée au PUT", async () => {
    await ouvrir({}, true)
    expect(valeur("Longueur (m)")).toBe("5")
    expect(valeur(/Quantité \/ plants/)).toBe("40")
    choisir("Terminée", "x")
    expect(await enregistrer()).toMatchObject({ longueur: 5, quantite: 40, terminee: "x" })
  })

  it("Bug Ail #509 : changer explicitement de planche applique sa longueur et recalcule les plants, y compris au retour", async () => {
    await ouvrir()
    choisir("Planche", "planche-8")
    expect(valeur("Longueur (m)")).toBe("8")
    expect(valeur(/Quantité \/ plants/)).toBe("64")
    choisir("Planche", "planche-10")
    expect(await enregistrer()).toMatchObject({ plancheId: "planche-10", longueur: 10, quantite: 80 })
  })

  it("conserve une quantité stockée saisie à la main au chargement tardif et au changement de planche", async () => {
    await ouvrir({ quantite: 37 }, true)
    expect(valeur(/Quantité \/ plants/)).toBe("37")
    choisir("Planche", "planche-8")
    expect(await enregistrer()).toMatchObject({ longueur: 8, quantite: 37 })
  })

  it("conserve une quantité saisie à la main dans le formulaire quand la planche change", async () => {
    await ouvrir()
    fireEvent.change(screen.getByLabelText(/Quantité \/ plants/), { target: { value: "35" } })
    choisir("Planche", "planche-8")
    expect(await enregistrer()).toMatchObject({ longueur: 8, quantite: 35 })
  })

  it.each([
    { nom: "trois étapes faites", faits: { semisFait: true, plantationFaite: true, recolteFaite: true }, dates: datesInitiales },
    { nom: "aucune étape faite", faits: {}, dates: datesHiver },
    { nom: "seulement le semis fait", faits: { semisFait: true }, dates: { ...datesHiver, dateSemis: datesInitiales.dateSemis } },
  ])("changement d'ITP avec $nom : seules les dates prévues suivent l'itinéraire", async ({ faits, dates }) => {
    await ouvrir(faits)
    choisir("Itinéraire technique (ITP)", "itp-hiver")
    expect(await enregistrer()).toMatchObject({ itpId: "itp-hiver", ...dates })
  })

  it("FB-S9UM9T : verrouille les étapes faites quand des récoltes sont enregistrées, et dit pourquoi", async () => {
    await ouvrir({ semisFait: true, recolteFaite: true, recoltes: [{ id: 1, statut: "vendu" }, { id: 2, statut: "en_stock" }] })
    expect((screen.getByRole("checkbox", { name: "Récolte faite" }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole("checkbox", { name: "Semis fait" }) as HTMLButtonElement).disabled).toBe(true)
    // Une étape pas encore faite reste libre.
    expect((screen.getByRole("checkbox", { name: "Plantation faite" }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText(/2 récoltes sont enregistrées/)).toBeTruthy()
  })

  it("laisse décocher une étape faite quand la culture ne porte aucune récolte", async () => {
    await ouvrir({ recolteFaite: true })
    expect((screen.getByRole("checkbox", { name: "Récolte faite" }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.queryByText(/enregistrée/)).toBeNull()
  })

  it("ne recale pas une récolte faite après une modification manuelle du début de cycle", async () => {
    await ouvrir({ recolteFaite: true })
    fireEvent.change(screen.getByLabelText("Date plantation"), { target: { value: "2026-10-20" } })
    expect(await enregistrer()).toMatchObject({ datePlantation: "2026-10-20", dateRecolte: datesInitiales.dateRecolte })
  })

  it("continue à recaler une récolte prévue après une modification manuelle du début de cycle", async () => {
    await ouvrir()
    fireEvent.change(screen.getByLabelText("Date plantation"), { target: { value: "2026-10-20" } })
    // ITP S52 → S08 : 63 jours entre plantation et récolte, comme
    // `datesDepuisItp` (2026 compte 53 semaines ISO : 21/12/2026 → 22/02/2027).
    const corps = await enregistrer()
    expect(corps).toMatchObject({ datePlantation: "2026-10-20" })
    expect(format(new Date(corps.dateRecolte as string), "yyyy-MM-dd")).toBe("2026-12-22")
  })
})
