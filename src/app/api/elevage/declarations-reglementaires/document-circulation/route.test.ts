import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  charger: vi.fn(),
  exploitationFindUnique: vi.fn(),
  preparationFindUnique: vi.fn(),
  preparationUpsert: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/elevage/declarations-reglementaires.server", () => ({
  chargerDeclarationsReglementaires: mocks.charger,
}))
vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: mocks.transaction,
    exploitation: { findUnique: mocks.exploitationFindUnique },
    preparationDocumentCirculation: {
      findUnique: mocks.preparationFindUnique,
      upsert: mocks.preparationUpsert,
    },
    declarationReglementaireEvenement: { create: mocks.auditCreate },
  },
}))

import { GET, PATCH } from "./route"

const declaration = {
  key: "animal:7:SORTIE",
  type: "SORTIE",
  categorie: "CAPRIN",
  organisme: "EDE / Ovinfos",
  dateEvenement: "2026-07-20T00:00:00.000Z",
  dateEcheance: "2026-07-27T23:59:59.999Z",
  joursRestants: 2,
  statut: "A_DECLARER",
  libelle: "Sortie de FR123",
  espece: "Caprin",
  cible: "FR123",
  sourceUrl: "/elevage",
  numeroEde: "EDE-64",
  identifiants: ["FR123"],
  quantite: 1,
  origine: null,
  destination: null,
  anomalies: [],
  transmisAt: null,
  canalTransmission: null,
  referenceTransmission: null,
  notes: null,
  modifieeApresTransmission: false,
  snapshot: {},
  snapshotHash: "declaration-hash",
}

describe("API document de circulation préparatoire", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.charger.mockResolvedValue({
      declarations: [declaration],
      resume: {},
      year: 2026,
      generatedAt: "2026-07-25T00:00:00.000Z",
    })
    mocks.exploitationFindUnique.mockResolvedValue({
      raisonSociale: "Ferme test",
      numeroEde: "EDE-64",
      siren: "123456789",
      adresseSiege: "1 chemin",
      codePostal: "64000",
      ville: "Pau",
    })
    mocks.preparationFindUnique.mockResolvedValue(null)
    mocks.preparationUpsert.mockImplementation(async ({ create }) => create)
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" })
    mocks.transaction.mockImplementation(async (callback) => callback({
      preparationDocumentCirculation: { upsert: mocks.preparationUpsert },
      declarationReglementaireEvenement: { create: mocks.auditCreate },
    }))
  })

  it("retourne les champs manquants sans sortir du tenant", async () => {
    const response = await GET(new NextRequest(
      `http://localhost/api/elevage/declarations-reglementaires/document-circulation?year=2026&key=${encodeURIComponent(declaration.key)}`,
    ))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.charger).toHaveBeenCalledWith("user-1", { year: 2026 })
    expect(mocks.preparationFindUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId_declarationKey: {
          userId: "user-1",
          declarationKey: declaration.key,
        },
      },
    }))
    expect(payload.pret).toBe(false)
    expect(payload.anomalies).toContain("Numéro du transporteur manquant")
  })

  it("enregistre atomiquement la préparation et son événement d’audit", async () => {
    const response = await PATCH(new NextRequest(
      "http://localhost/api/elevage/declarations-reglementaires/document-circulation",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: declaration.key,
          year: 2026,
          typeExploitationEde: "Exploitation d’élevage",
          categorieAnimaux: "NON_DEROGATAIRES",
          tiersNumeroEde: "EDE-33",
          numeroTransporteur: "TRANS-1",
          immatriculationVehicule: "AA-123-BB",
        }),
      },
    ))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.pret).toBe(true)
    expect(mocks.preparationUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId_declarationKey: {
          userId: "user-1",
          declarationKey: declaration.key,
        },
      },
      create: expect.objectContaining({
        userId: "user-1",
        tiersNumeroEde: "EDE-33",
        snapshotHash: expect.any(String),
      }),
    }))
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "DOCUMENT_CIRCULATION_PREPARE",
        userId: "user-1",
        declarationKey: declaration.key,
      }),
    })
  })

  it("génère une fiche PDF explicitement préparatoire et la journalise", async () => {
    mocks.preparationFindUnique.mockResolvedValueOnce({
      numeroDocumentEde: "DOC-2026-001",
      typeExploitationEde: "Exploitation d’élevage",
      categorieAnimaux: "NON_DEROGATAIRES",
      indicatifsMarquage: null,
      tiersNom: "Ferme destinataire",
      tiersNumeroEde: "EDE-33",
      tiersSiren: null,
      tiersAdresse: "2 chemin",
      numeroAgrementSanitaire: null,
      transporteurNom: "Transport test",
      numeroTransporteur: "TRANS-1",
      immatriculationVehicule: "AA-123-BB",
      motifMouvement: "Vente",
      contactDepart: "Départ",
      contactArrivee: "Arrivée",
      notes: null,
      snapshotHash: null,
    })

    const response = await GET(new NextRequest(
      `http://localhost/api/elevage/declarations-reglementaires/document-circulation?year=2026&format=pdf&key=${encodeURIComponent(declaration.key)}`,
    ))
    const bytes = new Uint8Array(await response.arrayBuffer())

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF")
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "DOCUMENT_CIRCULATION_GENERE",
        declarationKey: declaration.key,
      }),
    })
  })

  it("refuse un mouvement bovin", async () => {
    mocks.charger.mockResolvedValueOnce({
      declarations: [{ ...declaration, categorie: "BOVIN" }],
      resume: {},
      year: 2026,
      generatedAt: "2026-07-25T00:00:00.000Z",
    })

    const response = await GET(new NextRequest(
      `http://localhost/api/elevage/declarations-reglementaires/document-circulation?year=2026&key=${encodeURIComponent(declaration.key)}`,
    ))
    expect(response.status).toBe(409)
  })
})
