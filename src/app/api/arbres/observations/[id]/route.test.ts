import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Revue du lot QA du 2026-10-20 (cmvgeltj1) — PUT d'un traitement du registre
 * Verger : une ligne « Non conforme » doit rester corrigeable champ par champ
 * (dialogue d'édition, surface comprise), une modification ne vide pas un champ
 * réglementaire, et l'opérateur désigné appartient à l'exploitation.
 */

const mocks = vi.hoisted(() => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  historiqueCreate: vi.fn<(args: { data: Record<string, any> }) => Promise<object>>(async () => ({})),
  observationDelete: vi.fn(async () => ({})),
  requireAuthApi: vi.fn(),
  observationFindFirst: vi.fn(),
  observationUpdate: vi.fn(),
  arbreFindFirst: vi.fn(),
  parcelleFindFirst: vi.fn(),
  membreFindFirst: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => {
  const db: Record<string, unknown> = {
    observationSante: { findFirst: mocks.observationFindFirst, update: mocks.observationUpdate, delete: mocks.observationDelete },
    arbre: { findFirst: mocks.arbreFindFirst },
    parcelleGeo: { findFirst: mocks.parcelleFindFirst },
    membreExploitation: { findFirst: mocks.membreFindFirst },
    // Historique du registre (revue de conformité du 2026-11-12, C3).
    registrePhytoHistorique: { create: mocks.historiqueCreate },
  }
  db.$transaction = (fn: (tx: unknown) => unknown) => fn(db)
  return { default: db }
})

import { DELETE, PUT } from "./route"
import { NextRequest } from "next/server"

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

// Revue de conformité du 2026-11-12 (C3) : arrêté du 24 décembre 2025, art. 3.
describe("historique des rectifications d'un traitement du verger", () => {
  it("PUT : l'état d'avant est journalisé avec le motif", async () => {
    const res = await put(corpsEdition({ doseAppliquee: "0.6", motif: "Dose corrigée" }))
    expect(res.status).toBe(200)
    const { data } = mocks.historiqueCreate.mock.calls[0][0]
    expect(data).toMatchObject({ source: "observation_sante", sourceId: 70, action: "modification", motif: "Dose corrigée" })
    expect(data.avant.doseAppliquee).toBe(0.5)
  })

  it("DELETE : l'état complet est journalisé avant la suppression", async () => {
    const res = await DELETE(
      new NextRequest("http://localhost/api/arbres/observations/70?motif=Erreur", { method: "DELETE" }),
      { params: Promise.resolve({ id: "70" }) },
    )
    expect(res.status).toBe(200)
    expect(mocks.historiqueCreate.mock.calls[0][0].data).toMatchObject({ action: "suppression", motif: "Erreur" })
    expect(mocks.historiqueCreate.mock.invocationCallOrder[0]).toBeLessThan(mocks.observationDelete.mock.invocationCallOrder[0])
  })

  it("DELETE d'une simple observation (sans traitement) : rien n'est journalisé", async () => {
    mocks.observationFindFirst.mockResolvedValue({ id: 70, userId: "user-1", methodeTraitement: null, produit: null, numAMM: null })
    await DELETE(new NextRequest("http://localhost/api/arbres/observations/70", { method: "DELETE" }), {
      params: Promise.resolve({ id: "70" }),
    })
    expect(mocks.historiqueCreate).not.toHaveBeenCalled()
  })
})
