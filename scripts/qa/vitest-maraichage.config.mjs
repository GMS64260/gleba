// Exécution dédiée sur PostgreSQL jetable ; hors de la sélection Vitest usuelle.
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '')
export default {
  root,
  test: { environment: 'node', include: ['src/lib/__tests__/integration/parcours-maraichage.postgres.ts'], maxWorkers: 1, minWorkers: 1 },
  resolve: { alias: { '@': root + '/src', 'next/server': root + '/node_modules/next/server.js' } },
}
