import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Revue du lot QA du 2026-10-20 (cmvgeltj1) — PUT d'un traitement du registre
 * Verger : une ligne « Non conforme » doit rester corrigeable champ par champ
 * (dialogue d'édition, surface comprise), une modification ne vide pas un champ
 * réglementaire, et l'opérateur désigné appartient à l'exploitation.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  observationFindFirst: vi.fn(),
  observationUpdate: vi.fn(),
  arbreFindFirst: vi.fn(),
  parcelleFindFirst: vi.fn(),
  membreFindFirst: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    observationSante: { findFirst: mocks.observationFindFirst, update: mocks.observationUpdate },
    arbre: { findFirst: mocks.arbreFindFirst },
    parcelleGeo: { findFirst: mocks.parcelleFindFirst },
    membreExploitation: { findFirst: mocks.membreFindFirst },
  },
}))

import { PUT } from "./route"

const put = (body: unknown) =>
  PUT(
    new Request("http://localhost/api/arbres/observations/70", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ id: "70" }) },
  )

/** Traitement chimique complet, tel qu'en base. */
const complet = {
  id: 70,
  userId: "user-1",
  methodeTraitement: "chimique_conventionnel",
  produit: "Produit test",
  numAMM: "9999999",
  doseAppliquee: 0.5,
  uniteDose: "L/ha",
  dar: 7,
  surfaceTraiteeHa: 0.01,
  volumeBouillieLHa: 500,
  volumeBouillieLTotal: 5,
  temperatureC: 15,
  ventKmh: 5,
  hygrometriePct: 70,
  pluie24h: false,
  certiphytoNum: "TEST-1",
  zntRespectee: true,
  dateResolution: null,
}

/** Corps du dialogue « Modifier les données phyto » (handleEditSubmit). */
const corpsEdition = (overrides: Record<string, unknown> = {}) => ({
  produit: "Produit test",
  numAMM: "9999999",
  doseAppliquee: "0.5",
  uniteDose: "L/ha",
  dar: "7",
  surfaceTraiteeHa: "0.01",
  traitement: null,
  methodeTraitement: "chimique_conventionnel",
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } })
  mocks.observationFindFirst.mockResolvedValue(complet)
  mocks.observationUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...complet, ...data }))
  mocks.membreFindFirst.mockResolvedValue(null)
})

describe("PUT /api/arbres/observations/[id] — conformité réglementaire", () => {
  it("corrige la surface d'une ligne ancienne à laquelle manquent aussi les relevés météo", async () => {
    mocks.observationFindFirst.mockResolvedValue({
      ...complet,
      surfaceTraiteeHa: null,
      temperatureC: null,
      ventKmh: null,
      hygrometriePct: null,
    })
    const res = await put(corpsEdition({ surfaceTraiteeHa: "0.02" }))
    expect(res.status).toBe(200)
    expect(mocks.observationUpdate.mock.calls[0][0].data.surfaceTraiteeHa).toBe(0.02)
  })

  it("refuse de vider un champ exigé (DAR) et le nomme", async () => {
    const res = await put(corpsEdition({ dar: null }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.manquants).toEqual(["DAR (jours)"])
    expect(mocks.observationUpdate).not.toHaveBeenCalled()
  })

  it("passer un biocontrôle en méthode chimique exige ses champs", async () => {
    mocks.observationFindFirst.mockResolvedValue({
      ...complet,
      methodeTraitement: "biocontrole",
      numAMM: null,
      surfaceTraiteeHa: null,
      certiphytoNum: null,
    })
    const res = await put({ methodeTraitement: "chimique_conventionnel" })
    expect(res.status).toBe(400)
    expect((await res.json()).manquants).toEqual(["N° AMM", "Surface traitée (ha)", "N° Certiphyto opérateur"])
  })

  it("un biocontrôle se modifie sans exigence de surface ni de DAR", async () => {
    mocks.observationFindFirst.mockResolvedValue({ ...complet, methodeTraitement: "biocontrole", surfaceTraiteeHa: null, dar: null })
    const res = await put(corpsEdition({ methodeTraitement: "biocontrole", surfaceTraiteeHa: null, dar: null, numAMM: null }))
    expect(res.status).toBe(200)
  })
})

describe("PUT /api/arbres/observations/[id] — clés étrangères", () => {
  it("operateurId d'un compte tiers : 400 qui nomme operateurId", async () => {
    const res = await put({ operateurId: "user-tiers" })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain("operateurId")
    expect(mocks.observationUpdate).not.toHaveBeenCalled()
  })

  it("operateurId d'un membre actif : enregistré", async () => {
    mocks.membreFindFirst.mockResolvedValue({ id: "adhesion-1" })
    const res = await put({ operateurId: "user-membre" })
    expect(res.status).toBe(200)
    expect(mocks.observationUpdate.mock.calls[0][0].data.operateurId).toBe("user-membre")
  })

  it("parcelle d'un autre compte : 400 qui nomme parcelleId", async () => {
    mocks.parcelleFindFirst.mockResolvedValue(null)
    const res = await put({ parcelleId: "parcelle-autre" })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain("parcelleId")
  })
})
