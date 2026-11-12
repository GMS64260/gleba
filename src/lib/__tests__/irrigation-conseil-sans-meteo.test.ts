/**
 * Revue du 2026-11-11 : le conseil de la page Irriguer doit dire quand il n'a
 * pas pu calculer de bilan (panne météo, aucune parcelle géolocalisée), comme
 * le conseiller du Calendrier ; l'âge d'un plant n'est jamais négatif ; la
 * pluie annoncée aujourd'hui compte pour « prochaine pluie ».
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  cultures: vi.fn(),
  premiereParcelle: vi.fn(),
  chargerMeteoBilan: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    culture: { findMany: mocks.cultures },
    parcelleGeo: { findFirst: mocks.premiereParcelle },
  },
}))
vi.mock("@/lib/abonnement/serveur", () => ({ exigerCapacite: vi.fn() }))
vi.mock("@/lib/cache-helper", () => ({ getOrFetch: vi.fn() }))
vi.mock("@/lib/meteo", () => ({ fetchOpenMeteoForecast: vi.fn(), fetchOpenMeteoHistory: vi.fn() }))
vi.mock("@/lib/irrigation/arrosages-saisis", async (original) => ({
  ...(await original<typeof import("@/lib/irrigation/arrosages-saisis")>()),
  chargerArrosagesSaisis: vi.fn(async () => new Map()),
}))
vi.mock("@/lib/irrigation/meteo-bilan", async (original) => ({
  ...(await original<typeof import("@/lib/irrigation/meteo-bilan")>()),
  chargerMeteoBilan: mocks.chargerMeteoBilan,
}))

import { computeConseilIrrigation, resumeMeteo } from "@/lib/irrigation-conseil"
import { ajouterJours, jourLocalIso, type MeteoBilan } from "@/lib/irrigation/meteo-bilan"

const JOUR_MS = 86_400_000
const dans = (jours: number) => new Date(Date.now() + jours * JOUR_MS)

function culture(id: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    especeId: "tomate",
    varieteId: null,
    plancheId: "p1",
    aIrriguer: true,
    derniereIrrigation: null,
    plantationFaite: true,
    semisFait: false,
    dateSemis: null,
    datePlantation: dans(-40),
    dateRecolte: null,
    finRecolte: null,
    nbRangs: 2,
    longueur: 10,
    espece: { id: "tomate", nom: "Tomate", couleur: null, besoinEau: 4, irrigation: null, vivace: false },
    planche: {
      id: "p1", nom: "P1", ilot: "A", type: "Plein champ", irrigation: null,
      surface: 10, largeur: 1, longueur: 10, retentionEau: null, typeSol: null,
      parcelleGeo: { id: "g1", centroidLat: 43.3, centroidLng: -0.37, typeSol: null },
    },
    variete: null,
    ...extra,
  }
}

/** Série sèche de 30 jours ; `pluieDuJour` et `pluies` (prévisions) au choix. */
function meteo(pluieDuJour = 0, pluies: number[] = [0, 0, 0, 0, 0, 0, 0]): MeteoBilan {
  const aujourdhui = jourLocalIso(new Date())
  return {
    historique: Array.from({ length: 30 }, (_, i) => ({ date: ajouterJours(aujourdhui, i - 30), pluie: 0, et0: 4 })),
    aujourdhui: { date: aujourdhui, pluie: pluieDuJour, et0: 4 },
    previsions: pluies.map((pluie, i) => ({ date: ajouterJours(aujourdhui, i + 1), pluie, et0: 4 })),
    decalageUtcS: 3600,
  }
}

