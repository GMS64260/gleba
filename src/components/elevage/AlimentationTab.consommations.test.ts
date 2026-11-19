// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }))
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), usePathname: () => "/elevage" }))
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "authenticated", data: { user: { id: "acteur-fictif" } } }) }))

import { ConsommationsSubTab } from "./AlimentationTab"

// Fixtures intégralement inventées. Dialog, Select et ConfirmDialog ne sont pas mockés.
const aliment = { id: "foin-fictif", nom: "Foin fictif", type: "foin" }
const autreAliment = { id: "orge-fictive", nom: "Orge fictive", type: "cereale" }
const lot = { id: 71, nom: "Lot fictif", especeAnimale: { nom: "Ovin", filiere: "rente" } }
const animal = { id: 83, nom: "Animal fictif", identifiant: "FICTIF", especeAnimale: { nom: "Ovin", filiere: "rente" } }
const lignes = [
  { id: 101, aliment, lot, animal: null, date: "2025-04-03T12:00:00Z", quantite: 12.5, notes: "Anciennes notes fictives" },
  { id: 102, aliment, lot: null, animal, date: "2025-05-04T12:00:00Z", quantite: 7, notes: "Autres notes fictives" },
]
const fetchMock = vi.fn<typeof fetch>()
const ecrire = vi.fn<() => Promise<Response>>()
const mutations = () => fetchMock.mock.calls.filter(([, options]) => options?.method && options.method !== "GET")
const dialogue = () => screen.getByRole("dialog", { name: /consommation/ })
const quantite = () => within(dialogue()).getByRole("spinbutton") as HTMLInputElement
const date = () => dialogue().querySelector<HTMLInputElement>('input[type="date"]')!
const notes = () => dialogue().querySelector<HTMLTextAreaElement>("textarea")!
const soumettre = () => fireEvent.submit(dialogue().querySelector("form")!)

async function monter() {
  render(createElement(ConsommationsSubTab))
  await screen.findByText("12.5 kg")
}
function modifier(index = 0) {
  fireEvent.click(screen.getAllByTitle("Modifier")[index])
}
async function choisirAliment(nom = autreAliment.nom) {
  const combo = within(dialogue()).getAllByRole("combobox")[0]
  // Événements clavier réels du Select Radix, sans appel artificiel à son callback.
  fireEvent.keyDown(combo, { key: "ArrowDown" })
  fireEvent.click(await screen.findByRole("option", { name: nom }))
}
async function fermer(mode: string) {
  const d = dialogue()
  if (mode === "Annuler") fireEvent.click(within(d).getByRole("button", { name: "Annuler" }))
  else if (mode === "croix") fireEvent.click(within(d).getByRole("button", { name: "Close" }))
  else if (mode === "Échap") fireEvent.keyDown(d, { key: "Escape" })
  else {
    // DismissableLayer installe le listener extérieur au tick suivant.
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    fireEvent.pointerDown(document.body, { pointerType: "mouse", button: 0 })
  }
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
}
function verifierCreation(jour = "2026-11-19") {
  expect(within(dialogue()).getByText("Nouvelle consommation")).toBeTruthy()
  expect(within(dialogue()).getByText("— Sélectionner un aliment —")).toBeTruthy()
  expect(quantite().value).toBe("")
  expect(date().value).toBe(jour)
  expect(notes().value).toBe("")
  expect(within(dialogue()).getByText(/Une saisie globale/)).toBeTruthy()
  expect(within(dialogue()).getAllByRole("combobox")).toHaveLength(1)
  expect(within(dialogue()).queryByText("Lot fictif (Ovin)")).toBeNull()
  expect(within(dialogue()).queryByText("Animal fictif")).toBeNull()
  expect(within(dialogue()).getByRole("button", { name: /^Enregistrer$/ })).toBeTruthy()
}

