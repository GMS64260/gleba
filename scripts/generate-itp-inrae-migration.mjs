#!/usr/bin/env node

/**
 * Génère la migration SQL d'import à partir de la copie normalisée du jeu
 * Pépinière-Mesclun v1.1.
 *
 * Le JSON est la transcription auditable de l'onglet `Cycles_culture`.
 * Ce script ne télécharge rien et produit un SQL déterministe :
 *
 *   node scripts/generate-itp-inrae-migration.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = path.join(root, 'prisma/data/itp-inrae-mesclun-v1.1.json')
const outputPath = path.join(
  root,
  'prisma/migrations/20260729110000_import_itp_inrae_mesclun_v1_1/migration.sql'
)

const data = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))

function sql(value) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Nombre SQL invalide : ${value}`)
    return String(value)
  }
  return `'${String(value).replaceAll("'", "''")}'`
}

function normalizeKey(value) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function assertData() {
  if (data.metadata.rows !== 529 || data.cycles.length !== 529) {
    throw new Error(`Nombre de scénarios inattendu : ${data.cycles.length}`)
  }
  const targetSpecies = new Set(Object.values(data.speciesMap))
  const catalogSpecies = new Set(data.speciesCatalog.map((species) => species.id))
  for (const species of targetSpecies) {
    if (!catalogSpecies.has(species)) {
      throw new Error(`Espèce cible absente du socle de migration : ${species}`)
    }
  }

  const ids = new Set()
  const sourceIds = new Set()
  for (const cycle of data.cycles) {
    if (!data.speciesMap[cycle.cultureSource]) {
      throw new Error(`Culture INRAE non mappée : ${cycle.cultureSource}`)
    }
    if (ids.has(cycle.id)) throw new Error(`Identifiant ITP dupliqué : ${cycle.id}`)
    if (sourceIds.has(cycle.sourceRecordId)) {
      throw new Error(`Identifiant source dupliqué : ${cycle.sourceRecordId}`)
    }
    ids.add(cycle.id)
    sourceIds.add(cycle.sourceRecordId)

    for (const field of [
      'semaineSemis',
      'semainePlantation',
      'semaineRecolte',
      'semaineImplantationDebut',
      'semaineImplantationFin',
      'semaineRecolteFin',
    ]) {
      const week = cycle[field]
      if (week !== null && week !== undefined && (week < 1 || week > 52)) {
        throw new Error(`${cycle.id}.${field} hors 1–52 : ${week}`)
      }
    }
    if (cycle.actif && cycle.statutValidation !== 'source_documentee') {
      throw new Error(`${cycle.id} actif sans source documentée`)
    }
  }
}

function notesFor(cycle) {
  const notes = []
  if (cycle.implantationDetail && cycle.implantationDetail !== 'Pas de détail') {
    notes.push(`Implantation : ${cycle.implantationDetail}`)
  }
  if (cycle.notes) notes.push(`Récolte : ${cycle.notes}`)
  return notes.length ? notes.join('\n') : null
}

function reviewComment(cycle) {
  const parts = [
    '[2026-07-29] Fenêtres importées sans réduction depuis Pépinière-Mesclun v1.1.',
    `Culture source : ${cycle.cultureSource}${cycle.cultureDetail ? ` — ${cycle.cultureDetail}` : ''}.`,
  ]
  if (cycle.anomalieSource) {
    parts.push(`ANOMALIE SOURCE : ${cycle.anomalieSource}`)
    parts.push(`Valeurs publiées : ${JSON.stringify(cycle.sourceWeeks)}.`)
  }
  return parts.join(' ')
}

function sourceReference(cycle) {
  return [
    'INRAE — Pépinière-Mesclun v1.1',
    `DOI ${data.metadata.doi}`,
    cycle.referenceCycle ? `cycle : ${cycle.referenceCycle}` : 'référence de cycle non renseignée',
  ].join(' · ')
}

assertData()

const lines = [
  '-- Import documenté des scénarios de cycles Pépinière-Mesclun v1.1.',
  `-- Source : INRAE, DOI ${data.metadata.doi}`,
  `-- Licence : ${data.metadata.licence}`,
  `-- Empreinte du XLSX original : SHA-256 ${data.metadata.xlsxSha256}`,
  `-- ${data.metadata.activeRows} scénarios actifs ; ${data.metadata.quarantinedRows} scénarios hors ISO conservés mais désactivés.`,
  '',
]

for (const family of data.families) {
  lines.push(
    `INSERT INTO "familles" ("famille", "nom_fr", "intervalle") VALUES (${sql(family.id)}, ${sql(family.nomFr)}, ${sql(family.intervalle)})`,
    'ON CONFLICT ("famille") DO UPDATE SET',
    '  "nom_fr" = EXCLUDED."nom_fr",',
    '  "intervalle" = EXCLUDED."intervalle";',
    ''
  )
}

for (const species of data.speciesCatalog) {
  lines.push(
    'INSERT INTO "especes" (',
    '  "espece", "nom", "nom_normalise", "type", "famille", "nom_latin",',
    '  "vivace", "a_planifier", "type_culture_semis", "mode_semis",',
    '  "user_id", "partage_communaute"',
    ') VALUES (',
    `  ${sql(species.id)}, ${sql(species.nom ?? species.id)}, ${sql(normalizeKey(species.nom ?? species.id))}, ${sql(species.type ?? 'legume')}, ${sql(species.familleId)}, ${sql(species.nomLatin)},`,
    `  ${sql(species.vivace === true)}, ${sql(species.aPlanifier !== false)}, ${sql(species.typeCultureSemis)}, ${sql(species.modeSemis)},`,
    '  NULL, false',
    ')',
    'ON CONFLICT ("espece") DO UPDATE SET',
    '  "nom" = EXCLUDED."nom",',
    '  "nom_normalise" = COALESCE("especes"."nom_normalise", EXCLUDED."nom_normalise"),',
    '  "famille" = COALESCE("especes"."famille", EXCLUDED."famille"),',
    '  "nom_latin" = COALESCE("especes"."nom_latin", EXCLUDED."nom_latin"),',
    '  "type_culture_semis" = COALESCE("especes"."type_culture_semis", EXCLUDED."type_culture_semis"),',
    '  "mode_semis" = COALESCE("especes"."mode_semis", EXCLUDED."mode_semis");',
    ''
  )
}

const columns = [
  'it_plante',
  'nom',
  'nom_normalise',
  'espece',
  's_semis',
  's_plantation',
  's_recolte',
  's_implantation_debut',
  's_implantation_fin',
  's_recolte_fin',
  'd_recolte',
  'd_culture',
  'notes',
  'type_planche',
  'mode_demarrage',
  'commentaire_agronome',
  'source_reference',
  'derniere_revision',
  'zone_climat',
  'implantation',
  'forcage',
  'contexte_climatique',
  'source_url',
  'source_record_id',
  'source_version',
  'source_licence',
  'statut_validation',
  'actif',
  'delai_premiere_recolte_annees',
  'user_id',
  'partage_communaute',
]

const updateColumns = columns.filter((column) =>
  !['it_plante', 'user_id', 'partage_communaute'].includes(column)
)

for (let offset = 0; offset < data.cycles.length; offset += 75) {
  const chunk = data.cycles.slice(offset, offset + 75)
  lines.push(`INSERT INTO "itps" (${columns.map((column) => `"${column}"`).join(', ')}) VALUES`)
  lines.push(
    chunk
      .map((cycle) => {
        const mode =
          cycle.implantation === 'Semis'
            ? 'Semis direct'
            : cycle.implantation === 'Plantation'
              ? 'Plantation'
              : cycle.implantation === 'Semis et implantation'
                ? 'Semis et plantation'
                : cycle.implantation
        const values = [
          cycle.id,
          cycle.nom,
          normalizeKey(cycle.nom),
          cycle.especeId,
          cycle.semaineSemis,
          cycle.semainePlantation,
          cycle.semaineRecolte,
          cycle.semaineImplantationDebut,
          cycle.semaineImplantationFin,
          cycle.semaineRecolteFin,
          cycle.dureeRecolte,
          cycle.dureeCulture,
          notesFor(cycle),
          cycle.typePlanche,
          mode,
          reviewComment(cycle),
          sourceReference(cycle),
          `${data.metadata.importedAt}T00:00:00.000Z`,
          cycle.zoneClimat,
          cycle.implantation,
          cycle.forcage,
          cycle.contexteClimatique,
          data.metadata.url,
          cycle.sourceRecordId,
          data.metadata.version,
          data.metadata.licence,
          cycle.statutValidation,
          cycle.actif,
          cycle.delaiPremiereRecolteAnnees,
          null,
          false,
        ]
        return `  (${values.map(sql).join(', ')})`
      })
      .join(',\n')
  )
  lines.push(
    'ON CONFLICT ("it_plante") DO UPDATE SET',
    updateColumns
      .map((column) => `  "${column}" = EXCLUDED."${column}"`)
      .join(',\n') + ';',
    ''
  )
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
while (lines.at(-1) === '') lines.pop()
fs.writeFileSync(outputPath, `${lines.join('\n')}\n`)
console.log(`Migration générée : ${path.relative(root, outputPath)} (${data.cycles.length} scénarios)`)
