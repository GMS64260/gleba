// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
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
    periode: { mode: "fenetre", start: "2026-05-23", end: "2026-11-19" },
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
  window.history.replaceState(null, "", "/elevage?sub=qualite")
  window.localStorage.clear()
  fetchMock.mockReset().mockImplementation(async (url) => {
    const params = new URL(String(url), "http://localhost").searchParams
    const json = await reponse("Analyse courante").json()
    if (params.has("start")) json.troupeau.periode = { mode: "periode", start: params.get("start"), end: params.get("end") }
    return Response.json(json)
  })
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
      .toEqual([["90", "90 jours"], ["180", "180 jours"], ["365", "1 an"],
        ["exercice", `Exercice ${new Date().getFullYear()}`], ["personnalisee", "Période personnalisée"]])
    for (const fenetre of ["90", "365", "180"]) {
      fireEvent.change(periode(), { target: { value: fenetre } })
      await screen.findByText("Analyse courante")
      expect(fetchMock.mock.lastCall?.[0]).toBe(`/api/elevage/qualite-lait?fenetre=${fenetre}`)
    }
    expect(fetchMock.mock.calls.every(([, options]) => !options?.method || options.method === "GET")).toBe(true)
  })

  it("une période de plus de deux ans affiche toutes les cibles sorties et les moyennes de la réponse", async () => {
    render(createElement(LaitSubTab, { year: 2024 }))
    await screen.findByText("Analyse courante")
    fireEvent.change(periode(), { target: { value: "personnalisee" } })
    fireEvent.change(screen.getByLabelText("Début des analyses"), { target: { value: "2020-01-01" } })
    const historique = await reponse().json()
    historique.troupeau.periode = { mode: "periode", start: "2020-01-01", end: "2023-12-31" }
    historique.troupeau.cellulesMoyennes = 237
    historique.troupeau.tbMoyen = 42.7
    historique.troupeau.tpMoyen = 31.4
    historique.data = [
      { ...analyse("Laitière sortie"), derniere: { date: "2020-06-10T12:00:00Z", cellules: 120, mg: 41, mp: 30 }, moyenneCellules: 123 },
      { ...analyse("Lot clos"), type: "lot", id: 8, derniere: { date: "2023-11-30T12:00:00Z", cellules: 340, mg: 43, mp: 33 }, moyenneCellules: 351 },
    ]
    fetchMock.mockResolvedValueOnce(Response.json(historique))
    fireEvent.change(screen.getByLabelText("Fin des analyses"), { target: { value: "2023-12-31" } })
    await screen.findByText("Laitière sortie")
    expect(fetchMock.mock.lastCall?.[0]).toBe("/api/elevage/qualite-lait?start=2020-01-01&end=2023-12-31")
    expect(screen.getByText("Lot clos")).toBeTruthy()
    expect(screen.getByText("237 k/mL")).toBeTruthy()
    expect(screen.getByText(/42.7/)).toBeTruthy()
    expect(screen.getByText(/31.4/)).toBeTruthy()
    expect(within(screen.getByText("Laitière sortie").closest("tr")!).getByText("123 k/mL")).toBeTruthy()
    expect(within(screen.getByText("Lot clos").closest("tr")!).getByText("351 k/mL")).toBeTruthy()
    expect(screen.getByText(/Période personnalisée : du 01\/01\/2020 au 31\/12\/2023 inclus/)).toBeTruthy()
    expect(new URLSearchParams(window.location.search).get("qualiteStart")).toBe("2020-01-01")
  })

  it("utilise uniquement l’exercice du module et suit son changement sans revenir à aujourd’hui", async () => {
    const vue = render(createElement(LaitSubTab, { year: 2021 }))
    await screen.findByText("Analyse courante")
    fireEvent.change(periode(), { target: { value: "exercice" } })
    await screen.findByText("Analyse courante")
    expect(fetchMock.mock.lastCall?.[0]).toBe("/api/elevage/qualite-lait?start=2021-01-01&end=2021-12-31")
    vue.rerender(createElement(LaitSubTab, { year: 2022 }))
    await screen.findByText("Analyse courante")
    expect(fetchMock.mock.lastCall?.[0]).toBe("/api/elevage/qualite-lait?start=2022-01-01&end=2022-12-31")
    expect((periode() as HTMLSelectElement).value).toBe("exercice")
    expect(screen.getByText(/Exercice 2022 : du 01\/01\/2022 au 31\/12\/2022 inclus/)).toBeTruthy()
  })

  it("affiche une borne de fin seule sans inventer ni formater une date de début", async () => {
    const historique = await reponse("Analyse historique").json()
    historique.troupeau.periode = { mode: "periode", start: null, end: "2020-12-31" }
    historique.troupeau.fenetreJours = null
    fetchMock.mockResolvedValueOnce(Response.json(historique))
    render(createElement(LaitSubTab))
    await screen.findByText("Analyse historique")
    expect(screen.getByText(/jusqu’au 31\/12\/2020 inclus/)).toBeTruthy()
    expect(screen.queryByText(/01\/01\/1970|Invalid Date/)).toBeNull()
  })

  it("restaure la période personnalisée, puis le retour à 180 jours après remontage", async () => {
    window.history.replaceState(null, "", "/elevage?sub=qualite&qualitePeriode=personnalisee&qualiteStart=2019-04-01&qualiteEnd=2022-03-31")
    const vue = render(createElement(LaitSubTab, { year: 2023 }))
    await screen.findByText("Analyse courante")
    expect(fetchMock.mock.lastCall?.[0]).toBe("/api/elevage/qualite-lait?start=2019-04-01&end=2022-03-31")
    expect((screen.getByLabelText("Début des analyses") as HTMLInputElement).value).toBe("2019-04-01")
    fireEvent.change(periode(), { target: { value: "180" } })
    await screen.findByText("Analyse courante")
    expect(screen.getByText(/Fenêtre glissante de 180 jours : du 23\/05\/2026 au 19\/11\/2026 inclus/)).toBeTruthy()
    expect(new URLSearchParams(window.location.search).has("qualiteStart")).toBe(false)
    vue.unmount()
    render(createElement(LaitSubTab, { year: 2023 }))
    await screen.findByText("Analyse courante")
    expect((periode() as HTMLSelectElement).value).toBe("180")
    expect(fetchMock.mock.lastCall?.[0]).toBe("/api/elevage/qualite-lait?fenetre=180")
  })

  it("une période inversée n’émet aucune lecture ; un refus 400 nomme le champ et reste distinct du vide", async () => {
    render(createElement(LaitSubTab, { year: 2021 }))
    await screen.findByText("Analyse courante")
    fireEvent.change(periode(), { target: { value: "personnalisee" } })
    await screen.findByText("Analyse courante")
    const appels = fetchMock.mock.calls.length
    fireEvent.change(screen.getByLabelText("Début des analyses"), { target: { value: "2022-01-01" } })
    expect(fetchMock).toHaveBeenCalledTimes(appels)
    expect(screen.getByRole("alert").textContent).toContain("ordre chronologique")
    expect(screen.queryByText("Analyse courante")).toBeNull()
    fetchMock.mockResolvedValueOnce(Response.json({ error: "La date est invalide", champ: "end" }, { status: 400 }))
    fireEvent.change(screen.getByLabelText("Fin des analyses"), { target: { value: "2022-12-31" } })
    expect((await screen.findByRole("alert")).textContent).toContain("Fin : La date est invalide")
    expect(screen.queryByText(/Aucune analyse de lait/)).toBeNull()
  })

  it("une réponse de l’exercice ancien ne remplace pas la fenêtre glissante ni ses bornes", async () => {
    const ancienne = differee<Response>()
    render(createElement(LaitSubTab, { year: 2021 }))
    await screen.findByText("Analyse courante")
    fetchMock.mockReturnValueOnce(ancienne.promise)
    fireEvent.change(periode(), { target: { value: "exercice" } })
    const signal = fetchMock.mock.lastCall?.[1]?.signal
    fireEvent.change(periode(), { target: { value: "90" } })
    expect(signal?.aborted).toBe(true)
    await screen.findByText("Analyse courante")
    await act(async () => ancienne.resolve(reponse("Ancien exercice")))
    expect(screen.queryByText("Ancien exercice")).toBeNull()
    expect(screen.getByText(/Fenêtre glissante de 90 jours/)).toBeTruthy()
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

  it.each(["180", "personnalisee"])("annule la lecture et efface les données au changement d’exploitation sans remontage (%s)", async (mode) => {
    if (mode === "personnalisee") window.history.replaceState(null, "", "/elevage?sub=qualite&qualitePeriode=personnalisee&qualiteStart=2020-01-01&qualiteEnd=2023-12-31")
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
