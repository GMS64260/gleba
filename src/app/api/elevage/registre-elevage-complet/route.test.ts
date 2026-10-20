import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { unzipSync } from "fflate"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  exploitationFindUnique: vi.fn(),
  animalFindMany: vi.fn(),
  lotFindMany: vi.fn(),
  naissanceFindMany: vi.fn(),
  abattageFindMany: vi.fn(),
  soinFindMany: vi.fn(),
  prophylaxieFindMany: vi.fn(),
  stockFindMany: vi.fn(),
  consommationAlimentFindMany: vi.fn(),
  justificatifAlimentFindMany: vi.fn(),
  justificatifEquarrissageFindMany: vi.fn(),
  chargerDeclarations: vi.fn(),
  auditCreate: vi.fn(),
  archiveCreate: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
  transaction: vi.fn(),
  reconstituerEffectifsLots: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("node:fs/promises", async (importOriginal) => ({
  ...await importOriginal<typeof import("node:fs/promises")>(),
  mkdir: mocks.mkdir,
  writeFile: mocks.writeFile,
  unlink: mocks.unlink,
}))
vi.mock("@/lib/prisma", () => ({
  default: {
    exploitation: { findUnique: mocks.exploitationFindUnique },
    animal: { findMany: mocks.animalFindMany },
    lotAnimaux: { findMany: mocks.lotFindMany },
    naissanceAnimale: { findMany: mocks.naissanceFindMany },
    abattage: { findMany: mocks.abattageFindMany },
    soinAnimal: { findMany: mocks.soinFindMany },
    prophylaxieElevage: { findMany: mocks.prophylaxieFindMany },
    stockMedicamentElevage: { findMany: mocks.stockFindMany },
    consommationAliment: { findMany: mocks.consommationAlimentFindMany },
    justificatifAlimentElevage: { findMany: mocks.justificatifAlimentFindMany },
    justificatifEquarrissageElevage: {
      findMany: mocks.justificatifEquarrissageFindMany,
    },
    archiveRegistreElevage: { create: mocks.archiveCreate },
    declarationReglementaireEvenement: { create: mocks.auditCreate },
    $transaction: mocks.transaction,
  },
}))
vi.mock("@/lib/elevage/declarations-reglementaires.server", () => ({
  chargerDeclarationsReglementaires: mocks.chargerDeclarations,
}))
vi.mock("@/lib/elevage/effectif", () => ({ reconstituerEffectifsLots: mocks.reconstituerEffectifsLots }))
// Empreinte réelle, espionnée pour relire les mouvements (le PDF est compressé).
vi.mock("@/lib/elevage/declarations-reglementaires", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/elevage/declarations-reglementaires")>()
  return { ...actual, empreinteDeclaration: vi.fn(actual.empreinteDeclaration) }
})

import { GET } from "./route"
import { empreinteDeclaration } from "@/lib/elevage/declarations-reglementaires"

