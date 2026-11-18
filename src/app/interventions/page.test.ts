// @vitest-environment jsdom

import { createElement } from "react"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import InterventionsPage from "./page"
import { createInterventionSchema, updateInterventionSchema } from "@/lib/validations/intervention"
import { refusUtilisation } from "@/lib/tracabilite/utilisation-semences"

const { session, toast } = vi.hoisted(() => ({ session: { user: { id: "ferme-fictive" } }, toast: vi.fn() }))
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: session }) }))
vi.mock("@/hooks/use-devise", () => ({ useDevise: () => "EUR" }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }))
vi.mock("@/components/shell/AppHeader", () => ({ AppHeader: () => null }))

const intervention = {
  id: 41, date: "2026-01-02T00:00:00.000Z", type: "semis", fait: false,
  source: "intervention", utilisationPhyto: "semis_semences_traitees",
  produitPhyto: "Produit fictif", substancesActives: "Substance fictive",
  densiteSemis: 12, uniteDensiteSemis: "kg/ha", intrantNumLot: "LOT-D",
  gpsLat: 0, gpsLng: 0, rpgIlot: "0012", rpgParcelle: "003", rpgCommuneInsee: "2A004",
  dureeMinutes: 15, nbPersonnes: 1,
}
let lignes: unknown[] = []
const fetchMock = vi.fn<typeof fetch>()
const mutations = () => fetchMock.mock.calls.filter(([, init]) => ["POST", "PATCH"].includes(init?.method ?? ""))
const corps = () => JSON.parse(mutations().at(-1)![1]!.body as string)

