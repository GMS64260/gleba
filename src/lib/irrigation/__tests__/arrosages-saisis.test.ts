/**
 * Arrosages saisis du bilan hydrique : « Noter » et interventions « arrosage »
 * (ticket QA cmv2rdmdn, 2026-10-10).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  default: {
    irrigationPlanifiee: { findMany: vi.fn() },
    intervention: { findMany: vi.fn() },
    planche: { findMany: vi.fn() },
    culture: { findMany: vi.fn() },
  },
}))

import prisma from "@/lib/prisma"
import { chargerArrosagesSaisis, dernierArrosage, litresSaisis } from "../arrosages-saisis"

const mocked = prisma as unknown as {
  irrigationPlanifiee: { findMany: ReturnType<typeof vi.fn> }
  intervention: { findMany: ReturnType<typeof vi.fn> }
  planche: { findMany: ReturnType<typeof vi.fn> }
  culture: { findMany: ReturnType<typeof vi.fn> }
}

const PLANCHE = { id: "p1", nom: "Planche A", surface: 20, largeur: 0.8, longueur: 25 }
const CULTURES = [
  { id: 10, plancheId: "p1", longueur: 22, planche: PLANCHE },
  { id: 11, plancheId: "p1", longueur: null, planche: PLANCHE },
]

describe("arrosages saisis", () => {
  beforeEach(() => vi.clearAllMocks())

  it("lit les litres en L ou m³, rien d'autre", () => {
    expect(litresSaisis(312, "L")).toBe(312)
    expect(litresSaisis(2, "litres")).toBe(2)
    expect(litresSaisis(0.5, "m³")).toBe(500)
    // Pour de l'eau, 1 kg = 1 L (unité par défaut du formulaire).
    expect(litresSaisis(20, "kg")).toBe(20)
    expect(litresSaisis(3, "unités")).toBeNull()
    expect(litresSaisis(null, "L")).toBeNull()
    expect(litresSaisis(0, "L")).toBeNull()
  })

  it("une intervention arrose la planche entière, comme « Noter » ; sans planche, la culture seule", async () => {
    mocked.irrigationPlanifiee.findMany.mockResolvedValue([
      { cultureId: 11, dateEffective: new Date("2026-10-08T18:00:00Z") },
    ])
    mocked.intervention.findMany.mockResolvedValue([
      // Culture ET planche remplies (formulaire) : toute la planche, sur sa surface (20 m²).
      { date: new Date("2026-10-10T00:00:00Z"), cultureId: 10, plancheId: "p1", intrantQuantite: 312, intrantUnite: "L" },
      // Planche désignée par son nom (saisies anciennes).
      { date: new Date("2026-10-09T00:00:00Z"), cultureId: null, plancheId: "Planche A", intrantQuantite: 100, intrantUnite: "L" },
      // Culture seule : sa planche.
      { date: new Date("2026-10-07T00:00:00Z"), cultureId: 10, plancheId: null, intrantQuantite: null, intrantUnite: null },
      // Culture hors liste (finie) sur la même planche : arrose ses colocataires.
      { date: new Date("2026-10-06T00:00:00Z"), cultureId: 99, plancheId: null, intrantQuantite: 40, intrantUnite: "kg" },
    ])
    mocked.culture.findMany.mockResolvedValue([{ id: 99, plancheId: "p1" }])
    mocked.planche.findMany.mockResolvedValue([PLANCHE])

    const r = await chargerArrosagesSaisis("u1", CULTURES, new Date("2026-01-01"))
    const du = (id: number, jour: string) => r.get(id)!.find((a) => a.date.toISOString().startsWith(jour))!

    for (const id of [10, 11]) {
      expect(du(id, "2026-10-10").litresParM2).toBeCloseTo(15.6, 1)
      expect(du(id, "2026-10-09").litresParM2).toBe(5)
      expect(du(id, "2026-10-07").litresParM2).toBeNull()
      expect(du(id, "2026-10-06").litresParM2).toBe(2)
    }
    expect(r.get(11)!.find((a) => !a.calendaire)!.litresParM2).toBeNull()
    expect(mocked.culture.findMany).toHaveBeenCalledWith({
      where: { userId: "u1", id: { in: [99] } },
      select: { id: true, plancheId: true },
    })
  })

  it("une culture sans planche reçoit l'eau sur sa propre surface", async () => {
    mocked.irrigationPlanifiee.findMany.mockResolvedValue([])
    mocked.intervention.findMany.mockResolvedValue([
      { date: new Date("2026-10-10T00:00:00Z"), cultureId: 12, plancheId: null, intrantQuantite: 30, intrantUnite: "L" },
    ])
    mocked.planche.findMany.mockResolvedValue([])
    // Planche introuvable (aucune ligne) mais dimensions portées par la culture : 1,5 m × 10 m.
    const seule = { id: 12, plancheId: null, longueur: 10, planche: { largeur: 1.5 } }
    const r = await chargerArrosagesSaisis("u1", [seule], new Date("2026-01-01"))
    expect(r.get(12)![0].litresParM2).toBe(2)
    // Sans aucune dimension : surface inconnue, arrosage plein.
    const r2 = await chargerArrosagesSaisis("u1", [{ id: 12, plancheId: null }], new Date("2026-01-01"))
    expect(r2.get(12)![0].litresParM2).toBeNull()
  })

  it("le dernier arrosage est le plus récent, toutes saisies confondues", () => {
    const note = new Date("2026-10-01T08:00:00Z")
    const inter = { date: new Date("2026-10-10T00:00:00Z"), calendaire: true, litresParM2: 17.7 }
    expect(dernierArrosage(note, [inter])).toEqual(inter.date)
    expect(dernierArrosage(null, [])).toBeNull()
    expect(dernierArrosage(note, [])).toEqual(note)
  })
})
