import { createHash } from "node:crypto"

export const TYPES_DECLARATION = ["NAISSANCE", "ENTREE", "SORTIE", "MORTALITE"] as const
export type TypeDeclarationReglementaire = (typeof TYPES_DECLARATION)[number]

export const STATUTS_DECLARATION = [
  "A_COMPLETER",
  "A_DECLARER",
  "HORS_DELAI",
  "TRANSMISE",
  "ACCEPTEE",
  "REJETEE",
  "ANNULEE",
] as const
export type StatutDeclarationReglementaire = (typeof STATUTS_DECLARATION)[number]

export type CategorieReglementaireCouverte = "BOVIN" | "OVIN" | "CAPRIN"

export interface SuiviDeclaration {
  statut: string
  transmisAt: Date | null
  canalTransmission: string | null
  referenceTransmission: string | null
  notes: string | null
  snapshotHash: string | null
}

export interface DeclarationReglementaire {
  key: string
  type: TypeDeclarationReglementaire
  categorie: CategorieReglementaireCouverte
  organisme: string
  dateEvenement: string
  dateEcheance: string
  joursRestants: number
  statut: StatutDeclarationReglementaire
  libelle: string
  espece: string
  cible: string
  sourceUrl: string
  numeroEde: string | null
  identifiants: string[]
  quantite: number
  origine: string | null
  destination: string | null
  anomalies: string[]
  transmisAt: string | null
  canalTransmission: string | null
  referenceTransmission: string | null
  notes: string | null
  modifieeApresTransmission: boolean
  snapshot: Record<string, unknown>
  snapshotHash: string
}

export function normaliserCategorieReglementaire(
  value: string | null | undefined,
): CategorieReglementaireCouverte | null {
  const normalisee = (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toUpperCase()

  if (normalisee === "BOVIN") return "BOVIN"
  if (normalisee === "OVIN") return "OVIN"
  if (normalisee === "CAPRIN") return "CAPRIN"
  return null
}

export function typeDeclarationCouvert(
  categorie: CategorieReglementaireCouverte,
  type: TypeDeclarationReglementaire,
): boolean {
  if (categorie === "BOVIN") return true
  return type === "ENTREE" || type === "SORTIE"
}

export function organismeDeclaration(categorie: CategorieReglementaireCouverte): string {
  return categorie === "BOVIN" ? "EDE / BDNI" : "EDE / Ovinfos"
}

export function calculerEcheanceDeclaration(dateEvenement: Date, delaiJours = 7): Date {
  const echeance = new Date(dateEvenement)
  echeance.setUTCDate(echeance.getUTCDate() + delaiJours)
  echeance.setUTCHours(23, 59, 59, 999)
  return echeance
}

export function joursAvantEcheance(dateEcheance: Date, maintenant = new Date()): number {
  return Math.ceil((dateEcheance.getTime() - maintenant.getTime()) / 86_400_000)
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, stableValue(entry)]),
    )
  }
  return value instanceof Date ? value.toISOString() : value
}

export function empreinteDeclaration(snapshot: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(stableValue(snapshot))).digest("hex")
}

export function calculerStatutDeclaration(args: {
  anomalies: string[]
  dateEcheance: Date
  suivi?: SuiviDeclaration | null
  maintenant?: Date
}): StatutDeclarationReglementaire {
  const { anomalies, dateEcheance, suivi, maintenant = new Date() } = args
  const statutSuivi = suivi?.statut as StatutDeclarationReglementaire | undefined

  if (statutSuivi && ["TRANSMISE", "ACCEPTEE", "REJETEE", "ANNULEE"].includes(statutSuivi)) {
    return statutSuivi
  }
  if (maintenant.getTime() > dateEcheance.getTime()) return "HORS_DELAI"
  if (anomalies.length > 0) return "A_COMPLETER"
  return "A_DECLARER"
}

export function prioriteStatut(statut: StatutDeclarationReglementaire): number {
  return {
    HORS_DELAI: 0,
    A_COMPLETER: 1,
    REJETEE: 2,
    A_DECLARER: 3,
    TRANSMISE: 4,
    ACCEPTEE: 5,
    ANNULEE: 6,
  }[statut]
}

export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value)
  // Les libellés, références et noms proviennent de saisies utilisateur.
  // Neutraliser les préfixes interprétés comme formules par les tableurs.
  const safeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return `"${safeText.replaceAll('"', '""')}"`
}

const memeJourUtc = (a: Date | null, b: Date | null) =>
  Boolean(
    a
      && b
      && a.getUTCFullYear() === b.getUTCFullYear()
      && a.getUTCMonth() === b.getUTCMonth()
      && a.getUTCDate() === b.getUTCDate(),
  )

/**
 * Un lot sans provenance, rattaché à une naissance du même jour que sa date
 * d'arrivée, représente des petits nés sur place et non une entrée externe.
 */
export function lotNeSurExploitation(args: {
  dateArrivee: Date | null
  provenance: string | null
  datesNaissances: Date[]
}): boolean {
  return !args.provenance?.trim()
    && args.datesNaissances.some((date) => memeJourUtc(args.dateArrivee, date))
}