describe("computeConseilIrrigation : conseil sans bilan", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.premiereParcelle.mockResolvedValue({ centroidLat: 43.3, centroidLng: -0.37, typeSol: null })
  })

  it("panne météo : la culture est marquée, la réponse compte la zone muette", async () => {
    mocks.cultures.mockResolvedValue([culture(1)])
    mocks.chargerMeteoBilan.mockResolvedValue(null)

    const conseil = await computeConseilIrrigation("u1", new Date().getFullYear())

    expect(conseil.data[0].sansMeteo).toBe("meteo-indisponible")
    expect(conseil.data[0].reserve).toBeNull()
    expect(conseil).toMatchObject({ zonesIndisponibles: 1, culturesSansMeteo: 1, indisponible: true })
  })

  it("une zone muette sur deux : pas de panne totale", async () => {
    const ailleurs = { ...culture(2).planche, id: "p2", parcelleGeo: { id: "g2", centroidLat: 48.8, centroidLng: 2.3, typeSol: null } }
    mocks.cultures.mockResolvedValue([culture(1), culture(2, { plancheId: "p2", planche: ailleurs })])
    mocks.chargerMeteoBilan.mockImplementation(async (lat: number) => (lat > 45 ? null : meteo()))

    const conseil = await computeConseilIrrigation("u1", new Date().getFullYear())

    expect(conseil.data.find((c) => c.id === 1)?.sansMeteo).toBeNull()
    expect(conseil.data.find((c) => c.id === 2)?.sansMeteo).toBe("meteo-indisponible")
    expect(conseil).toMatchObject({ zonesIndisponibles: 1, culturesSansMeteo: 1, indisponible: false })
  })

  it("aucune parcelle géolocalisée : cultures marquées, sans zone muette", async () => {
    mocks.premiereParcelle.mockResolvedValue(null)
    mocks.cultures.mockResolvedValue([
      culture(1, { planche: { ...culture(1).planche, parcelleGeo: null } }),
    ])

    const conseil = await computeConseilIrrigation("u1", new Date().getFullYear())

    expect(mocks.chargerMeteoBilan).not.toHaveBeenCalled()
    expect(conseil.data[0].sansMeteo).toBe("sans-coordonnees")
    expect(conseil).toMatchObject({ zonesIndisponibles: 0, culturesSansMeteo: 1, indisponible: false })
  })

  it("météo connue : rien n'est marqué", async () => {
    mocks.cultures.mockResolvedValue([culture(1)])
    mocks.chargerMeteoBilan.mockResolvedValue(meteo())

    const conseil = await computeConseilIrrigation("u1", new Date().getFullYear())

    expect(conseil.data[0].sansMeteo).toBeNull()
    expect(conseil).toMatchObject({ zonesIndisponibles: 0, culturesSansMeteo: 0, indisponible: false })
  })
})

describe("computeConseilIrrigation : âge de la culture", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.premiereParcelle.mockResolvedValue({ centroidLat: 43.3, centroidLng: -0.37, typeSol: null })
    mocks.chargerMeteoBilan.mockResolvedValue(meteo())
  })

  it("plant semé dont la plantation est à venir : âge depuis le semis, jamais négatif", async () => {
    mocks.cultures.mockResolvedValue([
      culture(1, { semisFait: true, plantationFaite: false, dateSemis: dans(-21), datePlantation: dans(44) }),
    ])
    const [c] = (await computeConseilIrrigation("u1", new Date().getFullYear())).data
    expect(c.ageJours).toBe(21)
    expect(c.isJeune).toBe(false)
  })

  it("aucune date passée : pas d'âge plutôt qu'un âge négatif", async () => {
    mocks.cultures.mockResolvedValue([
      culture(1, { plantationFaite: true, dateSemis: null, datePlantation: dans(5) }),
    ])
    const [c] = (await computeConseilIrrigation("u1", new Date().getFullYear())).data
    expect(c.ageJours).toBeNull()
    expect(c.isJeune).toBe(false)
  })
})

describe("resumeMeteo : prochaine pluie", () => {
  it("la pluie annoncée aujourd'hui est la prochaine pluie", () => {
    // 15 mm annoncés aujourd'hui, puis 6 mm dans 4 jours : l'écran disait
    // « +15mm prévus (48h) … Prochaine pluie dans 4j ».
    const r = resumeMeteo(meteo(15, [0, 0, 0, 6, 0, 0, 0]))
    expect(r.pluiePrevue48h).toBe(15)
    expect(r.joursAvantPluie).toBe(0)
  })

  it("sans pluie aujourd'hui : le premier jour de prévision arrosé", () => {
    expect(resumeMeteo(meteo(1, [0, 0, 0, 6, 0, 0, 0])).joursAvantPluie).toBe(4)
    expect(resumeMeteo(meteo()).joursAvantPluie).toBe(99)
  })
})
