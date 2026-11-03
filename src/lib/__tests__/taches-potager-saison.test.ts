import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

/**
 * Accueil d'un compte réel le 2026-10-25 : « Planter Aubergine S1P2 —
 * aujourd'hui » (plantation posée au jour même, hors de la fenêtre S16–S18 de
 * son ITP) et « Planter Ail S1P1 — en retard de 286 j » (plantation S3, dans
 * sa fenêtre S3–S7). La règle du retard ne change pas (pas de borne basse) ;
 * la ligne de la plantation hors saison le dit (`horsSaison`).
 */

const mocks = vi.hoisted(() => ({ cultureFindMany: vi.fn() }))

vi.mock("@/lib/prisma", () => ({ default: { culture: { findMany: mocks.cultureFindMany } } }))
vi.mock("@/lib/irrigation/a-arroser", () => ({
  chargerTourneeDuJour: vi.fn().mockResolvedValue({ lignes: [], nbCultures: 0, horsTournee: [] }),
}))
vi.mock("@/lib/recolte/rendement-effectif", () => ({
  chargerSurchargesRendement: vi.fn().mockResolvedValue(new Map()),
  rendementEffectif: () => ({ uniteRendement: "kg" }),
}))
vi.mock("@/lib/terroir", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/terroir")>()),
  zoneEffectiveUser: vi.fn().mockResolvedValue(null),
}))

import { getTachesPotager } from "../taches-potager"

const itpInrae = (debut: number, fin: number, plantation: number, actif = true) => ({
  userId: null as string | null,
  partageCommunaute: false,
  actif,
  zoneClimat: "oceanique",
  semaineSemis: null,
  semainePlantation: plantation,
  semaineImplantationDebut: debut,
  semaineImplantationFin: fin,
  implantation: "Plantation",
})

const culture = (id: number, especeNom: string, planche: string, datePlantation: string, itp: ReturnType<typeof itpInrae>) => ({
  id,
  especeId: especeNom,
  varieteId: null,
  plancheId: `planche-${planche}`,
  dateSemis: null,
  datePlantation: new Date(datePlantation),
  dateRecolte: null,
  semisFait: false,
  plantationFaite: false,
  recolteFaite: false,
  espece: { couleur: null, nom: especeNom, rendement: null, uniteRendement: null },
  variete: null,
  planche: { nom: planche },
  itp,
})

const AUBERGINE = culture(2002, "Aubergine", "S1P2", "2026-10-25T00:00:00.000Z", itpInrae(16, 18, 16))
const AIL = culture(2001, "Ail", "S1P1", "2026-01-12T00:00:00.000Z", itpInrae(3, 7, 3))

beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 25, 15, 0))
})
afterAll(() => {
  vi.useRealTimers()
})

describe("getTachesPotager — plantation hors saison de l'ITP", () => {
  it("garde la récolte ouverte sans retard jusqu'à la fin de sa fenêtre", async () => {
    const base = { ...AIL, datePlantation: null, dateRecolte: new Date(2026, 9, 1) }
    mocks.cultureFindMany.mockImplementation(async ({ where }: { where: Record<string, { lt?: Date }> }) =>
      where.dateRecolte?.lt ? [
        { ...base, id: 301, finRecolte: new Date(2026, 9, 30) },
        { ...base, id: 302, finRecolte: new Date(2026, 9, 25) },
        { ...base, id: 303, finRecolte: new Date(2026, 9, 22) },
        { ...base, id: 304, finRecolte: null },
      ] : [],
    )
    const taches = await getTachesPotager("u1", {
      start: new Date(2026, 9, 19), end: new Date(2026, 9, 25, 23, 59, 59), annee: 2026,
    })
    expect(taches.recoltes.map(r => [r.id, r.retardJours])).toEqual([
      [301, 0], [302, 0], [303, 3], [304, 24],
    ])
    expect(taches.stats.enRetard).toBe(2)
    expect(taches.stats.recoltesPrevues).toBe(4)
  })

  it("dit « hors saison » sur l'aubergine du jour, rien sur l'ail en retard", async () => {
    mocks.cultureFindMany.mockImplementation(async ({ where }: { where: Record<string, { lt?: Date; gte?: Date }> }) => {
      if (where.datePlantation?.gte) return [AUBERGINE] // semaine affichée
      if (where.datePlantation?.lt) return [AIL] // en retard
      return []
    })
    const taches = await getTachesPotager("u1", {
      start: new Date(2026, 9, 19),
      end: new Date(2026, 9, 25, 23, 59, 59),
      annee: 2026,
    })
    const aubergine = taches.plantations.find((p) => p.id === 2002)
    const ail = taches.plantations.find((p) => p.id === 2001)
    expect(aubergine?.horsSaison).toBe("Hors fenêtre de l'itinéraire (plantation S16–S18) : plantation prévue S43.")
    expect(aubergine?.retardJours).toBe(0)
    expect(ail?.horsSaison).toBeNull()
    // Décision du vault : un retard n'a pas de borne basse.
    expect(ail?.retardJours).toBe(286)
    // Les récoltes ne joignent pas l'ITP (requêtes de récolte sans `itp`).
    for (const appel of mocks.cultureFindMany.mock.calls) {
      const { where, select } = appel[0] as { where: Record<string, unknown>; select: Record<string, unknown> }
      expect("itp" in select).toBe(!("dateRecolte" in where))
    }
  })

  it("un ITP retiré du service, ou privé d'un autre compte, ne parle plus", async () => {
    const retire = { ...AUBERGINE, itp: itpInrae(16, 18, 16, false) }
    const prive = { ...AUBERGINE, id: 2003, itp: { ...itpInrae(16, 18, 16), userId: "autre-compte" } }
    mocks.cultureFindMany.mockImplementation(async ({ where }: { where: Record<string, { gte?: Date }> }) =>
      where.datePlantation?.gte ? [retire, prive] : []
    )
    const taches = await getTachesPotager("u1", {
      start: new Date(2026, 9, 19),
      end: new Date(2026, 9, 25, 23, 59, 59),
      annee: 2026,
    })
    expect(taches.plantations.map((p) => p.horsSaison)).toEqual([null, null])
  })
})
