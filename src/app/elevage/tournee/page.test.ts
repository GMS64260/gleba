// @vitest-environment jsdom

import { createElement } from "react"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import TourneePage from "./page"
import type { TacheTournee } from "@/lib/elevage/offline-tournee"

vi.mock("@/components/shell/AppHeader", () => ({ AppHeader: () => null }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { id: "u1" } }, status: "authenticated" }) }))
vi.mock("@/lib/elevage/offline-tournee", () => ({
  ajouterOperation: vi.fn(),
  oublierAutreActeur: vi.fn().mockResolvedValue(undefined),
  lireFile: vi.fn().mockResolvedValue([]),
  lireTachesCachees: vi.fn().mockResolvedValue([]),
  sauverTaches: vi.fn().mockResolvedValue(undefined),
  synchroniserOperations: vi.fn().mockResolvedValue({ envoyees: 0, restantes: 0 }),
}))

const fetchMock = vi.fn<typeof fetch>()
let taches: TacheTournee[] = []
const creations = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")

beforeEach(() => {
  taches = []
  // Radix fait défiler l'option active ; jsdom n'implémente pas cette méthode.
  Element.prototype.scrollIntoView = vi.fn()
  fetchMock.mockReset().mockImplementation(async (url, init) => {
    if (init?.method === "POST") {
      const data = { ...JSON.parse(init.body as string), id: "tache-fictive" }
      taches = [data]
      return Response.json({ data }, { status: 201 })
    }
    if (String(url).startsWith("/api/elevage/tournee?")) return Response.json({ data: taches })
    if (String(url).startsWith("/api/elevage/agenda?")) return Response.json({ echeances: [] })
    if (url === "/api/elevage/lots") return Response.json({ data: [{ id: 41, nom: "Lot fictif" }] })
    if (String(url).startsWith("/api/elevage/animaux?")) return Response.json({ data: [{ id: 42, nom: "Animal fictif", identifiant: "TEST-42" }] })
    if (String(url).startsWith("/api/elevage/scan?")) return Response.json({ data: { id: 42, nom: "Animal fictif", identifiant: "TEST-42", especeAnimale: { nom: "Ovin" } } })
    throw new Error(`Requête inattendue : ${url}`)
  })
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(Element.prototype, "scrollIntoView")
})

async function ouvrir() {
  render(createElement(TourneePage))
  fireEvent.click(screen.getByRole("button", { name: "Nouvelle tâche" }))
  return screen.findByRole("dialog", { name: "Nouvelle tâche terrain" })
}

async function options(nom: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: nom }), { key: "ArrowDown" })
  return within(await screen.findByRole("listbox"))
}

async function choisir(nom: string, valeur: string) {
  const liste = await options(nom)
  fireEvent.click(liste.getByRole("option", { name: valeur }))
}

async function enregistrer(dialogue: HTMLElement) {
  fireEvent.click(within(dialogue).getByRole("button", { name: "Créer" }))
  await waitFor(() => expect(creations()).toHaveLength(1))
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect(creations()[0][0]).toBe("/api/elevage/taches-terrain")
  return JSON.parse(creations()[0][1]!.body as string)
}

