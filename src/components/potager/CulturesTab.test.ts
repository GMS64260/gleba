// @vitest-environment jsdom

import { Fragment, createElement } from "react"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CulturesTab } from "./CulturesTab"
import { Toaster } from "@/components/ui/toaster"

const mocks = vi.hoisted(() => ({ push: vi.fn(), patch: vi.fn() }))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => "/maraichage",
}))
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null, status: "unauthenticated" }) }))
vi.mock("@/hooks/use-acces-service", () => ({ useAccesService: () => ({ acces: { meteo: false } }) }))

const datesPrevues = {
  dateSemis: "2027-10-01T00:00:00.000Z",
  datePlantation: "2027-10-15T00:00:00.000Z",
  dateRecolte: "2027-11-12T00:00:00.000Z",
  finRecolte: "2027-11-30T00:00:00.000Z",
}
const jourReel = "2026-11-15T00:00:00.000Z"
const cultureServeur = {
  id: 63,
  especeId: "laitue-test",
  varieteId: "batavia-test",
  plancheId: "planche-test",
  annee: 2027,
  ...datesPrevues,
  semisFait: false,
  plantationFaite: false,
  recolteFaite: false,
  terminee: null,
  notes: null,
}
const cultureListe = {
  ...cultureServeur,
  etat: "Planifiée",
  type: "legume",
  espece: { id: "laitue-test", nom: "Laitue témoin", famille: null },
  variete: { id: "batavia-test", nom: "Batavia témoin" },
  planche: { id: "planche-test", nom: "Planche témoin" },
  itp: { semainePlantation: 42 },
  _count: { recoltes: 2 },
}

