// Seconde passe des témoins dont le résultat dépend du fuseau du processus.
// TZ est transmis AVANT le démarrage de Vitest et de ses workers threads.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const racine = fileURLToPath(new URL('../', import.meta.url))
const fuseau = process.argv[2] ?? 'UTC'
if (!['UTC', 'Europe/Paris'].includes(fuseau)) {
  throw new Error(`Fuseau non prévu pour cette passe : ${fuseau}`)
}

const suites = [
  'src/lib/jour-civil.test.ts',
  'src/lib/dates/jours-civils.test.ts',
  'src/lib/__tests__/irrigation-recording.test.ts',
  'src/lib/chat/reponses-directes.test.ts',
  'src/lib/caisse/archive-format.test.ts',
  'src/lib/caisse/receptions-comptables.test.ts',
]
// Les suites privées peuvent être absentes du dépôt public.
const presentes = suites.filter(f => existsSync(new URL(`../${f}`, import.meta.url)))
for (const f of suites.filter(f => !presentes.includes(f))) console.info(`Suite absente, ignorée : ${f}`)
if (!presentes.length) throw new Error('Aucune suite sensible au fuseau trouvée.')
console.info(`Passe TZ=${fuseau} : ${presentes.length} suites`)

const resultat = spawnSync(process.execPath, [
  fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url)),
  'run', ...presentes, '--pool=threads', '--poolOptions.threads.singleThread',
], {
  cwd: racine,
  env: { ...process.env, TZ: fuseau },
  stdio: 'inherit',
})
if (resultat.error) throw resultat.error
process.exit(resultat.status ?? 1)
