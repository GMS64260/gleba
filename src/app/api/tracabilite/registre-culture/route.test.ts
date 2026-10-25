import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

/**
 * Ticket QA cmvnulry1 (2026-10-25) — Planification 2027, courge créée depuis la
 * rotation de la planche « v8-Marc-2010 (2) » : la fiche de la culture #1237
 * dit semis 2027-04-12 et plantation 2027-05-10, le Registre de culture 2027
 * affichait « 11 avr. ». Les radis saisis à la main étaient justes.
 *
 * Cause : `creerCulturesBatch` écrivait le minuit LOCAL de `semaineVersDate`
 * (11/04 22:00 UTC), le registre rendait l'ISO brut et l'écran le formate en
 * UTC. Scénario rejoué à Paris (fuseau du conteneur et du navigateur de la QA).
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  itpFindMany: vi.fn(),
  plancheFindMany: vi.fn(),
  cultureFindFirst: vi.fn(),
  cultureCreate: vi.fn(),
  cultureFindMany: vi.fn(),
  interventionFindMany: vi.fn(),
  fertilisationFindMany: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    iTP: { findMany: mocks.itpFindMany },
    planche: { findMany: mocks.plancheFindMany },
    culture: { findFirst: mocks.cultureFindFirst, create: mocks.cultureCreate, findMany: mocks.cultureFindMany },
    intervention: { findMany: mocks.interventionFindMany },
    fertilisation: { findMany: mocks.fertilisationFindMany },
  },
}))
// Mock partiel : `calendrier-climat` dérive ses zones de `terroir` au chargement.
vi.mock("@/lib/terroir", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/terroir")>()),
  zoneEffectiveUser: vi.fn().mockResolvedValue(null),
}))

import { creerCulturesBatch } from "@/lib/planification"
import { GET } from "./route"

const tzAvant = process.env.TZ
beforeAll(() => {
  process.env.TZ = "Europe/Paris"
})
afterAll(() => {
  if (tzAvant === undefined) delete process.env.TZ
  else process.env.TZ = tzAvant
})

/** Format de l'en-tête d'une culture dans l'écran (`formatDateShort`, page /tracabilite). */
const commeLEcran = (jour: string | null) =>
  jour
    ? new Date(jour).toLocaleDateString("fr-FR", { timeZone: "UTC", day: "2-digit", month: "short" })
    : "-"

// Semis S15 et plantation S19 : lundis 12/04 et 10/05/2027.
const ITP_COURGE = {
  id: "Courge-plein-champ",
  especeId: "Courge",
  espece: { id: "Courge", vivace: false },
  userId: null,
  zoneClimat: null,
  semaineSemis: 15,
  semainePlantation: 19,
  semaineRecolte: 33,
  semaineRecolteFin: null,
  dureeRecolte: 6,
  nbRangs: 1,
  espacement: 100,
  espacementRangs: 100,
}

const PLANCHE = { id: "cmvnulpl0000planche0002", nom: "v8-Marc-2010 (2)", largeur: 1.2, longueur: 10, cultures: [] }

/** Ligne `culture.findMany` du registre, à partir des dates stockées. */
function ligneRegistre(id: number, especeId: string, dates: { dateSemis: Date | null; datePlantation: Date | null }) {
  return {
    id,
    especeId,
    espece: { id: especeId, nom: especeId, familleId: null, type: "legume" },
    variete: null,
    itp: null,
    plancheId: PLANCHE.id,
    planche: { nom: PLANCHE.nom, surface: 12, largeur: 1.2, longueur: 10, ilot: null, type: null },
    recoltes: [],
    annee: 2027,
    ...dates,
    dateRecolte: null,
    finRecolte: null,
    semisFait: false,
    plantationFaite: false,
    recolteFaite: false,
    terminee: null,
    quantite: null,
    nbRangs: 1,
    longueur: 10,
    espacement: 100,
    notes: null,
  }
}

async function lireRegistre2027() {
  const res = await GET(new NextRequest("http://localhost/api/tracabilite/registre-culture?annee=2027"))
  expect(res.status).toBe(200)
  return res.json()
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ session: { user: { id: "u-demo" } }, error: null })
  mocks.itpFindMany.mockResolvedValue([ITP_COURGE])
  mocks.plancheFindMany.mockResolvedValue([{ ...PLANCHE, cultures: [] }])
  mocks.cultureFindFirst.mockResolvedValue(null)
  mocks.cultureCreate.mockImplementation(async ({ data }) => ({ id: 1237, ...data }))
  mocks.interventionFindMany.mockResolvedValue([])
  mocks.fertilisationFindMany.mockResolvedValue([])
})

describe("Registre de culture : semis d'une culture créée depuis la rotation (cmvnulry1)", () => {
  it("la rotation écrit le jour seul à minuit UTC, comme une saisie de formulaire", async () => {
    const r = await creerCulturesBatch("u-demo", [{ plancheId: PLANCHE.nom, itpId: ITP_COURGE.id, annee: 2027 }])

    expect(r.created).toBe(1)
    const data = mocks.cultureCreate.mock.calls[0][0].data
    expect(data.dateSemis.toISOString()).toBe("2027-04-12T00:00:00.000Z")
    expect(data.datePlantation.toISOString()).toBe("2027-05-10T00:00:00.000Z")
    for (const champ of ["dateRecolte", "finRecolte"] as const) {
      expect(data[champ].getTime() % 86_400_000).toBe(0)
    }
  })

  it("date de la rotation → stockée → affichée « 12 avr. » au registre", async () => {
    await creerCulturesBatch("u-demo", [{ plancheId: PLANCHE.nom, itpId: ITP_COURGE.id, annee: 2027 }])
    const data = mocks.cultureCreate.mock.calls[0][0].data
    mocks.cultureFindMany.mockResolvedValue([ligneRegistre(1237, "Courge", data)])

    const corps = await lireRegistre2027()
    const courge = corps.registre[0]

    expect(courge.dates.semis).toBe("2027-04-12")
    expect(commeLEcran(courge.dates.semis)).toBe("12 avr.")
    expect(courge.chronologie.map((e: { type: string; date: string }) => [e.type, e.date])).toEqual([
      ["semis", "2027-04-12"],
      ["plantation", "2027-05-10"],
    ])
  })

  it("une culture déjà stockée à minuit Paris s'affiche à son jour, une saisie manuelle aussi", async () => {
    mocks.cultureFindMany.mockResolvedValue([
      // Courge #1237 telle que l'ancienne création depuis la rotation l'a stockée.
      ligneRegistre(1237, "Courge", {
        dateSemis: new Date("2027-04-11T22:00:00.000Z"),
        datePlantation: new Date("2027-05-09T22:00:00.000Z"),
      }),
      // Radis saisi à la main le 01/06/2027 (formulaire « AAAA-MM-JJ »).
      ligneRegistre(1240, "Radis", { dateSemis: new Date("2027-06-01T00:00:00.000Z"), datePlantation: null }),
    ])

    const corps = await lireRegistre2027()
    const [courge, radis] = corps.registre

    expect(commeLEcran(courge.dates.semis)).toBe("12 avr.")
    expect(courge.dates.plantation).toBe("2027-05-10")
    expect(commeLEcran(radis.dates.semis)).toBe("01 juin")
  })
})
