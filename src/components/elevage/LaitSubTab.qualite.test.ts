// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("sub=qualite"),
  usePathname: () => "/elevage",
}))
vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: "authenticated", data: { user: { id: "acteur-fictif" } } }),
}))

import { LaitSubTab } from "./LaitSubTab"

const fetchMock = vi.fn<typeof fetch>()
const analyse = (nom: string) => ({
  type: "animal", id: 1, nom, identifiant: null, espece: "Bovine", categorie: "bovin",
  seuils: { surveillance: 200, alerte: 400 },
  derniere: { date: "2026-11-01T12:00:00Z", cellules: 100, mg: 40, mp: 32 },
  moyenneCellules: 100, moyenneMg: 40, moyenneMp: 32, nbMesures: 1,
  tendance: "stable", statut: "ok",
})
const reponse = (nom?: string) => Response.json({
  data: nom ? [analyse(nom)] : [],
  troupeau: {
    fenetreJours: 180, nbSuivis: nom ? 1 : 0, nbAvecMesure: nom ? 1 : 0, nbSansMesure: 0,
    cellulesMoyennes: nom ? 100 : null, tbMoyen: nom ? 40 : null, tpMoyen: nom ? 32 : null,
    nbAlerte: 0, nbSurveillance: 0,
  },
})
function differee<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
const periode = () => screen.getByRole("combobox", { name: "Période des analyses" })
const changerExploitation = () => act(() => {
  window.dispatchEvent(new Event("gleba:exploitation-changee"))
})

