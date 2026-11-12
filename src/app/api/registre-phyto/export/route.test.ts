/**
 * Export du registre phytosanitaire, revue de conformité du 2026-11-12
 * (arrêté du 24 décembre 2025 relatif aux registres d'utilisation des
 * produits phytopharmaceutiques) :
 *  - C2 : mentions de l'annexe I (SIRET, culture, localisation GPS, conduite
 *    biologique, stade, horaires, lot), date JJ/MM/AAAA, dose et unité ;
 *  - C4 : ce qui a été enregistré prime sur le référentiel actuel ;
 *  - C3 : les rectifications de la période sont exportées ;
 *  - cellules neutralisées contre l'exécution de formules dans un tableur.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  interventionFindMany: vi.fn(),
  observationFindMany: vi.fn(),
  operationFindMany: vi.fn(),
  historiqueFindMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: async () => ({ name: "Exploitant", email: "e@example.com", certiphytoNum: null, certiphytoValidite: null }) },
    exploitation: {
      findUnique: async () => ({
        raisonSociale: "Ferme d'essai",
        territoire: null,
        siret: "12345678900011",
        identifiantLegal: null,
        adresseSiege: "1 chemin",
        codePostal: "64000",
        ville: "Pau",
        certifBioOrganisme: null,
      }),
    },
    intervention: { findMany: mocks.interventionFindMany },
    observationSante: { findMany: mocks.observationFindMany },
    operationArbre: { findMany: mocks.operationFindMany },
    culture: { findMany: async () => [], findFirst: async () => null },
    planche: { findMany: async () => [], findFirst: async () => null },
    arbre: { findMany: async () => [], findFirst: async () => null },
    parcelleGeo: { findFirst: async () => null },
    registrePhytoHistorique: { findMany: mocks.historiqueFindMany },
  },
}))

import { GET } from "./route"

const intervention = (o: Record<string, unknown> = {}) => ({
  id: 1,
  date: new Date("2026-05-04T00:00:00.000Z"),
  cultureId: null,
  plancheId: null,
  arbreId: null,
  parcelleId: null,
  parcelle: null,
  produitPhyto: "Produit A",
  produitPhytoRef: null,
  numAMM: "2100123",
  cibleTraitement: "Mildiou",
  doseAppliquee: 1.5,
  uniteDose: "L/ha",
  surfaceTraitee: 500,
  surfaceTraiteeHa: null,
  volumeBouillieLHa: null,
  volumeBouillieLTotal: null,
  dar: 7,
  temperatureC: null,
  ventKmh: null,
  hygrometriePct: null,
  pluie24h: null,
  pluie24hMm: null,
  epiPortes: [],
  zntRespectee: null,
  zntDistanceM: null,
  certiphytoNum: null,
  certiphytoValidite: null,
  justification: null,
  intrantNumLot: "LOT-7",
  notes: null,
  operateur: null,
  user: { name: "Exploitant", email: "e@example.com" },
  stadeBBCH: "65",
  heureDebut: "06:30",
  heureFin: "07:15",
  rentreeAnticipee: null,
  siretBeneficiaire: null,
  cultureRegistre: "Tomate (Cœur de bœuf)",
  localisationRegistre: "Planche P3 · GPS 43.2951234, -0.3707890 (WGS84)",
  conduiteBio: true,
  ...o,
})

const exporter = async () => {
  const res = await GET(
    new NextRequest("http://localhost/api/registre-phyto/export?from=2026-01-01&to=2026-12-31&format=csv"),
  )
  expect(res.status).toBe(200)
  const lignes = (await res.text()).split("\r\n")
  const iEntete = lignes.findIndex((l) => l.startsWith("Date;"))
  const entete = lignes[iEntete].split(";")
  const valeur = (ligne: string, colonne: string) => ligne.split(";")[entete.indexOf(colonne)]
  return { lignes, iEntete, entete, valeur }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "u1" } } })
  mocks.interventionFindMany.mockResolvedValue([intervention()])
  mocks.observationFindMany.mockResolvedValue([])
  mocks.operationFindMany.mockResolvedValue([])
  mocks.historiqueFindMany.mockResolvedValue([])
})

describe("export CSV du registre phytosanitaire", () => {
  it("restitue les mentions de l'annexe I, date JJ/MM/AAAA, dose et unité séparées", async () => {
    const { lignes, iEntete, valeur } = await exporter()
    const ligne = lignes[iEntete + 1]
    expect(valeur(ligne, "Date")).toBe('"04/05/2026"')
    expect(valeur(ligne, "SIRET détenteur")).toBe('"12345678900011"')
    expect(valeur(ligne, "Culture")).toBe('"Tomate (Cœur de bœuf)"')
    expect(valeur(ligne, "Localisation (GPS WGS84)")).toContain("43.2951234")
    expect(valeur(ligne, "Conduite biologique")).toBe('"Oui"')
    expect(valeur(ligne, "Stade BBCH")).toBe('"65"')
    expect(valeur(ligne, "Horaire début")).toBe('"06:30"')
    expect(valeur(ligne, "N° lot")).toBe('"LOT-7"')
    expect(valeur(ligne, "Dose (valeur)")).toBe("1.5")
    expect(valeur(ligne, "Unité de dose")).toBe('"L/ha"')
  })

  it("le nom et l'AMM enregistrés priment sur le référentiel actuel (C4)", async () => {
    mocks.interventionFindMany.mockResolvedValue([
      intervention({
        produitPhytoRef: { nomCommercial: "Produit B", amm: "9800203", classification: null, substanceActive: null, autoriseAB: null, darJours: 14 },
        dar: null,
      }),
    ])
    const { lignes, iEntete, valeur } = await exporter()
    const ligne = lignes[iEntete + 1]
    expect(valeur(ligne, "Produit")).toBe('"Produit A"')
    expect(valeur(ligne, "N° AMM")).toBe('"2100123"')
    expect(valeur(ligne, "DAR (j)")).toBe('""')
  })

  it("une saisie « =HYPERLINK(…) » est neutralisée", async () => {
    mocks.interventionFindMany.mockResolvedValue([intervention({ cibleTraitement: '=HYPERLINK("http://x","clic")' })])
    const { lignes, iEntete, valeur } = await exporter()
    expect(valeur(lignes[iEntete + 1], "Cible")).toMatch(/^"'=HYPERLINK/)
  })

  it("les rectifications et suppressions de la période sont exportées (C3)", async () => {
    mocks.historiqueFindMany.mockResolvedValue([
      {
        createdAt: new Date("2026-06-01T10:00:00Z"),
        source: "intervention",
        sourceId: 9,
        action: "suppression",
        avant: { date: "2026-05-20T00:00:00.000Z", produitPhyto: "Produit C", numAMM: "2000001", doseAppliquee: 2, uniteDose: "kg/ha" },
        motif: "Saisie en double",
      },
    ])
    const { lignes } = await exporter()
    const i = lignes.findIndex((l) => l.includes("Rectifications et suppressions"))
    expect(i).toBeGreaterThan(0)
    const rectif = lignes[i + 2]
    expect(rectif).toContain('"suppression"')
    expect(rectif).toContain("Produit C (AMM 2000001) 2 kg/ha")
    expect(rectif).toContain('"Saisie en double"')
  })
})
