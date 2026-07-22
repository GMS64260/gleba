export const ANIMAUX_CSV_COLUMNS = [
  'espece', 'identifiant', 'type_identifiant', 'nom', 'race', 'sexe',
  'date_naissance', 'date_arrivee', 'provenance', 'prix_achat', 'poids_kg', 'notes',
] as const

export type AnimalCsvRow = Record<(typeof ANIMAUX_CSV_COLUMNS)[number], string>

function parseLine(line: string, separator: string): string[] {
  const values: string[] = []
  let value = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i++ }
      else quoted = !quoted
    } else if (char === separator && !quoted) {
      values.push(value.trim()); value = ''
    } else value += char
  }
  if (quoted) throw new Error('Guillemet non ferme dans le fichier CSV')
  values.push(value.trim())
  return values
}

export function parseAnimauxCsv(content: string): AnimalCsvRow[] {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) throw new Error('Le fichier doit contenir un en-tete et au moins une ligne')
  const separator = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ';' : ','
  const headers = parseLine(lines[0], separator).map((h) => h.toLowerCase().trim())
  if (!headers.includes('espece')) throw new Error('La colonne obligatoire « espece » est absente')
  return lines.slice(1).map((line) => {
    const cells = parseLine(line, separator)
    return Object.fromEntries(ANIMAUX_CSV_COLUMNS.map((column) => [column, cells[headers.indexOf(column)]?.trim() ?? ''])) as AnimalCsvRow
  })
}

export function csvRowToAnimal(row: AnimalCsvRow, especeAnimaleId: string) {
  const numberOrNull = (value: string) => {
    if (!value) return null
    const parsed = Number(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : null
  }
  return {
    especeAnimaleId,
    identifiant: row.identifiant || null,
    typeIdentifiant: row.type_identifiant || null,
    nom: row.nom || null,
    race: row.race || null,
    sexe: row.sexe.toLowerCase() || null,
    dateNaissance: row.date_naissance || null,
    dateArrivee: row.date_arrivee || undefined,
    provenance: row.provenance || null,
    prixAchat: numberOrNull(row.prix_achat),
    poidsActuel: numberOrNull(row.poids_kg),
    notes: row.notes || null,
    statut: 'actif',
  }
}