beforeEach(() => {
  // Seule Date est simulée : les temporisateurs, la présence et les événements Radix restent réels.
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 19, 0, 15))
  toast.mockClear()
  ecrire.mockReset().mockImplementation(async () => Response.json({ data: { id: 999 } }, { status: 201 }))
  fetchMock.mockReset().mockImplementation(async (url, options) => {
    if (options?.method && options.method !== "GET") return ecrire()
    const chemin = String(url).split("?")[0]
    const data = chemin.endsWith("consommations-aliments") ? lignes
      : chemin.endsWith("/aliments") ? [aliment, autreAliment]
      : chemin.endsWith("/lots") ? [lot] : [animal]
    return Response.json({ data, stats: null, meta: { total: data.length } })
  })
  vi.stubGlobal("fetch", fetchMock)
  // API DOM utilisée par le Select Radix, absente de jsdom.
  HTMLElement.prototype.scrollIntoView = vi.fn()
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe("B8 : abandon puis Saisie rapide, avec le vrai dialogue Radix", () => {
  it.each([0, 1])("Annuler une édition affectée (ligne %s) ne préremplit aucune création", async index => {
    await monter()
    modifier(index)
    expect(date().value).toBe(lignes[index].date.split("T")[0])
    fireEvent.change(quantite(), { target: { value: "99" } })
    await fermer("Annuler")
    fireEvent.click(screen.getByRole("button", { name: "Saisie rapide" }))
    verifierCreation()
    soumettre()
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Sélectionnez un aliment" }))
    expect(mutations()).toHaveLength(0)
  })
})


describe("les quatre fermetures abandonnent toute saisie", () => {
  for (const mode of ["Annuler", "croix", "Échap", "extérieur"]) {
    it.each(["édition lot", "édition animal", "création"])(`${mode} après %s, puis réouverture et changement de jour`, async origine => {
      await monter()
      if (origine === "création") {
        fireEvent.click(screen.getByRole("button", { name: "Saisie rapide" }))
        await choisirAliment()
        fireEvent.click(within(dialogue()).getByRole("button", { name: /^Lot$/ }))
        fireEvent.keyDown(within(dialogue()).getAllByRole("combobox")[1], { key: "ArrowDown" })
        fireEvent.click(await screen.findByRole("option", { name: "Lot fictif (Ovin)" }))
      } else modifier(origine === "édition lot" ? 0 : 1)
      fireEvent.change(quantite(), { target: { value: "43.2" } })
      fireEvent.change(date(), { target: { value: "2024-02-29" } })
      fireEvent.change(notes(), { target: { value: "Brouillon à abandonner" } })
      await fermer(mode)
      modifier(origine === "édition animal" ? 1 : 0)
      const ligne = lignes[origine === "édition animal" ? 1 : 0]
      expect(quantite().value).toBe(String(ligne.quantite))
      expect(notes().value).toBe(ligne.notes)
      expect(date().value).toBe(ligne.date.split("T")[0])
      expect(within(dialogue()).getAllByRole("combobox")[0].textContent).toBe("Foin fictif")
      expect(within(dialogue()).getByText("Modifier la consommation")).toBeTruthy()
      await fermer(mode)
      vi.setSystemTime(new Date(2026, 10, 20, 0, 15))
      fireEvent.change(screen.getByRole("combobox", { name: "Période des consommations affichées" }), { target: { value: "toutes" } })
      await screen.findByText("12.5 kg")
      fireEvent.click(screen.getByRole("button", { name: "Saisie rapide" }))
      verifierCreation("2026-11-20")
      expect(mutations()).toHaveLength(0)
    })
  }
})

