// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("sub=campagnes"),
  usePathname: () => "/elevage",
}))
vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: "authenticated", data: { user: { id: "acteur-fictif" } } }),
}))
const mocks = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }))

import { ReproductionTab } from "./ReproductionTab"

const fetchMock = vi.fn<typeof fetch>()
const saisie = {
  Nom: "Campagne fictive",
  Conduite: "Effet bouc",
  "Espèce (option.)": "caprin-fictif",
  Début: "2027-03-01",
  "Fin (option.)": "2027-04-01",
  "Mise-bas visée (option.)": "2027-08-01",
  Notes: "Notes fictives à abandonner",
}
const valeursInitiales = (jour: string) => ({
  Nom: "", Conduite: "Monte naturelle", "Espèce (option.)": "", Début: jour,
  "Fin (option.)": "", "Mise-bas visée (option.)": "", Notes: "",
})
function champ(libelle: string) {
  const label = within(screen.getByRole("dialog")).getByText(libelle, { selector: "label" })
  const input = label.parentElement?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")
  if (!input) throw new Error(`Champ introuvable : ${libelle}`)
  return input
}
function verifier(valeurs: Record<string, string>) {
  for (const [libelle, valeur] of Object.entries(valeurs)) expect(champ(libelle).value, libelle).toBe(valeur)
}
async function ouvrir() {
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Nouvelle campagne" })))
  expect(screen.getByRole("dialog").textContent).toContain("Nouvelle campagne de lutte")
}
function remplir() {
  for (const [libelle, value] of Object.entries(saisie)) fireEvent.change(champ(libelle), { target: { value } })
  verifier(saisie)
}
const mutations = () => fetchMock.mock.calls.filter(([, options]) => options?.method && options.method !== "GET")

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  // Le test ciblé tourne aussi à UTC−4 : à 23 h 30 locales, UTC est déjà au lendemain.
  vi.setSystemTime(new Date(2026, 10, 19, 23, 30))
  window.localStorage.clear()
  mocks.toast.mockReset()
  fetchMock.mockReset().mockImplementation(async (url, options) => {
    if (options?.method === "POST") return Response.json({ data: { id: "campagne-fictive" } }, { status: 201 })
    if (String(url) === "/api/elevage/especes-animales") {
      return Response.json({ data: [{ id: "caprin-fictif", nom: "Caprine fictive" }] })
    }
    return Response.json({ data: [] })
  })
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe("Campagnes : abandon du brouillon et nouvelle ouverture", () => {
  it.each(["Annuler", "Échap", "croix"])("%s abandonne les sept champs sans mutation HTTP", async (sortie) => {
    await act(async () => { render(createElement(ReproductionTab)) })
    await ouvrir()
    remplir()
    if (sortie === "Annuler") fireEvent.click(screen.getByRole("button", { name: "Annuler" }))
    else if (sortie === "Échap") fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape", code: "Escape", keyCode: 27 })
    else fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(mutations()).toEqual([])

    vi.setSystemTime(new Date(2026, 10, 20, 23, 30))
    await ouvrir()
    verifier(valeursInitiales("2026-11-20"))
    expect(mutations()).toEqual([])
  })

  it("calcule le jour local à la première ouverture même si le composant a passé minuit fermé", async () => {
    await act(async () => { render(createElement(ReproductionTab)) })
    vi.setSystemTime(new Date(2026, 10, 20, 23, 30))
    await ouvrir()
    verifier(valeursInitiales("2026-11-20"))
    expect(mutations()).toEqual([])
  })

  it("un refus HTTP conserve les sept champs, le dialogue ouvert et le message du serveur", async () => {
    await act(async () => { render(createElement(ReproductionTab)) })
    await ouvrir()
    remplir()
    fetchMock.mockResolvedValueOnce(Response.json({ error: "Création fictive refusée" }, { status: 400 }))
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Créer" })))
    expect(screen.getByRole("dialog")).toBeTruthy()
    verifier(saisie)
    expect(mutations()).toHaveLength(1)
    expect(mocks.toast).toHaveBeenCalledWith({ variant: "destructive", title: "Erreur", description: "Création fictive refusée" })
  })

  it("une réussite émet un seul POST avec les sept champs puis laisse une nouvelle ouverture vierge", async () => {
    await act(async () => { render(createElement(ReproductionTab)) })
    await ouvrir()
    remplir()
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Créer" })))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(mutations()).toHaveLength(1)
    const [url, options] = mutations()[0]
    expect(url).toBe("/api/elevage/campagnes")
    expect(options?.method).toBe("POST")
    expect(JSON.parse(String(options?.body))).toEqual({
      nom: saisie.Nom, typeConduite: saisie.Conduite, especeAnimaleId: saisie["Espèce (option.)"],
      dateDebut: saisie.Début, dateFin: saisie["Fin (option.)"],
      objectifMiseBas: saisie["Mise-bas visée (option.)"], notes: saisie.Notes,
    })
    expect(mocks.toast).toHaveBeenCalledWith({ title: "Campagne créée" })
    vi.setSystemTime(new Date(2026, 10, 20, 23, 30))
    await ouvrir()
    verifier(valeursInitiales("2026-11-20"))
    expect(mutations()).toHaveLength(1)
  })
})