beforeEach(() => {
  lignes = []
  window.history.replaceState(null, "", "/interventions")
  fetchMock.mockReset().mockImplementation(async (url, init) => {
    if (init?.method) return Response.json({ id: 42 })
    if (String(url).startsWith("/api/interventions?")) return Response.json({ data: lignes, stats: null })
    return Response.json({ data: [] })
  })
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

async function ouvrir() {
  render(createElement(InterventionsPage))
  fireEvent.click(screen.getByRole("button", { name: "Nouvelle intervention" }))
  const dialogue = await screen.findByRole("dialog")
  fireEvent.change(within(dialogue).getByLabelText("Type"), { target: { value: "traitement_phyto" } })
  return dialogue
}
function changer(nom: string, valeur: string) {
  const controle = document.getElementsByName(nom)[0]
  expect(controle, nom).toBeDefined()
  fireEvent.change(controle, { target: { value: valeur } })
}
async function enregistrer(dialogue: HTMLElement) {
  fireEvent.submit(dialogue.querySelector("form")!)
  await waitFor(() => expect(mutations().length).toBeGreaterThan(0))
}

describe("Intervention : saisie des semences et plants traités C/D", () => {
  it("choisit C puis D, envoie les deux corps POST conformes au contrat et change le type", async () => {
    let dialogue = await ouvrir()
    changer("utilisationPhyto", "traitement_semences")
    expect(within(dialogue).getByLabelText("Quantité de semences ou plants traitée")).toBeTruthy()
    expect(within(dialogue).queryByLabelText("Densité de semis")).toBeNull()
    expect(within(dialogue).queryByLabelText("Îlot RPG")).toBeNull()
    changer("produitPhyto", "Produit fictif")
    changer("substancesActives", "Substance fictive")
    changer("quantiteSemences", "25.5")
    changer("uniteQuantiteSemences", "kg")
    changer("intrantNumLot", "LOT-C")
    changer("gpsLat", "43.29512")
    changer("gpsLng", "-0.37079")
    changer("dureeMinutes", "15")
    await enregistrer(dialogue)
    expect(mutations()[0][0]).toBe("/api/interventions")
    expect(mutations()[0][1]?.method).toBe("POST")
    const c = createInterventionSchema.parse(corps())
    expect(c).toMatchObject({
      type: "traitement_phyto", utilisationPhyto: "traitement_semences", substancesActives: "Substance fictive",
      quantiteSemences: 25.5, uniteQuantiteSemences: "kg", intrantNumLot: "LOT-C", gpsLat: 43.29512, gpsLng: -0.37079,
      densiteSemis: null, rpgIlot: null,
    })
    expect(refusUtilisation(c.type, c.utilisationPhyto)).toBeNull()
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())

    fireEvent.click(screen.getByRole("button", { name: "Nouvelle intervention" }))
    dialogue = await screen.findByRole("dialog")
    changer("type", "traitement_phyto")
    changer("utilisationPhyto", "traitement_semences")
    changer("quantiteSemences", "99")
    changer("uniteQuantiteSemences", "kg")
    changer("utilisationPhyto", "semis_semences_traitees")
    expect((within(dialogue).getByLabelText("Type") as HTMLSelectElement).value).toBe("semis")
    expect(within(dialogue).queryByLabelText("Quantité de semences ou plants traitée")).toBeNull()
    changer("produitPhyto", "Produit fictif D")
    changer("substancesActives", "Substance fictive D")
    changer("densiteSemis", "12")
    changer("uniteDensiteSemis", "kg/ha")
    changer("intrantNumLot", "LOT-D")
    changer("rpgIlot", "0012")
    changer("rpgParcelle", "003")
    changer("rpgCommuneInsee", "2A004")
    changer("dureeMinutes", "15")
    await enregistrer(dialogue)
    await waitFor(() => expect(mutations()).toHaveLength(2))
    const d = createInterventionSchema.parse(corps())
    expect(d).toMatchObject({
      type: "semis", utilisationPhyto: "semis_semences_traitees", substancesActives: "Substance fictive D",
      densiteSemis: 12, uniteDensiteSemis: "kg/ha", intrantNumLot: "LOT-D",
      rpgIlot: "0012", rpgParcelle: "003", rpgCommuneInsee: "2A004", quantiteSemences: null,
    })
    expect(refusUtilisation(d.type, d.utilisationPhyto)).toBeNull()
  })

  it.each([
    ["utilisationPhyto", "Type d'utilisation"],
    ["quantiteSemences", "Quantité de semences ou plants traitée"],
    ["gpsLat", "Latitude GPS (WGS84)"],
    ["intrantNumLot", "N° de lot des semences ou plants"],
    ["natureProduit", "Nature du produit"],
  ])("affiche le refus 400 sous %s et garde les valeurs saisies", async (champ, libelle) => {
    const dialogue = await ouvrir()
    changer("utilisationPhyto", "traitement_semences")
    changer("intrantNumLot", "LOT-C")
    fetchMock.mockResolvedValueOnce(Response.json({ error: "Valeur refusée pour cette intervention.", champ }, { status: 400 }))
    await enregistrer(dialogue)
    const erreur = await within(dialogue).findByRole("alert")
    const controle = within(dialogue).getByLabelText(libelle)
    expect(erreur.parentElement).toBe(controle.parentElement)
    expect(controle.getAttribute("aria-describedby")).toBe(erreur.id)
    expect(controle.getAttribute("aria-invalid")).toBe("true")
    expect(erreur.textContent).toBe("Valeur refusée pour cette intervention.")
    expect(document.activeElement).toBe(controle)
    expect((within(dialogue).getByLabelText("N° de lot des semences ou plants") as HTMLInputElement).value).toBe("LOT-C")
    changer("utilisationPhyto", "semis_semences_traitees")
    expect(within(dialogue).queryByRole("alert")).toBeNull()
  })

  it("refuse D sans densité puis sans unité sous le champ concerné, sans envoyer de requête", async () => {
    const dialogue = await ouvrir()
    changer("utilisationPhyto", "semis_semences_traitees")
    fireEvent.submit(dialogue.querySelector("form")!)
    let erreur = await within(dialogue).findByRole("alert")
    expect(erreur.textContent).toBe("Renseignez une densité de semis supérieure à zéro.")
    expect(erreur.parentElement).toBe(within(dialogue).getByLabelText("Densité de semis").parentElement)
    expect(mutations()).toHaveLength(0)
    changer("densiteSemis", "12")
    fireEvent.submit(dialogue.querySelector("form")!)
    erreur = await within(dialogue).findByRole("alert")
    expect(erreur.textContent).toBe("Renseignez l’unité de la densité de semis.")
    expect(erreur.parentElement).toBe(within(dialogue).getByLabelText("Unité de la densité de semis").parentElement)
    expect(mutations()).toHaveLength(0)
  })

  it("recharge D en édition et conserve les coordonnées zéro et la référence RPG dans le PATCH", async () => {
    lignes = [intervention]
    render(createElement(InterventionsPage))
    fireEvent.click(await screen.findByTitle("Modifier"))
    const dialogue = await screen.findByRole("dialog")
    expect((within(dialogue).getByLabelText("Type d'utilisation") as HTMLSelectElement).value).toBe("semis_semences_traitees")
    expect((within(dialogue).getByLabelText("Latitude GPS (WGS84)") as HTMLInputElement).value).toBe("0")
    changer("densiteSemis", "15")
    await enregistrer(dialogue)
    expect(mutations()[0][1]?.method).toBe("PATCH")
    expect(updateInterventionSchema.parse(corps())).toMatchObject({
      id: 41, type: "semis", utilisationPhyto: "semis_semences_traitees", densiteSemis: 15,
      uniteDensiteSemis: "kg/ha", substancesActives: "Substance fictive", intrantNumLot: "LOT-D",
      gpsLat: 0, gpsLng: 0, rpgIlot: "0012", rpgParcelle: "003", rpgCommuneInsee: "2A004",
    })
  })

  it.each([false, true])("préserve la substance historique en corrigeant les seules notes d’un traitement de surface (réalisé : %s)", async (fait) => {
    lignes = [{
      ...intervention, type: "traitement_phyto", fait, utilisationPhyto: null,
      substancesActives: "Substance historique saisie", notes: "Note initiale",
      densiteSemis: null, uniteDensiteSemis: null,
    }]
    render(createElement(InterventionsPage))
    fireEvent.click(await screen.findByTitle("Modifier"))
    const dialogue = await screen.findByRole("dialog")
    expect((within(dialogue).getByLabelText("Type d'utilisation") as HTMLSelectElement).value).toBe("")
    expect(within(dialogue).queryByLabelText("Substances actives")).toBeNull()
    changer("notes", "Note corrigée")
    if (fait) {
      fireEvent.change(within(dialogue).getByLabelText("Motif de la rectification *"), { target: { value: "Correction des notes" } })
    }
    await enregistrer(dialogue)
    expect(mutations()[0][1]?.method).toBe("PATCH")
    expect(updateInterventionSchema.parse(corps())).toMatchObject({
      id: 41, type: "traitement_phyto", utilisationPhyto: null, notes: "Note corrigée",
    })
    if (fait) expect(corps().motif).toBe("Correction des notes")
    // Le contrôle masqué ne doit pas écraser la substance conservée par l’API.
    expect(corps()).not.toHaveProperty("substancesActives")
  })

  it("efface les champs C/D du corps si le type devient incompatible et conserve plantation pour D", async () => {
    const dialogue = await ouvrir()
    changer("type", "plantation")
    changer("utilisationPhyto", "semis_semences_traitees")
    expect((within(dialogue).getByLabelText("Type") as HTMLSelectElement).value).toBe("plantation")
    changer("substancesActives", "Substance fictive")
    changer("densiteSemis", "12")
    changer("uniteDensiteSemis", "kg/ha")
    changer("type", "arrosage")
    expect(within(dialogue).queryByLabelText("Type d'utilisation")).toBeNull()
    await enregistrer(dialogue)
    expect(corps()).toMatchObject({ type: "arrosage", utilisationPhyto: null, substancesActives: null, densiteSemis: null, gpsLat: null })
  })
})
