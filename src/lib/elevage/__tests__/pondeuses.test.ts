import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  naissanceFindMany: vi.fn(),
  animalFindMany: vi.fn(),
  reconstituerEffectifsLots: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    naissanceAnimale: { findMany: mocks.naissanceFindMany },
    animal: { findMany: mocks.animalFindMany },
  },
}))
vi.mock("@/lib/elevage/effectif", () => ({ reconstituerEffectifsLots: mocks.reconstituerEffectifsLots }))

import {
  AGE_PONTE_DEFAUT_JOURS,
  ageEntreePonteJours,
  calculerTetesNonPondeuses,
  effectifPondeuses,
  effectifsPondeursLots,
  estEspecePondeuse,
  nominatifPondeur,
  tetesNonPondeusesNaissance,
} from "../pondeuses"

const JOUR = 86_400_000
const ref = new Date("2026-10-12T12:00:00Z")
const ilYA = (jours: number) => new Date(ref.getTime() - jours * JOUR)

describe("ageEntreePonteJours", () => {
  it("lit la durée d'élevage de l'espèce, sinon le défaut", () => {
    expect(ageEntreePonteJours({ dureeElevage: 150 })).toBe(150)
    expect(ageEntreePonteJours({ dureeElevage: null })).toBe(AGE_PONTE_DEFAUT_JOURS)
    expect(ageEntreePonteJours({ dureeElevage: 0 })).toBe(AGE_PONTE_DEFAUT_JOURS)
  })
})

describe("tetesNonPondeusesNaissance", () => {
  it("QA cmv5jfsol — les poussins du jour ne pondent pas, quel que soit leur sexe", () => {
    expect(tetesNonPondeusesNaissance({ date: ref, nombreVivants: 3, fichesCreees: 0 }, 150, ref)).toBe(3)
  })
  it("une naissance qui a l'âge de ponte compte comme pondeuse", () => {
    expect(tetesNonPondeusesNaissance({ date: ilYA(150), nombreVivants: 3, fichesCreees: 0 }, 150, ref)).toBe(0)
    expect(tetesNonPondeusesNaissance({ date: ilYA(149), nombreVivants: 3, fichesCreees: 0 }, 150, ref)).toBe(3)
  })
  it("ne compte pas les petits déjà passés en fiche nominative", () => {
    expect(tetesNonPondeusesNaissance({ date: ref, nombreVivants: 3, fichesCreees: 2 }, 150, ref)).toBe(1)
    expect(tetesNonPondeusesNaissance({ date: ref, nombreVivants: 3, fichesCreees: 5 }, 150, ref)).toBe(0)
  })
  it("une naissance datée dans le futur ne pond pas", () => {
    expect(tetesNonPondeusesNaissance({ date: ilYA(-3), nombreVivants: 2, fichesCreees: 0 }, 150, ref)).toBe(2)
  })
})

describe("nominatifPondeur", () => {
  it("exclut les mâles et les jeunes, garde les adultes et les inconnus", () => {
    expect(nominatifPondeur({ sexe: "male", dateNaissance: ilYA(400) }, 150, ref)).toBe(false)
    expect(nominatifPondeur({ sexe: "femelle", dateNaissance: ilYA(10) }, 150, ref)).toBe(false)
    expect(nominatifPondeur({ sexe: "femelle", dateNaissance: ilYA(200) }, 150, ref)).toBe(true)
    expect(nominatifPondeur({ sexe: null, dateNaissance: null }, 150, ref)).toBe(true)
  })
})

