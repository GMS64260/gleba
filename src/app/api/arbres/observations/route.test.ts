import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * QA cmvgeltj1 (2026-10-20) — le traitement saisi depuis Verger > Santé & Phyto
 * > Registre phyto doit écrire les colonnes que le registre général relit :
 * surface (ha), ZNT, météo structurée, et l'opérateur saisi en texte libre au
 * format relu par `operateurDansNotes`. Corps rejoué : celui de
 * `handleAddSubmit` (SanteTab), champs du formulaire en chaînes.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  arbreFindFirst: vi.fn(),
  parcelleFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
  membreFindFirst: vi.fn(),
  observationCreate: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/observations-sante", () => ({ listerObservationsSante: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  default: {
    arbre: { findFirst: mocks.arbreFindFirst },
    parcelleGeo: { findFirst: mocks.parcelleFindFirst },
    user: { findUnique: mocks.userFindUnique },
    membreExploitation: { findFirst: mocks.membreFindFirst },
    observationSante: { create: mocks.observationCreate },
  },
}))

import { POST } from "./route"
import { operateurDansNotes } from "@/lib/tracabilite/projection-phyto"

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/arbres/observations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
  )

/** Corps envoyé par l'écran pour le traitement du ticket. */
const corpsEcran = (overrides: Record<string, unknown> = {}) => ({
  arbreId: "839",
  date: "2026-10-20",
  type: "ravageur",
  diagnostic: "",
  symptome: "",
  methodeTraitement: "chimique_conventionnel",
  produit: "v8 produit fictif",
  numAMM: "9999999",
  doseAppliquee: "0.5",
  uniteDose: "L/ha",
  dar: "7",
  traitement: "",
  gravite: "faible",
  surfaceTraiteeHa: "0.01",
  volumeBouillieLHa: "500",
  volumeBouillieLTotal: "5",
  certiphytoNum: "TEST-1",
  parcelleId: "parcelle-1",
  operateurId: null,
  operateurNom: "v8-Hélène",
  notes: null,
  zntDistanceM: "20",
  zntRespectee: true,
  temperatureC: 15,
  ventKmh: 5,
  hygrometriePct: 70,
  pluie24h: false,
  pluie24hMm: null,
  epiPortes: ["gants"],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } })
  mocks.arbreFindFirst.mockResolvedValue({ id: 839, userId: "user-1" })
  mocks.parcelleFindFirst.mockResolvedValue({ id: "parcelle-1" })
  mocks.membreFindFirst.mockResolvedValue(null)
  // Un compte tiers existe en base : son existence ne suffit pas.
  mocks.userFindUnique.mockResolvedValue({ id: "user-tiers" })
  mocks.observationCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 70, ...data }))
})

describe("POST /api/arbres/observations — traitement du registre Verger", () => {
  it("écrit surface, ZNT, météo et l'opérateur relisible par le registre général", async () => {
    const res = await post(corpsEcran())
    expect(res.status).toBe(201)
    const data = mocks.observationCreate.mock.calls[0][0].data
    expect(data).toMatchObject({
      surfaceTraiteeHa: 0.01,
      zntDistanceM: 20,
      zntRespectee: true,
      temperatureC: 15,
      ventKmh: 5,
      hygrometriePct: 70,
      pluie24h: false,
      parcelleId: "parcelle-1",
      operateurId: null,
    })
    expect(data.notes).toBe("Opérateur : v8-Hélène")
    expect(operateurDansNotes(data.notes)).toBe("v8-Hélène")
  })

  it("notes saisies conservées, opérateur ajouté une seule fois (ancien écran qui composait la ligne)", async () => {
    await post(corpsEcran({ notes: "Bord du ruisseau" }))
    expect(mocks.observationCreate.mock.calls[0][0].data.notes).toBe("Bord du ruisseau\nOpérateur : v8-Hélène")
    await post(corpsEcran({ notes: "Opérateur : v8-Hélène" }))
    expect(mocks.observationCreate.mock.calls[1][0].data.notes).toBe("Opérateur : v8-Hélène")
  })

  it("méthode chimique sans DAR ni dose : refus qui nomme les champs (même liste que le registre)", async () => {
    const res = await post(corpsEcran({ dar: null, doseAppliquee: null }))
    expect(res.status).toBe(400)
    expect((await res.json()).manquants).toEqual(["Dose", "DAR (jours)"])
    expect(mocks.observationCreate).not.toHaveBeenCalled()
  })

  it("biocontrôle : ni AMM, ni surface, ni DAR exigés", async () => {
    const res = await post(
      corpsEcran({ methodeTraitement: "biocontrole", numAMM: null, surfaceTraiteeHa: null, dar: null, certiphytoNum: null }),
    )
    expect(res.status).toBe(201)
  })

  it("parcelle d'un autre compte : refus qui nomme le champ", async () => {
    mocks.parcelleFindFirst.mockResolvedValue(null)
    const res = await post(corpsEcran({ parcelleId: "parcelle-autre" }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain("parcelleId")
    expect(mocks.parcelleFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "parcelle-autre", userId: "user-1" } }),
    )
    expect(mocks.observationCreate).not.toHaveBeenCalled()
  })
})

/**
 * Revue du 2026-10-20 (cmvgeltj1) — `operateurId` n'était contrôlé que comme
 * compte existant ; le registre affiche le nom de l'opérateur en Applicateur.
 * Un id de compte tiers faisait sortir son nom ou son courriel.
 */
describe("POST /api/arbres/observations — operateurId", () => {
  it("compte tiers, ni titulaire ni membre : 400 qui nomme operateurId, rien n'est écrit", async () => {
    const res = await post({ arbreId: "839", type: "maladie", operateurId: "user-tiers" })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain("operateurId")
    expect(mocks.membreFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { proprietaireId: "user-1", userId: "user-tiers", accepteLe: { not: null }, revoqueLe: null },
      }),
    )
    expect(mocks.observationCreate).not.toHaveBeenCalled()
  })

  it("membre actif de l'exploitation : enregistré", async () => {
    mocks.membreFindFirst.mockResolvedValue({ id: "adhesion-1" })
    const res = await post({ arbreId: "839", type: "maladie", operateurId: "user-membre" })
    expect(res.status).toBe(201)
    expect(mocks.observationCreate.mock.calls[0][0].data.operateurId).toBe("user-membre")
  })

  it("titulaire de l'exploitation : enregistré sans recherche d'adhésion", async () => {
    const res = await post({ arbreId: "839", type: "maladie", operateurId: "user-1" })
    expect(res.status).toBe(201)
    expect(mocks.membreFindFirst).not.toHaveBeenCalled()
    expect(mocks.observationCreate.mock.calls[0][0].data.operateurId).toBe("user-1")
  })
})
