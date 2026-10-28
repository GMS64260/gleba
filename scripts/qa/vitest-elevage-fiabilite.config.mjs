import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '')
export default {
  root,
  test: { environment: 'node', include: ['src/lib/__tests__/integration/elevage-fiabilite.postgres.ts', 'src/lib/elevage/__tests__/chaine-kpi.integration.test.ts'], maxWorkers: 1, minWorkers: 1 },
  resolve: { alias: { '@': root + '/src', 'next/server': root + '/node_modules/next/server.js' } },
}