describe("Tournée : formulaire accessible et libellés français", () => {
  it("nomme les champs, décrit la récurrence et nomme Lot puis Animal selon la cible", async () => {
    const dialogue = await ouvrir()
    const formulaire = within(dialogue)
    for (const nom of ["Titre", "Description", "Première échéance", "Récurrence en jours"]) {
      expect(formulaire.getByLabelText(nom)).toBeTruthy()
    }
    for (const nom of ["Catégorie", "Priorité", "Cible"]) {
      expect(formulaire.getByRole("combobox", { name: nom })).toBeTruthy()
    }
    const recurrence = formulaire.getByLabelText("Récurrence en jours")
    const aide = formulaire.getByText("Vide = une seule fois")
    expect(aide.id).not.toBe("")
    expect(recurrence.getAttribute("aria-describedby")?.split(" ")).toContain(aide.id)

    await choisir("Cible", "Un lot")
    expect(formulaire.getByRole("combobox", { name: "Lot" })).toBeTruthy()
    await choisir("Lot", "Lot fictif")
    await choisir("Cible", "Un animal")
    expect(formulaire.queryByRole("combobox", { name: "Lot" })).toBeNull()
    expect(formulaire.getByRole("combobox", { name: "Animal" })).toBeTruthy()
    expect((formulaire.getByRole("button", { name: "Créer" }) as HTMLButtonElement).disabled).toBe(true)
    await choisir("Animal", "Animal fictif")
    fireEvent.change(formulaire.getByLabelText("Titre"), { target: { value: "Contrôle fictif" } })
    const corps = await enregistrer(dialogue)
    expect(corps).toMatchObject({ animalId: 42, lotId: null, categorie: "controle", priorite: "normale" })
  })

  it.each([["Pâturage", "paturage"], ["Contrôle", "controle"]])("affiche %s et les priorités françaises sans changer la valeur POST %s", async (libelle, valeur) => {
    const dialogue = await ouvrir()
    const categories = await options("Catégorie")
    expect(categories.getAllByRole("option").map(option => option.textContent)).toEqual([
      "Alimentation", "Traite", "Soin", "Reproduction", "Pâturage", "Contrôle", "Autre",
    ])
    fireEvent.click(categories.getByRole("option", { name: libelle }))
    const priorites = await options("Priorité")
    expect(priorites.getAllByRole("option").map(option => option.textContent)).toEqual(["Basse", "Normale", "Haute", "Urgente"])
    fireEvent.click(priorites.getByRole("option", { name: "Haute" }))
    const formulaire = within(dialogue)
    expect(formulaire.getByRole("combobox", { name: "Cible" }).textContent).toContain("Toute l’exploitation")
    fireEvent.change(formulaire.getByLabelText("Titre"), { target: { value: "Tâche fictive" } })
    fireEvent.change(formulaire.getByLabelText("Récurrence en jours"), { target: { value: "7" } })
    const corps = await enregistrer(dialogue)
    expect(corps).toMatchObject({ categorie: valeur, priorite: "haute", recurrenceJours: 7, animalId: null, lotId: null })
    expect(corps).not.toHaveProperty("cible")
    expect(corps).not.toHaveProperty("cibleId")
    const titre = await screen.findByText("Tâche fictive")
    expect(titre.parentElement?.textContent).toContain(libelle)
    expect(screen.getByText("Haute")).toBeTruthy()
  })

  it("conserve les associations après correction du titre obligatoire et réouverture du formulaire", async () => {
    const dialogue = await ouvrir()
    const formulaire = within(dialogue)
    const titre = formulaire.getByLabelText("Titre") as HTMLInputElement
    const invalide = vi.fn()
    titre.addEventListener("invalid", invalide)
    fireEvent.click(formulaire.getByRole("button", { name: "Créer" }))
    expect(titre.validity.valueMissing).toBe(true)
    expect(invalide).toHaveBeenCalled()
    expect(creations()).toHaveLength(0)
    expect(screen.getByRole("dialog", { name: "Nouvelle tâche terrain" })).toBe(dialogue)

    fireEvent.change(titre, { target: { value: "Contrôle fictif corrigé" } })
    fireEvent.change(formulaire.getByLabelText("Description"), { target: { value: "Description fictive corrigée" } })
    fireEvent.change(formulaire.getByLabelText("Première échéance"), { target: { value: "2026-12-01T09:30" } })
    expect(titre.validity.valid).toBe(true)
    const corps = await enregistrer(dialogue)
    expect(corps).toMatchObject({ titre: "Contrôle fictif corrigé", description: "Description fictive corrigée", prochaineEcheance: "2026-12-01T09:30" })

    fireEvent.click(screen.getByRole("button", { name: "Nouvelle tâche" }))
    const rouvert = within(await screen.findByRole("dialog", { name: "Nouvelle tâche terrain" }))
    expect(rouvert.getByLabelText("Titre").id).toBe(titre.id)
    for (const nom of ["Description", "Première échéance", "Récurrence en jours"]) {
      expect(rouvert.getByLabelText(nom)).toBeTruthy()
    }
    for (const nom of ["Catégorie", "Priorité", "Cible"]) {
      expect(rouvert.getByRole("combobox", { name: nom })).toBeTruthy()
    }
  })

  it("nomme le champ de boucle et le bouton de recherche par scan", async () => {
    render(createElement(TourneePage))
    const champ = screen.getByRole("textbox", { name: "N° de boucle / RFID" })
    expect(screen.getByLabelText("N° de boucle / RFID")).toBe(champ)
    fireEvent.change(champ, { target: { value: "TEST-42" } })
    fireEvent.click(screen.getByRole("button", { name: "Rechercher l’animal" }))
    expect(await screen.findByRole("link", { name: "Animal fictif · Ovin" })).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledWith("/api/elevage/scan?code=TEST-42")
  })
})
