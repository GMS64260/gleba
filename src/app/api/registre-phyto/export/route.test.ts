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
    user: {
      findUnique: async () => ({ name: "Exploitant", email: "e@example.com", certiphytoNum: null, certiphytoValidite: null }),
      findMany: async () => [{ id: "u1", name: "Exploitant", email: "e@example.com" }],
    },
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

  const suppression2025 = {
    createdAt: new Date("2026-02-01T10:00:00Z"),
    source: "intervention",
    sourceId: 9,
    action: "suppression",
    auteurId: "u1",
    motif: "Saisie en double",
    avant: {
      date: "2025-05-20T00:00:00.000Z",
      produitPhyto: "Produit C",
      numAMM: "2000001",
      doseAppliquee: 2,
      uniteDose: "kg/ha",
      surfaceTraitee: 1500,
      cultureRegistre: "Tomate",
      localisationRegistre: "Planche P3 · GPS 43.2951234, -0.3707890 (WGS84)",
      conduiteBio: true,
      stadeBBCH: "65",
      heureDebut: "06:30",
    },
  }

  it("état d'origine COMPLET exporté, avec auteur et motif (C3, CR-PHY-02)", async () => {
    mocks.historiqueFindMany.mockResolvedValue([{ ...suppression2025, createdAt: new Date("2026-06-01T10:00:00Z") }])
    const { lignes } = await exporter()
    const i = lignes.findIndex((l) => l.includes("Rectifications et suppressions"))
    expect(i).toBeGreaterThan(0)
    const entete = lignes[i + 1].split(";")
    const rectif = lignes[i + 2].split(";")
    const col = (nom: string) => rectif[entete.indexOf(`"${nom}"`)]
    expect(col("Action")).toBe('"suppression"')
    expect(col("Auteur")).toBe('"Exploitant"')
    expect(col("Motif")).toBe('"Saisie en double"')
    expect(col("Date d'utilisation d'origine")).toBe('"20/05/2025"')
    expect(col("Culture")).toBe('"Tomate"')
    expect(col("Localisation")).toContain("43.2951234")
    expect(col("Conduite biologique")).toBe('"Oui"')
    expect(col("Surface traitée (ha)")).toBe("0.15")
    expect(col("Stade BBCH")).toBe('"65"')
    expect(col("Horaires")).toBe('"06:30"')
  })

  it("un traitement 2025 supprimé en 2026 reste dans l'export 2025 (CR-PHY-02)", async () => {
    mocks.historiqueFindMany.mockResolvedValue([suppression2025])
    const res = await GET(
      new NextRequest("http://localhost/api/registre-phyto/export?from=2025-01-01&to=2025-12-31&format=csv"),
    )
    const texte = await res.text()
    expect(texte).toContain("Rectifications et suppressions")
    expect(texte).toContain('"20/05/2025"')
  })

  it("une rectification hors période, d'un traitement hors période, n'apparaît pas", async () => {
    mocks.historiqueFindMany.mockResolvedValue([{ ...suppression2025, createdAt: new Date("2024-02-01T10:00:00Z"), avant: { ...suppression2025.avant, date: "2024-01-10T00:00:00.000Z" } }])
    const { lignes } = await exporter()
    expect(lignes.some((l) => l.includes("Rectifications et suppressions"))).toBe(false)
  })
})