beforeEach(() => {
  window.localStorage.clear()
  fetchMock.mockReset().mockImplementation(async () => reponse("Analyse courante"))
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe("Qualité du lait : chargement, erreurs et absence d’analyses", () => {
  it("distingue le chargement d’une réponse 200 vide", async () => {
    const attente = differee<Response>()
    fetchMock.mockReturnValueOnce(attente.promise)
    render(createElement(LaitSubTab))
    expect(screen.getByRole("status").textContent).toContain("Chargement")
    expect(screen.queryByText(/Aucune analyse de lait/)).toBeNull()
    expect(screen.queryByRole("alert")).toBeNull()
    await act(async () => attente.resolve(reponse()))
    expect(screen.getByText(/Aucune analyse de lait/)).toBeTruthy()
    expect(screen.queryByRole("status")).toBeNull()
    expect(screen.queryByRole("button", { name: "Réessayer" })).toBeNull()
  })

  it.each(["HTTP 500", "HTTP 403", "JSON invalide", "rejet réseau", "réponse sans données"])(
    "%s : affiche une erreur puis Réessayer remplace l’erreur par les analyses", async (cas) => {
      if (cas === "HTTP 500" || cas === "HTTP 403") {
        fetchMock.mockResolvedValueOnce(Response.json({ error: "Refus fictif" }, { status: cas === "HTTP 500" ? 500 : 403 }))
      } else if (cas === "JSON invalide") {
        fetchMock.mockResolvedValueOnce(new Response("<html>Erreur</html>"))
      } else if (cas === "réponse sans données") {
        fetchMock.mockResolvedValueOnce(Response.json({ error: "Réponse inattendue" }))
      } else {
        fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"))
      }
      render(createElement(LaitSubTab))
      expect((await screen.findByRole("alert")).textContent).toContain("Impossible de charger")
      expect(screen.queryByText(/Aucune analyse de lait/)).toBeNull()
      expect(screen.queryByRole("status")).toBeNull()

      const tentative = differee<Response>()
      fetchMock.mockReturnValueOnce(tentative.promise)
      fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
      expect(screen.getByRole("status")).toBeTruthy()
      expect(screen.queryByRole("alert")).toBeNull()
      await act(async () => tentative.resolve(reponse("Analyse après réessai")))
      expect(screen.getByText("Analyse après réessai")).toBeTruthy()
      expect(screen.queryByRole("alert")).toBeNull()
      expect(screen.queryByText(/Aucune analyse de lait/)).toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
        "/api/elevage/qualite-lait?fenetre=180", "/api/elevage/qualite-lait?fenetre=180",
      ])
    },
  )

  it("nomme le sélecteur, conserve les trois fenêtres et ne fait que des lectures", async () => {
    render(createElement(LaitSubTab))
    await screen.findByText("Analyse courante")
    expect(Array.from((periode() as HTMLSelectElement).options).map((option) => [option.value, option.text]))
      .toEqual([["90", "90 jours"], ["180", "180 jours"], ["365", "1 an"]])
    for (const fenetre of ["90", "365"]) {
      fireEvent.change(periode(), { target: { value: fenetre } })
      await screen.findByText("Analyse courante")
      expect(fetchMock.mock.lastCall?.[0]).toBe(`/api/elevage/qualite-lait?fenetre=${fenetre}`)
    }
    expect(fetchMock.mock.calls.every(([, options]) => !options?.method || options.method === "GET")).toBe(true)
  })

  it.each(["succès", "échec HTTP", "rejet réseau"])(
    "ignore le %s tardif de la fenêtre précédente, même si fetch ignore l’annulation", async (issue) => {
      const ancienne = differee<Response>()
      const courante = differee<Response>()
      fetchMock.mockReturnValueOnce(ancienne.promise).mockReturnValueOnce(courante.promise)
      render(createElement(LaitSubTab))
      const signal = fetchMock.mock.calls[0][1]?.signal
      fireEvent.change(periode(), { target: { value: "90" } })
      expect(signal?.aborted).toBe(true)
      expect(screen.getByRole("status")).toBeTruthy()
      await act(async () => {
        if (issue === "rejet réseau") ancienne.reject(new TypeError("Failed to fetch"))
        else ancienne.resolve(issue === "succès" ? reponse("Ancienne fenêtre") : new Response("Erreur", { status: 500 }))
      })
      expect(screen.getByRole("status")).toBeTruthy()
      expect(screen.queryByText("Ancienne fenêtre")).toBeNull()
      expect(screen.queryByRole("alert")).toBeNull()
      await act(async () => courante.resolve(reponse("Fenêtre courante")))
      expect(screen.getByText("Fenêtre courante")).toBeTruthy()
    },
  )

  it("ignore aussi un ancien corps JSON qui se termine après le succès courant", async () => {
    const corps = differee<unknown>()
    const ancienne = reponse("Ancienne analyse")
    vi.spyOn(ancienne, "json").mockReturnValue(corps.promise)
    fetchMock.mockResolvedValueOnce(ancienne)
    render(createElement(LaitSubTab))
    await act(async () => {})
    fireEvent.change(periode(), { target: { value: "365" } })
    await screen.findByText("Analyse courante")
    await act(async () => corps.resolve(await reponse("Ancienne analyse").json()))
    expect(screen.queryByText("Ancienne analyse")).toBeNull()
    expect(screen.getByText("Analyse courante")).toBeTruthy()
  })

  it("efface les analyses et la synthèse précédentes pendant le chargement puis en erreur", async () => {
    render(createElement(LaitSubTab))
    await screen.findByText("Analyse courante")
    const attente = differee<Response>()
    fetchMock.mockReturnValueOnce(attente.promise)
    fireEvent.change(periode(), { target: { value: "90" } })
    expect(screen.queryByText("Analyse courante")).toBeNull()
    expect(screen.queryByText("Cellules moyennes")).toBeNull()
    await act(async () => attente.resolve(Response.json({ error: "Erreur" }, { status: 500 })))
    expect(screen.getByRole("alert")).toBeTruthy()
    expect(screen.queryByText("Cellules moyennes")).toBeNull()
    expect(screen.queryByText(/Aucune analyse de lait/)).toBeNull()
  })

  it("annule la lecture et efface les données au changement d’exploitation sans remontage", async () => {
    const ancienne = differee<Response>()
    fetchMock.mockReturnValueOnce(ancienne.promise)
    render(createElement(LaitSubTab))
    const signal = fetchMock.mock.calls[0][1]?.signal
    changerExploitation()
    expect(signal?.aborted).toBe(true)
    await screen.findByText("Analyse courante")
    await act(async () => ancienne.resolve(reponse("Analyse ancienne exploitation")))
    expect(screen.queryByText("Analyse ancienne exploitation")).toBeNull()
    const nouvelle = differee<Response>()
    fetchMock.mockReturnValueOnce(nouvelle.promise)
    changerExploitation()
    expect(screen.queryByText("Analyse courante")).toBeNull()
    expect(screen.queryByText("Cellules moyennes")).toBeNull()
    expect(screen.getByRole("status")).toBeTruthy()
    await act(async () => nouvelle.resolve(reponse("Nouvelle exploitation")))
    expect(screen.getByText("Nouvelle exploitation")).toBeTruthy()
  })

  it("annule au démontage et retire l’écouteur ; une ancienne lecture ne pollue pas le remontage", async () => {
    const ancienne = differee<Response>()
    fetchMock.mockReturnValueOnce(ancienne.promise)
    const vue = render(createElement(LaitSubTab))
    const signal = fetchMock.mock.calls[0][1]?.signal
    vue.unmount()
    expect(signal?.aborted).toBe(true)
    changerExploitation()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    render(createElement(LaitSubTab))
    await screen.findByText("Analyse courante")
    await act(async () => ancienne.resolve(reponse("Analyse démontée")))
    expect(screen.queryByText("Analyse démontée")).toBeNull()
    expect(screen.getByText("Analyse courante")).toBeTruthy()
  })
})