const fetchMock = vi.fn((url: string, options?: RequestInit) => {
  if (/^\/api\/cultures\/\d+$/.test(url) && options?.method === "PATCH") {
    return mocks.patch(options) as Promise<Response>
  }
  if (url === "/api/cultures?page=1&pageSize=50&annee=2027" && !options?.method) {
    return Promise.resolve(Response.json({ data: [cultureListe], totalPages: 1 }))
  }
  throw new Error(`Requête inattendue : ${url}`)
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.patch.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function afficherCulture() {
  render(createElement(Fragment, null, createElement<{ year?: number }>(CulturesTab, { year: 2027 }), createElement(Toaster)))
  const nom = await screen.findByText("Laitue témoin")
  const ligne = nom.closest("tr")
  if (!ligne) throw new Error("Ligne de culture absente")
  return ligne
}

function cellule(ligne: HTMLElement, colonne: string) {
  const index = screen.getAllByRole("columnheader").findIndex((entete) => entete.textContent === colonne)
  if (index < 0) throw new Error(`Colonne absente : ${colonne}`)
  return within(ligne).getAllByRole("cell")[index].textContent
}

function verifierLigne(ligne: HTMLElement, dates: string[], etat: string) {
  expect(["Semis", "Plantation", "Récolte"].map((colonne) => cellule(ligne, colonne))).toEqual(dates)
  expect(cellule(ligne, "État")).toBe(etat)
  expect(cellule(ligne, "Espèce")).toBe("Laitue témoin")
  expect(cellule(ligne, "Variété")).toBe("Batavia témoin")
  expect(cellule(ligne, "Planche")).toBe("Planche témoin")
  expect(cellule(ligne, "Récoltes")).toBe("2")
}

function reponseDifferee() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((resoudre) => { resolve = resoudre })
  return { promise, resolve }
}

describe("CulturesTab : dates des actions rapides", () => {
  it("affiche immédiatement les dates du serveur après le semis, la plantation et la récolte", async () => {
    const ligne = await afficherCulture()
    verifierLigne(ligne, ["01/10", "15/10", "12/11"], "Planifiée")
    const semee = { ...cultureServeur, semisFait: true, dateSemis: jourReel }
    const plantee = { ...semee, plantationFaite: true, datePlantation: jourReel }
    const recoltee = { ...plantee, recolteFaite: true, dateRecolte: jourReel, finRecolte: "2026-12-03T00:00:00.000Z" }
    mocks.patch
      .mockResolvedValueOnce(Response.json(semee))
      .mockResolvedValueOnce(Response.json(plantee))
      .mockResolvedValueOnce(Response.json(recoltee))

    fireEvent.click(within(ligne).getByRole("button", { name: "Marquer le semis fait" }))
    await waitFor(() => verifierLigne(ligne, ["15/11", "15/10", "12/11"], "Semée"))
    fireEvent.click(within(ligne).getByRole("button", { name: "Marquer la plantation faite" }))
    await waitFor(() => verifierLigne(ligne, ["15/11", "15/11", "12/11"], "Plantée"))
    fireEvent.click(within(ligne).getByRole("button", { name: "Marquer la récolte faite" }))
    await waitFor(() => verifierLigne(ligne, ["15/11", "15/11", "15/11"], "En récolte"))

    expect(mocks.patch.mock.calls.map(([options]) => JSON.parse(options.body))).toEqual([
      { semisFait: true }, { plantationFaite: true }, { recolteFaite: true },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(4) // Un GET initial, trois PATCH, aucun rechargement.
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it("sérialise les clics rapprochés même avant le rendu React et empêche les réponses inversées", async () => {
    const ligne = await afficherCulture()
    const semis = reponseDifferee()
    const plantation = reponseDifferee()
    const semee = { ...cultureServeur, semisFait: true, dateSemis: jourReel }
    const plantee = { ...semee, plantationFaite: true, datePlantation: jourReel }
    mocks.patch.mockReturnValueOnce(semis.promise).mockReturnValueOnce(plantation.promise)
    const boutonSemis = within(ligne).getByRole("button", { name: "Marquer le semis fait" })
    const boutonPlantation = within(ligne).getByRole("button", { name: "Marquer la plantation faite" })

    // Même lot React : les boutons ne sont pas encore rendus désactivés.
    act(() => {
      fireEvent.click(boutonSemis)
      fireEvent.click(boutonPlantation)
      fireEvent.click(boutonSemis)
    })
    expect(mocks.patch).toHaveBeenCalledTimes(1)
    for (const nom of ["Marquer le semis fait", "Marquer la plantation faite", "Marquer la récolte faite", "Reporter le semis…"]) {
      expect((within(ligne).getByRole("button", { name: nom }) as HTMLButtonElement).disabled).toBe(true)
    }

    // Le transport propose la réponse plantation avant celle du semis.
    // Elle ne peut être consommée : ce deuxième PATCH n'est pas encore parti.
    await act(async () => { plantation.resolve(Response.json(plantee)) })
    verifierLigne(ligne, ["01/10", "15/10", "12/11"], "Planifiée")
    await act(async () => { semis.resolve(Response.json(semee)) })
    verifierLigne(ligne, ["15/11", "15/10", "12/11"], "Semée")
    expect((within(ligne).getByRole("button", { name: "Marquer la plantation faite" }) as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(within(ligne).getByRole("button", { name: "Marquer la plantation faite" }))
    await waitFor(() => verifierLigne(ligne, ["15/11", "15/11", "12/11"], "Plantée"))
    expect(mocks.patch.mock.calls.map(([options]) => JSON.parse(options.body))).toEqual([
      { semisFait: true }, { plantationFaite: true },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("laisse les actions d'une autre culture disponibles pendant un PATCH lent", async () => {
    const autreCulture = { ...cultureListe, id: 64, espece: { ...cultureListe.espece, nom: "Autre laitue témoin" } }
    fetchMock.mockResolvedValueOnce(Response.json({ data: [cultureListe, autreCulture], totalPages: 1 }))
    const ligne = await afficherCulture()
    const autreLigne = screen.getByText("Autre laitue témoin").closest("tr")!
    const semis = reponseDifferee()
    mocks.patch
      .mockReturnValueOnce(semis.promise)
      .mockResolvedValueOnce(Response.json({ ...cultureServeur, id: 64, semisFait: true, dateSemis: jourReel }))

    fireEvent.click(within(ligne).getByRole("button", { name: "Marquer le semis fait" }))
    const autreBouton = within(autreLigne).getByRole("button", { name: "Marquer le semis fait" }) as HTMLButtonElement
    expect(autreBouton.disabled).toBe(false)
    fireEvent.click(autreBouton)
    await waitFor(() => expect(cellule(autreLigne, "Semis")).toBe("15/11"))
    expect(cellule(ligne, "Semis")).toBe("01/10")
    expect(mocks.patch).toHaveBeenCalledTimes(2)

    await act(async () => { semis.resolve(Response.json({ ...cultureServeur, semisFait: true, dateSemis: jourReel })) })
    verifierLigne(ligne, ["15/11", "15/10", "12/11"], "Semée")
    expect(cellule(autreLigne, "Semis")).toBe("15/11")
  })

  it("conserve la ligne et ses dates et affiche le message du serveur après un refus 409", async () => {
    const ligne = await afficherCulture()
    const avant = ligne.textContent
    const message = "Impossible de modifier le semis : des récoltes sont déjà enregistrées."
    mocks.patch.mockResolvedValueOnce(Response.json({ error: message }, { status: 409 }))

    fireEvent.click(within(ligne).getByRole("button", { name: "Marquer le semis fait" }))

    expect(await screen.findByText(message)).toBeTruthy()
    expect(screen.getByText("Changement refusé")).toBeTruthy()
    expect(ligne.textContent).toBe(avant)
    verifierLigne(ligne, ["01/10", "15/10", "12/11"], "Planifiée")
    const bouton = within(ligne).getByRole("button", { name: "Marquer le semis fait" }) as HTMLButtonElement
    expect(bouton.disabled).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    mocks.patch.mockResolvedValueOnce(Response.json({ ...cultureServeur, semisFait: true, dateSemis: jourReel }))
    fireEvent.click(bouton)
    await waitFor(() => verifierLigne(ligne, ["15/11", "15/10", "12/11"], "Semée"))
    expect(mocks.patch).toHaveBeenCalledTimes(2)
  })

  it("réaffiche la date prévue renvoyée par le serveur après une annulation confirmée", async () => {
    const ligne = await afficherCulture()
    mocks.patch
      .mockResolvedValueOnce(Response.json({ ...cultureServeur, semisFait: true, dateSemis: jourReel }))
      .mockResolvedValueOnce(Response.json(cultureServeur))
    fireEvent.click(within(ligne).getByRole("button", { name: "Marquer le semis fait" }))
    await waitFor(() => verifierLigne(ligne, ["15/11", "15/10", "12/11"], "Semée"))

    fireEvent.click(within(ligne).getByRole("button", { name: "Annuler le semis" }))
    const confirmation = await screen.findByRole("dialog", { name: "Annuler cette étape ?" })
    expect(confirmation.textContent).toContain("2 récoltes enregistrées")
    expect(mocks.patch).toHaveBeenCalledTimes(1)
    fireEvent.click(within(confirmation).getByRole("button", { name: "Annuler l'étape" }))

    await waitFor(() => verifierLigne(ligne, ["01/10", "15/10", "12/11"], "Planifiée"))
    expect(JSON.parse(mocks.patch.mock.calls[1][0].body)).toEqual({ semisFait: false })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