describe("registre d'élevage complet", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: "user-1" } },
    })
    mocks.exploitationFindUnique.mockResolvedValue(null)
    mocks.animalFindMany.mockResolvedValue([])
    mocks.lotFindMany.mockResolvedValue([])
    mocks.reconstituerEffectifsLots.mockResolvedValue(new Map())
    mocks.naissanceFindMany.mockResolvedValue([])
    mocks.abattageFindMany.mockResolvedValue([])
    mocks.soinFindMany.mockResolvedValue([])
    mocks.prophylaxieFindMany.mockResolvedValue([])
    mocks.stockFindMany.mockResolvedValue([])
    mocks.consommationAlimentFindMany.mockResolvedValue([])
    mocks.justificatifAlimentFindMany.mockResolvedValue([])
    mocks.justificatifEquarrissageFindMany.mockResolvedValue([])
    mocks.chargerDeclarations.mockResolvedValue({
      year: 2026,
      generatedAt: "2026-07-25T00:00:00.000Z",
      declarations: [],
      resume: {
        total: 0,
        aCompleter: 0,
        aDeclarer: 0,
        horsDelai: 0,
        transmises: 0,
        modifieesApresTransmission: 0,
      },
    })
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" })
    mocks.archiveCreate.mockResolvedValue({ id: "archive-1" })
    mocks.mkdir.mockResolvedValue(undefined)
    mocks.writeFile.mockResolvedValue(undefined)
    mocks.unlink.mockResolvedValue(undefined)
    mocks.transaction.mockImplementation(async (callback) => callback({
      archiveRegistreElevage: { create: mocks.archiveCreate },
      declarationReglementaireEvenement: { create: mocks.auditCreate },
    }))
  })

  it("génère un PDF paginé même lorsque le registre est vide", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/registre-elevage-complet?year=2026",
    ))

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(response.headers.get("content-disposition")).toContain("registre-elevage-complet-2026.pdf")
    const bytes = new Uint8Array(await response.arrayBuffer())
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF")
    expect(mocks.chargerDeclarations).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ year: 2026 }),
    )
    expect(mocks.exploitationFindUnique).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      include: expect.objectContaining({
        lieuxDetentionElevage: expect.any(Object),
        intervenantsElevage: expect.any(Object),
      }),
    })
    expect(mocks.animalFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "user-1" }) }),
    )
    expect(mocks.justificatifAlimentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "user-1" }) }),
    )
    expect(mocks.justificatifEquarrissageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "user-1" }) }),
    )
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "REGISTRE_COMPLET_GENERE",
        declarationKey: "registre-complet:2026",
        snapshotHash: expect.any(String),
      }),
    })
  })

  it("intègre les lieux et l’encadrement structurés au registre et à son empreinte", async () => {
    mocks.exploitationFindUnique.mockResolvedValueOnce({
      id: "exploitation-1",
      raisonSociale: "Ferme des coteaux",
      formeJuridique: "EARL",
      territoire: "METROPOLE",
      siret: null,
      identifiantLegal: null,
      adresseSiege: "1 chemin des prés",
      codePostal: "64000",
      ville: "Pau",
      pays: "France",
      numeroEde: "EDE-64",
      lieuDetentionPrincipal: null,
      veterinaireSanitaire: null,
      emailContact: "ferme@example.test",
      telContact: null,
      updatedAt: new Date("2026-07-26T08:00:00.000Z"),
      lieuxDetentionElevage: [{
        id: "lieu-1",
        exploitationId: "exploitation-1",
        parentId: null,
        parent: null,
        type: "SITE",
        nom: "Site principal",
        numeroEde: "EDE-64",
        adresse: "1 chemin des prés",
        codePostal: "64000",
        ville: "Pau",
        especes: ["Caprins"],
        usages: "Chèvrerie et salle de traite",
        planMasseUrl: "/documents/plan-masse.pdf",
        archivedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-07-26T08:00:00.000Z"),
      }],
      intervenantsElevage: [{
        id: "intervenant-1",
        exploitationId: "exploitation-1",
        role: "VETERINAIRE_SANITAIRE",
        statut: "ACTIF",
        nom: "Dr Martin",
        fonction: null,
        organisme: "Clinique des Pyrénées",
        adresse: "2 rue du cabinet, 64000 Pau",
        email: null,
        telephone: null,
        especes: ["Caprins"],
        typesProduction: ["Lait"],
        dateDebut: new Date("2026-01-01T00:00:00.000Z"),
        dateFin: null,
        perimetreDelegation: null,
        archivedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-07-26T08:00:00.000Z"),
      }],
    })
    mocks.consommationAlimentFindMany.mockResolvedValueOnce([{
      id: 1,
      userId: "user-1",
      alimentId: "foin",
      aliment: { id: "foin", nom: "Foin" },
      animalId: null,
      animal: null,
      lotId: 1,
      lot: { id: 1, nom: "Chèvres laitières" },
      date: new Date("2026-07-20T00:00:00.000Z"),
      quantite: 25,
      notes: null,
      createdAt: new Date("2026-07-20T00:00:00.000Z"),
    }])
    mocks.justificatifAlimentFindMany.mockResolvedValueOnce([{
      id: "justificatif-1",
      userId: "user-1",
      alimentId: "foin",
      aliment: { id: "foin", nom: "Foin" },
      typeDocument: "FACTURE",
      dateDocument: new Date("2026-07-20T00:00:00.000Z"),
      reference: "FAC-2026-018",
      fournisseur: "Coopérative locale",
      numeroLot: "FOIN-07",
      fichierUrl: "/api/upload/justificatif/123e4567-e89b-42d3-a456-426614174000.pdf",
      nomFichier: "facture-foin.pdf",
      tailleOctets: 2048,
      empreinteSha256: "a".repeat(64),
      notes: null,
      archivedAt: null,
      createdAt: new Date("2026-07-26T00:00:00.000Z"),
      updatedAt: new Date("2026-07-26T00:00:00.000Z"),
    }])
    mocks.animalFindMany.mockResolvedValueOnce([{
      id: 12,
      identifiant: "FR6400012345",
      nom: null,
      sexe: "femelle",
      race: "Alpine",
      statut: "mort",
      dateNaissance: new Date("2022-03-01T00:00:00.000Z"),
      dateArrivee: new Date("2022-03-01T00:00:00.000Z"),
      dateSortie: new Date("2026-07-23T00:00:00.000Z"),
      provenance: "Née sur l’exploitation",
      nExploitationOrigine: null,
      nExploitationDestination: null,
      motifSortie: "Mort",
      causeSortie: "Maladie",
      ficheNaissance: { id: 1 },
      lot: { nom: "Chèvres laitières" },
      especeAnimale: { nom: "Caprin" },
      raceAnimale: { nom: "Alpine" },
    }])
    mocks.justificatifEquarrissageFindMany.mockResolvedValueOnce([{
      id: "equarrissage-1",
      userId: "user-1",
      typeDocument: "BON_ENLEVEMENT",
      dateEnlevement: new Date("2026-07-24T00:00:00.000Z"),
      nombreAnimauxNonIdentifies: 0,
      typeAnimauxNonIdentifies: null,
      reference: "BE-2026-0042",
      prestataire: "Équarrissage régional",
      fichierUrl: "/api/upload/justificatif/123e4567-e89b-42d3-a456-426614174001.pdf",
      nomFichier: "bon-enlevement.pdf",
      tailleOctets: 4096,
      empreinteSha256: "b".repeat(64),
      notes: null,
      archivedAt: null,
      createdAt: new Date("2026-07-26T00:00:00.000Z"),
      updatedAt: new Date("2026-07-26T00:00:00.000Z"),
      animaux: [{
        animalId: 12,
        animal: {
          id: 12,
          identifiant: "FR6400012345",
          nom: null,
          dateSortie: new Date("2026-07-23T00:00:00.000Z"),
          causeSortie: "Maladie",
          especeAnimale: { nom: "Caprin" },
        },
      }],
    }])

    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/registre-elevage-complet?year=2026",
    ))

    expect(response.status).toBe(200)
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "REGISTRE_COMPLET_GENERE",
        metadata: expect.objectContaining({
          lieuxDetention: 1,
          intervenants: 1,
          distributionsAliments: 1,
          justificatifsAliments: 1,
          mortalites: 1,
          justificatifsEquarrissage: 1,
          mortalitesSansBon: 0,
        }),
      }),
    })
  })

  it("rejette une année hors bornes avant toute lecture métier", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/registre-elevage-complet?year=1980",
    ))

    expect(response.status).toBe(400)
    expect(mocks.animalFindMany).not.toHaveBeenCalled()
  })

  it("fige un ZIP avec manifeste puis journalise son archivage", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/registre-elevage-complet?year=2026&format=archive",
    ))

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/zip")
    expect(response.headers.get("x-gleba-archive-id")).toBe("archive-1")
    expect(response.headers.get("x-gleba-archive-sha256")).toMatch(/^[a-f0-9]{64}$/)
    const fichiers = unzipSync(new Uint8Array(await response.arrayBuffer()))
    expect(Object.keys(fichiers)).toEqual(expect.arrayContaining([
      "registre-elevage-complet-2026.pdf",
      "MANIFESTE.json",
      "LISEZ-MOI.txt",
    ]))
    expect(mocks.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/storage\/registres\/user-1\/.+\.zip$/),
      expect.any(Buffer),
      { flag: "wx" },
    )
    expect(mocks.archiveCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        annee: 2026,
        archiveSha256: expect.any(String),
        annexesIncluses: 0,
        annexesSignalees: 0,
      }),
    })
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "REGISTRE_COMPLET_ARCHIVE",
        declarationKey: "registre-complet:2026",
        metadata: expect.objectContaining({ archiveId: "archive-1" }),
      }),
    })
  })

  it("rejette un format d’export inconnu avant toute lecture métier", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/registre-elevage-complet?year=2026&format=tar",
    ))

    expect(response.status).toBe(400)
    expect(mocks.animalFindMany).not.toHaveBeenCalled()
  })

  it("supprime le ZIP préparé si la transaction d’archivage échoue", async () => {
    mocks.transaction.mockRejectedValueOnce(new Error("base indisponible"))

    await expect(GET(new NextRequest(
      "http://localhost/api/elevage/registre-elevage-complet?year=2026&format=archive",
    ))).rejects.toThrow("base indisponible")

    expect(mocks.writeFile).toHaveBeenCalled()
    expect(mocks.unlink).toHaveBeenCalledWith(
      expect.stringMatching(/storage\/registres\/user-1\/.+\.zip$/),
    )
  })

  // Revue 2026-10-20 — l'inventaire retenait les lots sur le compteur stocké
  // `quantiteActuelle > 0` et la sortie d'un lot réformé inscrivait ce
  // compteur, qui dérive. Les deux suivent l'effectif reconstitué.
  it("retient les lots et chiffre les réformes sur l'effectif reconstitué", async () => {
    const espece = { nom: "Pintade perle" }
    const lot = (id: number, nom: string, quantiteActuelle: number, statut: string, dateReforme: Date | null) => ({
      id, nom, quantiteInitiale: 2, quantiteActuelle, statut, dateReforme,
      dateArrivee: new Date("2025-08-17T00:00:00.000Z"), provenance: null,
      updatedAt: new Date("2026-10-20T00:00:00.000Z"), especeAnimale: espece,
    })
    const pintades = lot(71, "Pintades perle A3 1708", 5, "actif", null) // compteur 5, effectif 4
    const fiches = lot(90, "Lot de fiches", 0, "actif", null) // compteur 0, 2 fiches rattachées
    const fantome = lot(91, "Lot vidé", 1, "actif", null) // compteur 1, effectif 0
    const fantome2 = lot(94, "Lot vidé 2", 2, "actif", null) // compteur 2, effectif 0
    const reformeForcee = lot(92, "Canards 2025", 6, "reforme", new Date("2026-06-01T00:00:00.000Z")) // réforme forcée avec 5 têtes
    const reformeSolde = lot(93, "Lapins 2025", 1, "reforme", new Date("2026-07-01T00:00:00.000Z")) // soldé, compteur dérivé
    mocks.lotFindMany.mockResolvedValue([pintades, fiches, fantome, fantome2, reformeForcee, reformeSolde])
    mocks.reconstituerEffectifsLots.mockResolvedValue(new Map([
      [71, { effectifCalcule: 4, nominatifsActifs: 0, effectifCollectif: 4 }],
      [90, { effectifCalcule: 2, nominatifsActifs: 2, effectifCollectif: 0 }],
      [91, { effectifCalcule: 0, nominatifsActifs: 0, effectifCollectif: 0 }],
      [94, { effectifCalcule: 0, nominatifsActifs: 0, effectifCollectif: 0 }],
      [92, { effectifCalcule: 5, nominatifsActifs: 0, effectifCollectif: 5 }],
      [93, { effectifCalcule: 0, nominatifsActifs: 0, effectifCollectif: 0 }],
    ]))

    const response = await GET(new NextRequest(
      "http://localhost/api/elevage/registre-elevage-complet?year=2026",
    ))
    expect(response.status).toBe(200)

    expect(mocks.reconstituerEffectifsLots).toHaveBeenCalledWith(
      "user-1", [pintades, fiches, fantome, fantome2, reformeForcee, reformeSolde],
    )
    // Lots présents : 71 et 90 (le compteur retenait 71, 91 et 94).
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ metadata: expect.objectContaining({ lots: 2 }) }),
    })
    const { mouvements } = vi.mocked(empreinteDeclaration).mock.calls[0][0] as {
      mouvements: Array<{ type: string; cible: string; motif: string }>
    }
    expect(mouvements.filter((m) => m.type === "Sortie lot").map((m) => [m.cible, m.motif])).toEqual([
      ["Canards 2025 ×5", "Réforme / fin de lot"],
      ["Lapins 2025 (soldé)", "Réforme / fin de lot, têtes déjà sorties"],
    ])
  })
})