describe("requêtes de consommation", () => {
  it("refuse les champs vides puis crée une seule distribution avec les nouvelles valeurs", async () => {
    await monter()
    modifier(1)
    await fermer("Annuler")
    fireEvent.click(screen.getByRole("button", { name: "Saisie rapide" }))
    soumettre()
    expect(mutations()).toHaveLength(0)
    expect(toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Sélectionnez un aliment" }))
    await choisirAliment()
    soumettre()
    expect(mutations()).toHaveLength(0)
    expect(toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Renseignez la quantité" }))
    fireEvent.change(quantite(), { target: { value: "3.2" } })
    fireEvent.change(notes(), { target: { value: "Nouvelle distribution fictive" } })
    soumettre()
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(mutations()).toHaveLength(1)
    expect(mutations()[0][1]?.method).toBe("POST")
    expect(JSON.parse(String(mutations()[0][1]?.body))).toEqual({
      alimentId: autreAliment.id, lotId: null, animalId: null, date: "2026-11-19", quantite: 3.2, notes: "Nouvelle distribution fictive",
    })
  })

  it.each([0, 1])("édite la ligne %s par PATCH avec le bon id et sa cible enregistrée", async index => {
    await monter()
    modifier(index)
    fireEvent.change(quantite(), { target: { value: "4.2" } })
    soumettre()
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(mutations()).toHaveLength(1)
    expect(mutations()[0][1]?.method).toBe("PATCH")
    expect(JSON.parse(String(mutations()[0][1]?.body))).toEqual({
      id: lignes[index].id, alimentId: aliment.id, lotId: index === 0 ? lot.id : null,
      animalId: index === 1 ? animal.id : null, date: lignes[index].date.split("T")[0], quantite: 4.2, notes: lignes[index].notes,
    })
  })

  it.each([400, 404, 500])("un refus serveur %s conserve les valeurs et le mode d’édition", async status => {
    ecrire.mockImplementation(async () => Response.json({ error: "Refus fictif" }, { status }))
    await monter()
    modifier(1)
    fireEvent.change(quantite(), { target: { value: "6.4" } })
    fireEvent.change(notes(), { target: { value: "Saisie à conserver" } })
    soumettre()
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: "Refus fictif" })))
    expect(quantite().value).toBe("6.4")
    expect(notes().value).toBe("Saisie à conserver")
    expect(date().value).toBe("2025-05-04")
    expect(within(dialogue()).getByText("Édition de la consommation #102")).toBeTruthy()
    expect(mutations()).toHaveLength(1)
  })

  it("une panne réseau conserve aussi une création renseignée", async () => {
    ecrire.mockRejectedValue(new TypeError("Panne fictive"))
    await monter()
    fireEvent.click(screen.getByRole("button", { name: "Saisie rapide" }))
    await choisirAliment()
    fireEvent.change(quantite(), { target: { value: "6.4" } })
    fireEvent.change(notes(), { target: { value: "Création à conserver" } })
    soumettre()
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: "Panne fictive" })))
    expect(quantite().value).toBe("6.4")
    expect(notes().value).toBe("Création à conserver")
    expect(within(dialogue()).getByText("Nouvelle consommation")).toBeTruthy()
    expect(mutations()).toHaveLength(1)
  })

  it.each([
    ["STOCK_INSUFFISANT", false], ["STOCK_NON_INITIALISE", false],
    ["STOCK_INSUFFISANT", true], ["STOCK_NON_INITIALISE", true],
  ] as const)("%s en édition=%s exige une confirmation explicite, annulable", async (code, edition) => {
    ecrire.mockImplementation(async () => Response.json({ code, error: "Stock fictif refusé" }, { status: 422 }))
    await monter()
    if (edition) modifier(1)
    else fireEvent.click(screen.getByRole("button", { name: "Saisie rapide" }))
    await choisirAliment()
    fireEvent.change(quantite(), { target: { value: "6.4" } })
    fireEvent.change(notes(), { target: { value: "Confirmation fictive" } })
    soumettre()
    let confirmation = await screen.findByRole("dialog", { name: "Stock insuffisant" })
    expect(mutations()).toHaveLength(1)
    expect(JSON.parse(String(mutations()[0][1]?.body))).not.toHaveProperty("overrideStock")
    fireEvent.click(within(confirmation).getByRole("button", { name: "Annuler" }))
    expect(mutations()).toHaveLength(1)
    expect(quantite().value).toBe("6.4")
    expect(notes().value).toBe("Confirmation fictive")
    soumettre()
    confirmation = await screen.findByRole("dialog", { name: "Stock insuffisant" })
    expect(mutations()).toHaveLength(2)
    ecrire.mockImplementation(async () => Response.json({ data: { id: 999 } }, { status: 201 }))
    fireEvent.click(within(confirmation).getByRole("button", { name: "Enregistrer quand même" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(mutations()).toHaveLength(3)
    const methode = edition ? "PATCH" : "POST"
    expect(mutations().map(([, options]) => options?.method)).toEqual([methode, methode, methode])
    const corps = mutations().map(([, options]) => JSON.parse(String(options?.body)))
    if (edition) expect(corps[0].id).toBe(102)
    else expect(corps[0]).not.toHaveProperty("id")
    expect(corps[1]).toEqual(corps[0])
    expect(corps[2]).toEqual({ ...corps[0], overrideStock: true })
    fireEvent.click(screen.getByRole("button", { name: "Saisie rapide" }))
    verifierCreation()
    expect(screen.queryByRole("dialog", { name: "Stock insuffisant" })).toBeNull()
  })
})
