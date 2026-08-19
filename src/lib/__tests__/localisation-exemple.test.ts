import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  default: {
    parcelleGeo: { findMany: vi.fn() },
    planche: { count: vi.fn() },
    culture: { count: vi.fn() },
  },
}))

import prisma from "@/lib/prisma"
import {
  CULTURES_EXEMPLE,
  PARCELLE_EXEMPLE,
  PLANCHES_EXEMPLE,
  detecterLocalisationARecaler,
  estCentroidExemple,
} from "@/lib/localisation-exemple"

const mockedPrisma = prisma as unknown as {
  parcelleGeo: { findMany: ReturnType<typeof vi.fn> }
  planche: { count: ReturnType<typeof vi.fn> }
  culture: { count: ReturnType<typeof vi.fn> }
}

const PARCELLE_PARIS = {
  id: "parcelle-1",
  nom: "Potager",
  centroidLat: PARCELLE_EXEMPLE.centroidLat,
  centroidLng: PARCELLE_EXEMPLE.centroidLng,
}

describe("estCentroidExemple", () => {
  it("reconnaît la parcelle livrée à l'inscription", () => {
    expect(estCentroidExemple(48.85675, 2.352)).toBe(true)
  })

  it("tolère l'arrondi mais pas un déplacement réel", () => {
    // ~5 m : la parcelle n'a pas bougé.
    expect(estCentroidExemple(48.856755, 2.352005)).toBe(true)
    // Quelques centaines de mètres : elle a été recalée.
    expect(estCentroidExemple(48.86, 2.352)).toBe(false)
    // Un maraîcher du Gard.
    expect(estCentroidExemple(43.9721, 3.5183)).toBe(false)
  })

  it("ne conclut rien d'une parcelle sans centroïde", () => {
    expect(estCentroidExemple(null, null)).toBe(false)
    expect(estCentroidExemple(48.85675, null)).toBe(false)
  })
})

describe("detecterLocalisationARecaler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("se tait quand aucune parcelle n'est restée à Paris", async () => {
    mockedPrisma.parcelleGeo.findMany.mockResolvedValue([])

    const resultat = await detecterLocalisationARecaler("user-1")

    expect(resultat.aRecaler).toBe(false)
    expect(resultat.parcelleId).toBeNull()
    // Aucun comptage inutile quand il n'y a rien à signaler.
    expect(mockedPrisma.planche.count).not.toHaveBeenCalled()
  })

  it("se tait tant que le compte s'en tient au décor d'exemple", async () => {
    mockedPrisma.parcelleGeo.findMany.mockResolvedValue([PARCELLE_PARIS])
    mockedPrisma.planche.count.mockResolvedValue(PLANCHES_EXEMPLE)
    mockedPrisma.culture.count.mockResolvedValue(CULTURES_EXEMPLE)

    const resultat = await detecterLocalisationARecaler("user-1")

    expect(resultat.aRecaler).toBe(false)
  })

  // Cas réel du 2026-08-14 : 11 planches et 23 cultures accrochées à la
  // parcelle d'exemple, météo et Hub'Eau calés sur Paris sans un mot.
  it("alerte dès que le compte dépasse l'exemple", async () => {
    mockedPrisma.parcelleGeo.findMany.mockResolvedValue([PARCELLE_PARIS])
    mockedPrisma.planche.count.mockResolvedValue(11)
    mockedPrisma.culture.count.mockResolvedValue(23)

    const resultat = await detecterLocalisationARecaler("user-1")

    expect(resultat).toEqual({
      aRecaler: true,
      // Refonte onboarding 2026-08-17 : un centroïde parisien ne peut plus être
      // qu'un héritage, donc une donnée fausse — le bandeau s'affiche dès que
      // le décor est présent, `aRecaler` ne servant plus qu'à l'insistance.
      surDecorExemple: true,
      parcelleId: "parcelle-1",
      parcelleNom: "Potager",
      nbPlanches: 11,
      nbCultures: 23,
    })
  })

  it("suffit d'une seule des deux mesures pour alerter", async () => {
    mockedPrisma.parcelleGeo.findMany.mockResolvedValue([PARCELLE_PARIS])
    mockedPrisma.planche.count.mockResolvedValue(PLANCHES_EXEMPLE)
    mockedPrisma.culture.count.mockResolvedValue(CULTURES_EXEMPLE + 1)

    expect((await detecterLocalisationARecaler("user-1")).aRecaler).toBe(true)
  })

  // La boîte englobante SQL est large : c'est `estCentroidExemple` qui tranche.
  it("écarte une parcelle ramenée par le pré-filtre mais réellement déplacée", async () => {
    mockedPrisma.parcelleGeo.findMany.mockResolvedValue([
      { id: "parcelle-2", nom: "Potager", centroidLat: 48.9, centroidLng: 2.352 },
    ])

    const resultat = await detecterLocalisationARecaler("user-1")

    expect(resultat.aRecaler).toBe(false)
    expect(mockedPrisma.culture.count).not.toHaveBeenCalled()
  })

  // Le décor seul suffit à signaler : sans cela, les 26 comptes déjà passés par
  // l'onboarding et restés sur Paris n'avaient plus AUCUN chemin de correction
  // (ils ne repassent jamais par le parcours qui recale).
  it("signale le décor même sans données réelles dessus", async () => {
    mockedPrisma.parcelleGeo.findMany.mockResolvedValue([PARCELLE_PARIS])
    mockedPrisma.planche.count.mockResolvedValue(PLANCHES_EXEMPLE)
    mockedPrisma.culture.count.mockResolvedValue(CULTURES_EXEMPLE)

    const resultat = await detecterLocalisationARecaler("user-1")

    expect(resultat.aRecaler).toBe(false)
    expect(resultat.surDecorExemple).toBe(true)
    expect(resultat.parcelleId).toBe("parcelle-1")
  })
})
