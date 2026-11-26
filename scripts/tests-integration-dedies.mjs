// Suites d'intégration à base dédiée : chacune refuse toute base qui ne porte pas
// son nom (garde de nom), si bien qu'aucune ne tournait en CI ni dans
// `scripts/tests-integration.mjs`. Ce lanceur crée pour chacune sa base jetable
// à partir d'un modèle migré une seule fois, lance la suite, puis supprime la base.
//
//   TEST_ADMIN_DATABASE_URL=postgresql://postgres:…@127.0.0.1:5432/postgres \
//     node scripts/tests-integration-dedies.mjs [filtre]
//
// L'URL d'administration ne sert qu'à créer et supprimer les bases listées
// ci-dessous ; elle doit désigner un PostgreSQL local. Aucune donnée réelle.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

const MODELE = 'gleba_integration_modele'
const INTEGRATION = ['--config', 'vitest.integration.config.ts']
const qa = (nom) => ['--config', `scripts/qa/vitest-${nom}.config.mjs`]

/** base : nom exigé par la garde de la suite ; variables : celles que la suite lit en plus de DATABASE_URL. */
export const SUITES = [
  { nom: 'reglements', base: 'gleba_reglements_qa_banque_20261027_c1c1c1', variables: ['GLEBA_BANQUE_QA_DATABASE_URL'],
    vitest: [...INTEGRATION, 'src/lib/comptabilite/__tests__/reglements.integration.test.ts'] },
  { nom: 'elevage', base: 'gleba_reglements_qa_elevage_20261028_c1c1c1', variables: ['GLEBA_ELEVAGE_QA_DATABASE_URL'],
    vitest: qa('elevage-fiabilite') },
  { nom: 'capteurs', base: 'gleba_capteurs_regression', variables: ['CAPTEURS_TEST_DATABASE_URL'],
    vitest: [...INTEGRATION, 'src/lib/capteurs/postgres.integration.test.ts'] },
  { nom: 'verger-parcours', base: 'gleba_verger_qa_corrige_20261028_c1c1c1c1', variables: ['GLEBA_VERGER_QA_DATABASE_URL'],
    vitest: [...INTEGRATION, 'src/lib/verger/__tests__/parcours.integration.test.ts'] },
  { nom: 'verger-six-points', base: 'gleba_verger_qa_corrige_20261028_c2c2c2c2', variables: ['GLEBA_VERGER_QA_DATABASE_URL'],
    vitest: [...INTEGRATION, 'src/lib/verger/__tests__/six-points.integration.test.ts'] },
  { nom: 'verger-transformation', base: 'gleba_verger_qa_corrige_20261028_c3c3c3c3', variables: ['GLEBA_VERGER_QA_DATABASE_URL'],
    vitest: [...INTEGRATION, 'src/lib/verger/__tests__/transformation.integration.test.ts'] },
  { nom: 'verger-raccords', base: 'gleba_verger_qa_raccords_c1c1c1c1', variables: ['GLEBA_VERGER_RACCORDS_QA_DATABASE_URL'],
    vitest: [...INTEGRATION, 'src/lib/verger/__tests__/raccords.integration.test.ts'] },
  { nom: 'verger-commercial', base: 'gleba_verger_bl_qa_20261028_c1c1c1c1', variables: ['GLEBA_VERGER_BL_QA_DATABASE_URL'],
    vitest: [...INTEGRATION, 'src/lib/verger/__tests__/suivi-commercial.integration.test.ts'] },
  { nom: 'agroclimat', base: 'gleba_agroclimat_qa_ci', variables: ['GLEBA_AGROCLIMAT_QA_DATABASE_URL'],
    vitest: [...INTEGRATION, 'src/lib/agroclimat/import-safran.integration.test.ts'] },
  { nom: 'associations', base: 'gleba_jetable_associations_ci', variables: [],
    vitest: [...INTEGRATION, 'src/app/api/associations/migration-famille.postgres.test.ts'] },
  { nom: 'parcours-ferme', base: 'gleba_parcours_qa_c1c1c1c1', variables: ['GLEBA_PARCOURS_QA_DATABASE_URL'], vitest: qa('parcours-ferme') },
  { nom: 'parcours-maraichage', base: 'gleba_devis_qa_maraichage_c1c1c1c1', variables: ['GLEBA_COMMERCIAL_QA_DATABASE_URL'], vitest: qa('maraichage') },
  { nom: 'saisies', base: 'gleba_saisies_qa_c1c1c1c1', variables: ['GLEBA_SAISIES_QA_DATABASE_URL'], vitest: qa('saisies') },
]

function urlAdmin() {
  let url
  try { url = new URL(process.env.TEST_ADMIN_DATABASE_URL) } catch { /* le message ne reprend pas l'URL (identifiants) */ }
  if (!url || !['postgresql:', 'postgres:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname)) {
    console.error('TEST_ADMIN_DATABASE_URL doit désigner un PostgreSQL local (localhost ou 127.0.0.1).')
    process.exit(1)
  }
  url.hostname = '127.0.0.1' // exigé tel quel par la garde des capteurs
  return url
}

function lancer(args, env) {
  const r = spawnSync(process.execPath, args, { stdio: 'inherit', env: { ...process.env, ...env } })
  if (r.error) console.error(r.error.message)
  return r.status ?? 1
}

async function main() {
  const admin = urlAdmin()
  const urlDe = (base) => { const u = new URL(admin); u.pathname = '/' + base; return u.toString() }
  const filtre = process.argv[2]
  const suites = SUITES.filter((s) => !filtre || s.nom.includes(filtre))
  for (const s of suites) {
    const fichier = s.vitest.find((a) => a.startsWith('src/'))
    if (fichier && !existsSync(fichier)) { console.error(`Suite ${s.nom} : ${fichier} introuvable.`); process.exit(1) }
  }
  const db = new PrismaClient({ datasources: { db: { url: admin.toString() } } })
  // Les noms viennent tous de la liste ci-dessus : aucune base d'utilisateur ne peut être visée.
  const sql = (texte) => db.$executeRawUnsafe(texte)
  const echecs = []
  try {
    await sql(`DROP DATABASE IF EXISTS "${MODELE}"`)
    await sql(`CREATE DATABASE "${MODELE}"`)
    if (lancer(['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { DATABASE_URL: urlDe(MODELE) }) !== 0) {
      console.error('Migrations du modèle en échec.')
      process.exit(1)
    }
    for (const s of suites) {
      const url = urlDe(s.base)
      await sql(`DROP DATABASE IF EXISTS "${s.base}"`)
      await sql(`CREATE DATABASE "${s.base}" TEMPLATE "${MODELE}"`)
      console.log(`\n=== ${s.nom} (base ${s.base}) ===`)
      const env = { DATABASE_URL: url, TZ: 'Europe/Paris', ...Object.fromEntries(s.variables.map((v) => [v, url])) }
      if (lancer(['node_modules/vitest/vitest.mjs', 'run', ...s.vitest], env) !== 0) echecs.push(s.nom)
      await sql(`DROP DATABASE IF EXISTS "${s.base}" WITH (FORCE)`)
    }
  } finally {
    await sql(`DROP DATABASE IF EXISTS "${MODELE}"`).catch(() => {})
    await db.$disconnect()
  }
  if (echecs.length) { console.error(`\nSuites en échec : ${echecs.join(', ')}`); process.exit(1) }
  console.log(`\n${suites.length} suite(s) à base dédiée : toutes vertes.`)
}

main().catch((e) => { console.error(e?.message || e); process.exit(1) })
