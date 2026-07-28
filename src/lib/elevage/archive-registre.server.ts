import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { strToU8, zipSync, type Zippable } from "fflate"
import { URL_FICHIER_JUSTIFICATIF } from "./fichier-justificatif"

export const TAILLE_MAX_ANNEXES_ARCHIVE = 100 * 1024 * 1024

export type PieceArchiveRegistre = {
  sourceType: string
  sourceId: string
  type: string
  date: Date
  libelle: string
  reference: string
  fichierUrl?: string | null
  nomFichier?: string | null
  empreinteSha256?: string | null
}
export type StatutAnnexeArchive =
  | "INCLUSE"
  | "REFERENCE_SEULE"
  | "FICHIER_INTROUVABLE"
  | "EMPREINTE_DIVERGENTE"
  | "LIMITE_TAILLE_DEPASSEE"

export type AnnexeManifesteRegistre = {
  sourceType: string
  sourceId: string
  type: string
  date: string
  libelle: string
  reference: string
  nomFichier: string | null
  cheminArchive: string | null
  tailleOctets: number | null
  empreinteAttendueSha256: string | null
  empreinteCalculeeSha256: string | null
  statut: StatutAnnexeArchive
}

export type ManifesteArchiveRegistre = {
  versionFormat: 1
  nature: "DOSSIER_REGISTRE_ELEVAGE_GLEBA"
  annee: number
  periode: { debut: string; fin: string }
  genereLe: string
  snapshotDonneesSha256: string
  registre: {
    cheminArchive: string
    tailleOctets: number
    empreinteSha256: string
  }
  annexes: AnnexeManifesteRegistre[]
  resume: {
    referencees: number
    incluses: number
    signalees: number
    tailleIncluseOctets: number
  }
  manquesRegistre: string[]
  avertissement: string
}

const empreinte = (contenu: Uint8Array) =>
  createHash("sha256").update(contenu).digest("hex")

const nomArchiveSur = (value: string, fallback: string) => {
  const nettoye = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
  return nettoye || fallback
}

const extensionDepuisUrl = (url: string) => {
  const extension = path.extname(url).toLowerCase()
  return [".pdf", ".jpg", ".png"].includes(extension) ? extension : ""
}

export async function construireArchiveRegistre(options: {
  userId: string
  annee: number
  debut: Date
  fin: Date
  genereLe: Date
  snapshotHash: string
  pdf: Buffer
  pieces: PieceArchiveRegistre[]
  manques: string[]
}) {
  const nomPdf = `registre-elevage-complet-${options.annee}.pdf`
  const fichiers: Zippable = {
    [nomPdf]: [new Uint8Array(options.pdf), { level: 0, mtime: options.genereLe }],
  }
  const annexes: AnnexeManifesteRegistre[] = []
  let tailleIncluseOctets = 0

  for (const [index, piece] of options.pieces.entries()) {
    const annexeBase = {
      sourceType: piece.sourceType,
      sourceId: piece.sourceId,
      type: piece.type,
      date: piece.date.toISOString(),
      libelle: piece.libelle,
      reference: piece.reference,
      nomFichier: piece.nomFichier ?? null,
      cheminArchive: null,
      tailleOctets: null,
      empreinteAttendueSha256: piece.empreinteSha256 ?? null,
      empreinteCalculeeSha256: null,
    }
    if (!piece.fichierUrl || !URL_FICHIER_JUSTIFICATIF.test(piece.fichierUrl)) {
      annexes.push({ ...annexeBase, statut: "REFERENCE_SEULE" })
      continue
    }

    const stockageNom = piece.fichierUrl.slice(piece.fichierUrl.lastIndexOf("/") + 1)
    let contenu: Buffer
    try {
      contenu = await readFile(path.join(
        process.cwd(),
        "storage",
        "justificatifs",
        options.userId,
        stockageNom,
      ))
    } catch {
      annexes.push({ ...annexeBase, statut: "FICHIER_INTROUVABLE" })
      continue
    }

    const empreinteCalculeeSha256 = empreinte(contenu)
    const extension = path.extname(piece.nomFichier || "")
      || extensionDepuisUrl(piece.fichierUrl)
    const nomOriginal = nomArchiveSur(
      piece.nomFichier || `${piece.sourceType}-${piece.sourceId}${extension}`,
      `annexe-${index + 1}${extension}`,
    )
    const cheminArchive = `annexes/${String(index + 1).padStart(3, "0")}-${nomOriginal}`
    if (tailleIncluseOctets + contenu.byteLength > TAILLE_MAX_ANNEXES_ARCHIVE) {
      annexes.push({
        ...annexeBase,
        tailleOctets: contenu.byteLength,
        empreinteCalculeeSha256,
        statut: "LIMITE_TAILLE_DEPASSEE",
      })
      continue
    }

    fichiers[cheminArchive] = [
      new Uint8Array(contenu),
      { level: 0, mtime: options.genereLe },
    ]
    tailleIncluseOctets += contenu.byteLength
    annexes.push({
      ...annexeBase,
      cheminArchive,
      tailleOctets: contenu.byteLength,
      empreinteCalculeeSha256,
      statut:
        piece.empreinteSha256
        && piece.empreinteSha256 !== empreinteCalculeeSha256
          ? "EMPREINTE_DIVERGENTE"
          : "INCLUSE",
    })
  }

  const incluses = annexes.filter((annexe) => annexe.cheminArchive).length
  const signalees = annexes.filter((annexe) => annexe.statut !== "INCLUSE").length
  const manifeste: ManifesteArchiveRegistre = {
    versionFormat: 1,
    nature: "DOSSIER_REGISTRE_ELEVAGE_GLEBA",
    annee: options.annee,
    periode: {
      debut: options.debut.toISOString(),
      fin: options.fin.toISOString(),
    },
    genereLe: options.genereLe.toISOString(),
    snapshotDonneesSha256: options.snapshotHash,
    registre: {
      cheminArchive: nomPdf,
      tailleOctets: options.pdf.byteLength,
      empreinteSha256: empreinte(options.pdf),
    },
    annexes,
    resume: {
      referencees: annexes.length,
      incluses,
      signalees,
      tailleIncluseOctets,
    },
    manquesRegistre: options.manques,
    avertissement:
      "Ce dossier reflète les données enregistrées dans Gleba à sa date de génération. "
      + "Il ne vaut ni transmission ni acceptation par un organisme officiel.",
  }
  fichiers["MANIFESTE.json"] = [
    strToU8(`${JSON.stringify(manifeste, null, 2)}\n`),
    { level: 6, mtime: options.genereLe },
  ]
  fichiers["LISEZ-MOI.txt"] = [
    strToU8(
      "DOSSIER REGLEMENTAIRE D'ELEVAGE GLEBA\n\n"
      + `Période : ${options.annee}\n`
      + `Généré le : ${options.genereLe.toISOString()}\n`
      + `Empreinte des données : ${options.snapshotHash}\n\n`
      + "MANIFESTE.json décrit chaque fichier, son empreinte SHA-256 et les pièces "
      + "qui n'ont pas pu être incorporées. Conserver ce ZIP sans le modifier.\n",
    ),
    { level: 6, mtime: options.genereLe },
  ]

  const archive = Buffer.from(zipSync(fichiers, { level: 6 }))
  return {
    archive,
    archiveSha256: empreinte(archive),
    manifeste,
    annexesIncluses: incluses,
    annexesSignalees: signalees,
  }
}
