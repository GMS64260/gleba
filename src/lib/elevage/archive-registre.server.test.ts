import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { unzipSync } from "fflate"
import { construireArchiveRegistre } from "./archive-registre.server"

const dossiersTemporaires: string[] = []
const cwdInitial = process.cwd()

afterEach(async () => {
  vi.restoreAllMocks()
  process.chdir(cwdInitial)
  await Promise.all(dossiersTemporaires.splice(0).map((dossier) =>
    rm(dossier, { recursive: true, force: true })
  ))
})

async function environnementFichier(contenu: string) {
  const racine = await mkdtemp(path.join(os.tmpdir(), "gleba-registre-"))
  dossiersTemporaires.push(racine)
  const userId = "user-1"
  const dossier = path.join(racine, "storage", "justificatifs", userId)
  await mkdir(dossier, { recursive: true })
  const stockageNom = "123e4567-e89b-42d3-a456-426614174000.pdf"
  await writeFile(path.join(dossier, stockageNom), contenu)
  process.chdir(racine)
  return { userId, url: `/api/upload/justificatif/${stockageNom}` }
}

describe("archive réglementaire du registre d’élevage", () => {
  it("incorpore une pièce privée et produit un manifeste vérifiable", async () => {
    const fichier = await environnementFichier("preuve équarrissage")
    const resultat = await construireArchiveRegistre({
      userId: fichier.userId,
      annee: 2026,
      debut: new Date("2026-01-01T00:00:00.000Z"),
      fin: new Date("2027-01-01T00:00:00.000Z"),
      genereLe: new Date("2026-07-26T12:00:00.000Z"),
      snapshotHash: "a".repeat(64),
      pdf: Buffer.from("%PDF-registre"),
      pieces: [{
        sourceType: "JUSTIFICATIF_EQUARRISSAGE",
        sourceId: "bon-1",
        type: "Bon d’enlèvement",
        date: new Date("2026-07-25T00:00:00.000Z"),
        libelle: "Bon bovin FR001",
        reference: "BE-42",
        fichierUrl: fichier.url,
        nomFichier: "Bon enlèvement été.pdf",
        empreinteSha256:
          "1af7ca2c22e20adffdf514a5398244fb77c0a0e2fd6123e3d7a2976bb77a53cd",
      }],
      manques: [],
    })

    const fichiers = unzipSync(new Uint8Array(resultat.archive))
    expect(Object.keys(fichiers)).toEqual(expect.arrayContaining([
      "registre-elevage-complet-2026.pdf",
      "MANIFESTE.json",
      "LISEZ-MOI.txt",
      "annexes/001-Bon-enlevement-ete.pdf",
    ]))
    const manifeste = JSON.parse(new TextDecoder().decode(fichiers["MANIFESTE.json"]))
    expect(manifeste.snapshotDonneesSha256).toBe("a".repeat(64))
    expect(manifeste.annexes[0]).toMatchObject({
      statut: "EMPREINTE_DIVERGENTE",
      cheminArchive: "annexes/001-Bon-enlevement-ete.pdf",
    })
    expect(resultat.archiveSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(resultat.annexesIncluses).toBe(1)
    expect(resultat.annexesSignalees).toBe(1)
  })

  it("signale sans accès réseau les références non privées et les fichiers absents", async () => {
    const racine = await mkdtemp(path.join(os.tmpdir(), "gleba-registre-"))
    dossiersTemporaires.push(racine)
    process.chdir(racine)
    const resultat = await construireArchiveRegistre({
      userId: "user-1",
      annee: 2026,
      debut: new Date("2026-01-01T00:00:00.000Z"),
      fin: new Date("2027-01-01T00:00:00.000Z"),
      genereLe: new Date("2026-07-26T12:00:00.000Z"),
      snapshotHash: "b".repeat(64),
      pdf: Buffer.from("%PDF-registre"),
      pieces: [
        {
          sourceType: "ORDONNANCE",
          sourceId: "soin-1",
          type: "Ordonnance",
          date: new Date("2026-02-01T00:00:00.000Z"),
          libelle: "Ordonnance externe",
          reference: "https://documents.example/ordonnance.pdf",
          fichierUrl: "https://documents.example/ordonnance.pdf",
        },
        {
          sourceType: "JUSTIFICATIF_ALIMENT",
          sourceId: "aliment-1",
          type: "Facture",
          date: new Date("2026-03-01T00:00:00.000Z"),
          libelle: "Facture",
          reference: "FAC-1",
          fichierUrl:
            "/api/upload/justificatif/123e4567-e89b-42d3-a456-426614174000.pdf",
        },
      ],
      manques: [],
    })

    expect(resultat.manifeste.annexes.map((annexe) => annexe.statut)).toEqual([
      "REFERENCE_SEULE",
      "FICHIER_INTROUVABLE",
    ])
    expect(resultat.annexesIncluses).toBe(0)
    expect(resultat.annexesSignalees).toBe(2)
  })
})
