import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  exploitation: vi.fn(),
  naissances: vi.fn(),
  animaux: vi.fn(),
  lots: vi.fn(),
  abattages: vi.fn(),
  suivis: vi.fn(),
  effectifs: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    exploitation: { findUnique: mocks.exploitation },
    naissanceAnimale: { findMany: mocks.naissances },
    animal: { findMany: mocks.animaux },
    lotAnimaux: { findMany: mocks.lots },
    abattage: { findMany: mocks.abattages },
    declarationReglementaireSuivi: { findMany: mocks.suivis },
  },
}))
vi.mock("@/lib/elevage/effectif", () => ({ reconstituerEffectifsLots: mocks.effectifs }))

import { chargerDeclarationsReglementaires } from "./declarations-reglementaires.server"

const caprin = { nom: "Chèvre", filiere: "rente", categorieReglementaire: "Caprin" }
const maintenant = new Date("2026-09-25T12:00:00Z")

const lot = (over: Record<string, unknown> = {}) => ({
  id: 77,
  nom: "naissance 2024",
  dateArrivee: null,
  dateReforme: new Date("2026-06-01T00:00:00Z"),
  quantiteInitiale: 12,
  quantiteActuelle: 12,
  provenance: "Naissance",
  statut: "reforme",
  nExploitationDestination: null,
  especeAnimale: caprin,
  naissances: [],
  ...over,
})

const charger = () => chargerDeclarationsReglementaires("user-1", { year: 2026, maintenant })

describe("déclarations réglementaires : toute anomalie a un champ pour la corriger", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.exploitation.mockResolvedValue({ raisonSociale: "Ferme", numeroEde: "46100123" })
    mocks.naissances.mockResolvedValue([])
    mocks.animaux.mockResolvedValue([])
    mocks.lots.mockResolvedValue([])
    mocks.abattages.mockResolvedValue([])
    mocks.suivis.mockResolvedValue([])
    mocks.effectifs.mockResolvedValue(new Map())
  })

  it("ne déclare pas la réforme d'un lot dont toutes les têtes ont déjà un mouvement", async () => {
    mocks.lots.mockResolvedValue([lot()])
    mocks.effectifs.mockResolvedValue(new Map([[77, { effectifCalcule: 0 }]]))

    const { declarations } = await charger()

    expect(declarations).toEqual([])
  })

  it("déclare les têtes restantes et lève l'anomalie dès que la destination est saisie", async () => {
    mocks.effectifs.mockResolvedValue(new Map([[77, { effectifCalcule: 3 }]]))

    mocks.lots.mockResolvedValue([lot()])
    const sansDestination = (await charger()).declarations[0]
    expect(sansDestination.quantite).toBe(3)
    expect(sansDestination.anomalies).toEqual(["Exploitation ou établissement de destination manquant"])
    expect(sansDestination.sourceUrl).toBe("/elevage?tab=animaux&sub=lots&editLot=77")

    mocks.lots.mockResolvedValue([lot({ nExploitationDestination: "FR46200999" })])
    const avecDestination = (await charger()).declarations[0]
    expect(avecDestination.anomalies).toEqual([])
    expect(avecDestination.destination).toBe("FR46200999")
  })

  it("lit le n° d'abattoir d'un abattage de lot au lieu d'une anomalie permanente", async () => {
    const abattage = {
      id: 31,
      date: new Date("2026-08-04T00:00:00Z"),
      quantite: 2,
      lieu: "Laroquebrou",
      destination: "vente",
      nEtablissementDestination: null as string | null,
      lot: { id: 79, nom: "Naissance 2026", especeAnimale: caprin },
    }
    mocks.abattages.mockResolvedValue([abattage])
    const avant = (await charger()).declarations[0]
    expect(avant.anomalies).toEqual(["Numéro de l’abattoir ou de l’établissement destinataire manquant"])
    expect(avant.sourceUrl).toBe("/elevage?tab=production&editAbattage=31")

    mocks.abattages.mockResolvedValue([{ ...abattage, nEtablissementDestination: "15.108.001" }])
    const apres = (await charger()).declarations[0]
    expect(apres.anomalies).toEqual([])
    expect(apres.destination).toBe("15.108.001")
  })

  it("dit qu'une fiche active porte une date de sortie au lieu de réclamer une destination seule", async () => {
    mocks.animaux.mockResolvedValue([{
      id: 410,
      identifiant: "FR461001234",
      nom: "Chèvre accidentée",
      statut: "actif",
      dateNaissance: null,
      dateArrivee: null,
      dateSortie: new Date("2026-03-15T00:00:00Z"),
      provenance: null,
      nExploitationOrigine: null,
      nExploitationDestination: null,
      motifSortie: null,
      causeSortie: "Accident",
      ficheNaissance: null,
      especeAnimale: caprin,
    }])

    const [declaration] = (await charger()).declarations

    expect(declaration.anomalies[0]).toContain("Fiche encore « active » avec une date de sortie")
    expect(declaration.statut).toBe("HORS_DELAI")
  })
})
