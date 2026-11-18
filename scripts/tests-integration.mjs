import { spawnSync } from 'node:child_process'

// Ne jamais reprendre DATABASE_URL : elle peut désigner une base utilisateur.
const testUrl = process.env.TEST_DATABASE_URL
let url
try {
  url = new URL(testUrl)
} catch {
  // Le message ne reprend pas l'URL (qui contient les identifiants).
}
if (!url || !['postgresql:', 'postgres:'].includes(url.protocol)
  || !['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/gleba_tests') {
  console.error('TEST_DATABASE_URL doit désigner la base PostgreSQL locale jetable gleba_tests, déjà migrée.')
  process.exit(1)
}

const result = spawnSync(process.execPath, [
  'node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.integration.config.ts',
  ...process.argv.slice(2),
], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: testUrl, CAISSE_TEST_DB: 'oui', TZ: 'Europe/Paris' },
})
if (result.error) console.error(result.error.message)
if (result.signal) console.error(`Vitest interrompu par le signal ${result.signal}.`)
process.exit(result.status ?? 1)