describe("calculerTetesNonPondeuses", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.naissanceFindMany.mockResolvedValue([])
    mocks.animalFindMany.mockResolvedValue([])
  })

  it("n'interroge rien sans lot", async () => {
    const r = await calculerTetesNonPondeuses("u1", [], ref)
    expect(r.size).toBe(0)
    expect(mocks.naissanceFindMany).not.toHaveBeenCalled()
    expect(mocks.animalFindMany).not.toHaveBeenCalled()
  })

  it("QA cmv5jfsol — 30 pondeuses + éclosion de 3 (2 mâles, 1 femelle) : 3 têtes non pondeuses", async () => {
    mocks.naissanceFindMany.mockResolvedValue([
      { lotId: 7, date: ref, nombreVivants: 3, _count: { petits: 0 } },
    ])
    const r = await calculerTetesNonPondeuses("u1", [{ id: 7, especeAnimale: { dureeElevage: 150 } }], ref)
    expect(r.get(7)).toBe(3)
    expect(effectifPondeuses(33, r.get(7))).toBe(30)
    expect(mocks.naissanceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1", lotId: { in: [7] } } }),
    )
    expect(mocks.animalFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1", lotId: { in: [7] }, statut: "actif" } }),
    )
  })

  it("additionne naissances anonymes jeunes et fiches mâles ou jeunes, par lot et par espèce", async () => {
    mocks.naissanceFindMany.mockResolvedValue([
      // Lot 1 (poules, 150 j) : portée de 60 j → jeunes ; 1 petit déjà en fiche
      { lotId: 1, date: ilYA(60), nombreVivants: 4, _count: { petits: 1 } },
      // Lot 2 (cailles, 45 j) : portée de 60 j → adultes
      { lotId: 2, date: ilYA(60), nombreVivants: 5, _count: { petits: 0 } },
      { lotId: null, date: ref, nombreVivants: 9, _count: { petits: 0 } },
    ])
    mocks.animalFindMany.mockResolvedValue([
      { lotId: 1, sexe: "male", dateNaissance: ilYA(60) },
      { lotId: 1, sexe: "femelle", dateNaissance: ilYA(300) },
      { lotId: 2, sexe: "femelle", dateNaissance: ilYA(10) },
    ])
    const r = await calculerTetesNonPondeuses(
      "u1",
      [
        { id: 1, especeAnimale: { dureeElevage: 150 } },
        { id: 2, especeAnimale: { dureeElevage: 45 } },
      ],
      ref,
    )
    expect(r.get(1)).toBe(3 + 1)
    expect(r.get(2)).toBe(1)
  })
})

describe("effectifPondeuses", () => {
  it("ne descend jamais sous zéro et tolère l'absence de retenue", () => {
    expect(effectifPondeuses(10, undefined)).toBe(10)
    expect(effectifPondeuses(2, 5)).toBe(0)
  })
})

describe("estEspecePondeuse", () => {
  it("retient œufs et mixte, rien d'autre", () => {
    expect(estEspecePondeuse("oeufs")).toBe(true)
    expect(estEspecePondeuse("mixte")).toBe(true)
    expect(estEspecePondeuse("viande")).toBe(false)
    expect(estEspecePondeuse(null)).toBe(false)
  })
})

describe("effectifsPondeursLots", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.naissanceFindMany.mockResolvedValue([])
    mocks.animalFindMany.mockResolvedValue([])
    mocks.reconstituerEffectifsLots.mockResolvedValue(new Map())
  })

  it("n'interroge rien sans lot", async () => {
    expect((await effectifsPondeursLots("u1", [], ref)).size).toBe(0)
    expect(mocks.reconstituerEffectifsLots).not.toHaveBeenCalled()
  })

  it("part de l'effectif reconstitué (fiches comprises), pas du compteur brut", async () => {
    // 30 poules + éclosion de 3 dont 2 passés en fiche : compteur brut 31,
    // effectif reconstitué 33, non pondeuses 1 (anonyme) + 2 (fiches jeunes).
    mocks.reconstituerEffectifsLots.mockResolvedValue(
      new Map([[7, { effectifCalcule: 33, naissancesVivantes: 3, abattagesTotal: 0, nominatifsActifs: 2, sortiesNominatives: 0 }]]),
    )
    mocks.naissanceFindMany.mockResolvedValue([{ lotId: 7, date: ref, nombreVivants: 3, _count: { petits: 2 } }])
    mocks.animalFindMany.mockResolvedValue([
      { lotId: 7, sexe: "male", dateNaissance: ref },
      { lotId: 7, sexe: "femelle", dateNaissance: ref },
    ])
    const r = await effectifsPondeursLots(
      "u1",
      [{ id: 7, quantiteInitiale: 30, quantiteActuelle: 31, especeAnimale: { dureeElevage: 150 } }],
      ref,
    )
    expect(r.get(7)).toEqual({ effectifCalcule: 33, tetesNonPondeuses: 3, effectifPondeuses: 30 })
  })

  it("retombe sur le compteur du lot si l'effectif reconstitué manque", async () => {
    const r = await effectifsPondeursLots(
      "u1",
      [{ id: 8, quantiteInitiale: 10, quantiteActuelle: 9, especeAnimale: { dureeElevage: null } }],
      ref,
    )
    expect(r.get(8)).toEqual({ effectifCalcule: 9, tetesNonPondeuses: 0, effectifPondeuses: 9 })
  })
})
