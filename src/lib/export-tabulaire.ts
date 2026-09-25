/**
 * Export tabulaire du compte : une archive ZIP contenant un CSV par table de
 * données de l'utilisateur (maraîchage, verger, élevage, gestion, stocks…).
 *
 * Signalement du 2026-09-25 : le bouton « CSV » des paramètres enregistrait
 * sous un nom en `.zip` une réponse JSON — aucune archive n'était jamais
 * produite, l'Utilitaire d'archive de macOS la refusait — et l'export ne lisait
 * que le potager, les arbres et les référentiels : un éleveur n'y trouvait
 * aucun de ses animaux. La liste des tables vient désormais du même moteur que
 * la sauvegarde complète (`exportAccount`, piloté par le schéma Prisma) : une
 * table ajoutée plus tard entre dans l'export sans qu'on y pense.
 */

import { Prisma } from "@prisma/client"
import { strToU8, zipSync, type Zippable } from "fflate"
import { describeManifest, exportAccount } from "@/lib/account-transfer"
import { csvCell } from "@/lib/elevage/declarations-reglementaires"

type Row = Record<string, unknown>

/** Tables de fonctionnement ou d'administration, pas des données de l'exploitation. */
const TABLES_HORS_EXPORT = new Set([
  "PushSubscription",
  "UserPreference",
  "MembreExploitation",
  "ImpersonationGrant",
  "GrowthCampaignContact",
  "Signalement",
  "ApiError",
  "MediaReferentiel",
])

/** Colonnes jamais écrites dans un fichier destiné à un tableur. */
const COLONNE_EXCLUE = /^(userId|.*token.*|.*secret.*|.*password.*|motDePasse|apiKey|p256dh|auth)$/i

export function valeurCsv(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "bigint") return value.toString()
  if (Prisma.Decimal.isDecimal(value)) return value.toString()
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

/** CSV au format des autres exports Gleba : BOM UTF-8, `;`, fins de ligne CRLF. */
export function tableEnCsv(rows: Row[]): string {
  const colonnes: string[] = []
  for (const row of rows) {
    for (const cle of Object.keys(row)) {
      if (!COLONNE_EXCLUE.test(cle) && !colonnes.includes(cle)) colonnes.push(cle)
    }
  }
  const lignes = [
    colonnes.map(csvCell).join(";"),
    ...rows.map((row) => colonnes.map((col) => csvCell(valeurCsv(row[col]))).join(";")),
  ]
  return `\uFEFF${lignes.join("\r\n")}\r\n`
}

/** Nom de fichier ASCII tiré du nom de table SQL (`@@map`), sinon du modèle. */
export function nomFichierTable(modele: string, nomTable?: string | null): string {
  const base = (nomTable || modele.replace(/([a-z0-9])([A-Z])/g, "$1_$2"))
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .toLowerCase()
  return `${base || "table"}.csv`
}

export interface FichierExport {
  fichier: string
  modele: string
  lignes: number
}

export function construireArchiveTabulaire(args: {
  tables: Array<{ modele: string; nomTable?: string | null; rows: Row[] }>
  dateExport: Date
}): { archive: Uint8Array; fichiers: FichierExport[] } {
  const contenu: Zippable = {}
  const fichiers: FichierExport[] = []
  for (const table of args.tables) {
    if (table.rows.length === 0) continue
    const fichier = nomFichierTable(table.modele, table.nomTable)
    contenu[fichier] = strToU8(tableEnCsv(table.rows))
    fichiers.push({ fichier, modele: table.modele, lignes: table.rows.length })
  }
  fichiers.sort((a, b) => a.fichier.localeCompare(b.fichier))

  const lisezMoi = [
    "Export tabulaire Gleba",
    `Date : ${args.dateExport.toISOString()}`,
    "",
    "Un fichier CSV par table de données de votre compte (séparateur « ; », encodage UTF-8).",
    "Les identifiants (colonnes id, …Id) relient les tables entre elles.",
    "Pour déménager votre compte sur une autre instance, utilisez plutôt la « Sauvegarde complète ».",
    "",
    fichiers.length === 0 ? "Aucune donnée à exporter." : "Contenu :",
    ...fichiers.map((f) => `- ${f.fichier} : ${f.lignes} ligne${f.lignes > 1 ? "s" : ""}`),
    "",
  ].join("\r\n")
  contenu["LISEZMOI.txt"] = strToU8(lisezMoi)

  return { archive: zipSync(contenu, { level: 6 }), fichiers }
}

export async function exporterDonneesTabulaires(userId: string, dateExport = new Date()) {
  const { byClass } = describeManifest()
  const modeles = [...byClass.owned, ...byClass.child].filter((m) => !TABLES_HORS_EXPORT.has(m))
  const { data } = await exportAccount(userId)
  const nomsTables = new Map(Prisma.dmmf.datamodel.models.map((m) => [m.name, m.dbName]))
  return construireArchiveTabulaire({
    tables: modeles.map((modele) => ({
      modele,
      nomTable: nomsTables.get(modele),
      rows: data[modele] ?? [],
    })),
    dateExport,
  })
}
