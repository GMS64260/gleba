/**
 * Génère le SQL idempotent du catalogue officiel compagnie/équin/NAC depuis
 * sa source TypeScript testée. Usage :
 *
 * npx tsx scripts/generate-elevage-catalogue-migration.ts
 *
 * La sortie est destinée à une migration Prisma corrective. Le générateur ne
 * se connecte pas à la base et ne modifie aucun fichier.
 */

import {
  ESPECES_COMPAGNIE,
  RACES_COMPAGNIE,
  totalRacesCatalogue,
} from '../src/lib/elevage/catalogue-compagnie'

const sqlString = (value: string): string => `'${value.replaceAll("'", "''")}'`
const sqlNullableString = (value: string | undefined): string =>
  value == null ? 'NULL' : sqlString(value)
const sqlNullableNumber = (value: number | undefined): string =>
  value == null ? 'NULL' : String(value)
const sqlArray = (values: string[] | undefined): string =>
  values?.length
    ? `ARRAY[${values.map(sqlString).join(', ')}]::TEXT[]`
    : 'ARRAY[]::TEXT[]'

const speciesRows = ESPECES_COMPAGNIE.map((espece) => `  (${[
  sqlString(espece.id),
  sqlString(espece.nom),
  sqlString(espece.type),
  sqlString(espece.filiere),
  sqlString('compagnie'),
  sqlString(espece.categorieReglementaire),
  'ARRAY[]::TEXT[]',
  sqlNullableNumber(espece.dureeGestation),
  sqlNullableNumber(espece.dureeCouvaison),
  sqlNullableNumber(espece.poidsAdulte),
  sqlNullableString(espece.couleur),
  sqlNullableString(espece.description),
].join(', ')})`).join(',\n')

const raceRows = Object.entries(RACES_COMPAGNIE).flatMap(([especeId, races]) =>
  races.map((race) => {
    const stableKey = `${especeId}::${race.nom}`
    return `  ('cat_' || substr(md5(${sqlString(stableKey)}), 1, 20), ${[
      sqlString(race.nom),
      sqlString(especeId),
      sqlNullableString(race.origine),
      sqlArray(race.aptitudes),
      sqlNullableString(race.description),
    ].join(', ')})`
  })
).join(',\n')

const sql = `-- Catalogue officiel complet des modes compagnie / équin / NAC.
-- Migration corrective additive : la première migration de filière ne
-- contenait que 9 espèces et aucune race. Cette migration est générée depuis
-- src/lib/elevage/catalogue-compagnie.ts et reste idempotente.
-- Espèces : ${ESPECES_COMPAGNIE.length}. Associations race/variété : ${totalRacesCatalogue()}.

INSERT INTO "especes_animales"
  ("espece_animale", "nom", "type", "filiere", "production",
   "categorie_reglementaire", "productions", "duree_gestation",
   "duree_couvaison", "poids_adulte", "couleur", "description")
VALUES
${speciesRows}
ON CONFLICT ("espece_animale") DO UPDATE
SET "filiere" = EXCLUDED."filiere";

INSERT INTO "races_animales"
  ("id", "nom", "espece_animale_id", "origine", "aptitudes", "description")
VALUES
${raceRows}
ON CONFLICT ("espece_animale_id", "nom") DO NOTHING;
`

process.stdout.write(sql)
