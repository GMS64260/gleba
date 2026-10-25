import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

/**
 * Ticket QA cmvnulry1 (2026-10-25), alignement des registres : un traitement
 * saisi le 12/04/2027 à 00:30 à Paris est stocké le 11/04 à 22:30 UTC. Le
 * Registre de culture le lit au jour de Paris (`jourCivilStocke`) ; le
 * registre phytosanitaire (`toISOString()` formaté en UTC) et son export
 * (`slice(0, 10)`) le mettaient au 11. Les trois disent désormais le 12.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  interventionFindMany: vi.fn(),
  observationFindMany: vi.fn(),
  operationFindMany: vi.fn(),
  cultureFindUnique: vi.fn(),
  cultureFindMany: vi.fn(),
  fertilisationFindMany: vi.fn(),
  userFindUnique: vi.fn(),
  exploitationFindUnique: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    intervention: { findMany: mocks.interventionFindMany },
    observationSante: { findMany: mocks.observationFindMany },
    operationArbre: { findMany: mocks.operationFindMany },
    culture: { findUnique: mocks.cultureFindUnique, findMany: mocks.cultureFindMany },
    fertilisation: { findMany: mocks.fertilisationFindMany },
    user: { findUnique: mocks.userFindUnique },
    exploitation: { findUnique: mocks.exploitationFindUnique },
  },
}))

import { genererRegistrePhyto } from "../registre-phyto"
import { GET as registreCulture } from "@/app/api/tracabilite/registre-culture/route"
import { GET as exportPhyto } from "@/app/api/registre-phyto/export/route"

const tzAvant = process.env.TZ
beforeAll(() => {
  process.env.TZ = "Europe/Paris"
})
afterAll(() => {
  if (tzAvant === undefined) delete process.env.TZ
  else process.env.TZ = tzAvant
})

const user = { name: "Marc", email: "marc@example.com" }

const CULTURE = {
  id: 1237,
  especeId: "Courge",
  espece: { id: "Courge", nom: "Courge", familleId: null, type: "legume" },
  variete: null,
  itp: null,
  plancheId: null,
  planche: null,
  recoltes: [],
  annee: 2027,
  dateSemis: new Date("2027-04-12T00:00:00.000Z"),
  datePlantation: null,
  dateRecolte: null,
  finRecolte: null,
  semisFait: true,
  plantationFaite: false,
  recolteFaite: false,
  terminee: null,
  quantite: null,
  nbRangs: 1,
  longueur: 10,
  espacement: 100,
  notes: null,
}

// Traitement du 12/04/2027 à 00:30 (Paris), stocké en UTC la veille.
const TRAITEMENT = {
  id: 5,
  type: "traitement_phyto",
  date: new Date("2027-04-11T22:30:00.000Z"),
  cultureId: CULTURE.id,
  plancheId: null,
  arbreId: null,
  parcelle: null,
  produitPhyto: "Savon noir",
  produitPhytoRef: null,
  numAMM: null,
  cibleTraitement: "Pucerons",
  doseAppliquee: 2,
  uniteDose: "L/ha",
  surfaceTraitee: 100,
  surfaceTraiteeHa: null,
  volumeBouillieLHa: null,
  volumeBouillieLTotal: null,
  temperatureC: null,
  ventKmh: null,
  hygrometriePct: null,
  pluie24h: null,
  pluie24hMm: null,
  epiPortes: null,
  dar: 3,
  delaiReentree: null,
  zntDistanceM: null,
  zntRespectee: null,
  conditionsMeteo: null,
  certiphytoNum: null,
  certiphytoValidite: null,
  justification: null,
  observationLieeId: null,
  intrantNom: null,
  intrantQuantite: null,
  intrantUnite: null,
  intrantNumLot: null,
  dureeMinutes: null,
  notes: null,
  description: null,
  user,
  operateur: null,
}

describe("un traitement de 00:30 à Paris : même jour dans les deux registres et l'export", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ session: { user: { id: "u-demo" } }, error: null })
    mocks.interventionFindMany.mockResolvedValue([TRAITEMENT])
    mocks.observationFindMany.mockResolvedValue([])
    mocks.operationFindMany.mockResolvedValue([])
    mocks.cultureFindUnique.mockResolvedValue(CULTURE)
    mocks.cultureFindMany.mockResolvedValue([CULTURE])
    mocks.fertilisationFindMany.mockResolvedValue([])
    mocks.userFindUnique.mockResolvedValue({ ...user, certiphytoNum: null, certiphytoValidite: null })
    mocks.exploitationFindUnique.mockResolvedValue(null)
  })

  it("registre phytosanitaire", async () => {
    const { registre, stats } = await genererRegistrePhyto("u-demo", 2027)

    expect(registre.map((e) => e.date)).toEqual(["2027-04-12"])
    expect(stats.periodeDebut).toBe("2027-04-12")
  })

  it("registre de culture", async () => {
    const res = await registreCulture(new NextRequest("http://localhost/api/tracabilite/registre-culture?annee=2027"))
    const courge = (await res.json()).registre[0]

    expect(courge.traitementsPhyto.map((t: { date: string }) => t.date)).toEqual(["2027-04-12"])
    expect(courge.chronologie.find((e: { type: string }) => e.type === "traitement_phyto").date).toBe("2027-04-12")
  })

  it("export CSV du registre phytosanitaire", async () => {
    const res = await exportPhyto(
      new NextRequest("http://localhost/api/registre-phyto/export?from=2027-01-01&to=2027-12-31&format=csv")
    )
    expect(res.status).toBe(200)
    const ligne = (await res.text()).split("\r\n").find((l) => l.includes("Savon noir"))

    expect(ligne?.split(";")[0]).toBe("2027-04-12")
  })
})
