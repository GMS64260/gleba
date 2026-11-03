// Base PostgreSQL jetable, jamais les données d'une exploitation réelle.
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '')
export default {
  root,
  test: {
    environment: 'node',
    include: ['src/lib/__tests__/integration/saisies-fiabilite.postgres.ts'],
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 30000,
  },
  resolve: { alias: { '@': root + '/src', 'next/server': root + '/node_modules/next/server.js' } },
}
