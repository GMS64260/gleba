import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '')
export default {
  root,
  test: {
    environment: 'node',
    include: ['src/lib/__tests__/integration/parcours-ferme.postgres.ts'],
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 30000,
  },
  resolve: { alias: { '@': root + '/src', 'next/server': root + '/node_modules/next/server.js' } },
}
