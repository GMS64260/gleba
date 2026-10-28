import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '')
export default {
  root,
  test: { environment: 'node', include: ['src/lib/verger/__tests__/raccords.integration.test.ts', 'src/lib/chat/executor-verger.raccords.test.ts'], maxWorkers: 1, minWorkers: 1, fileParallelism: false },
  resolve: { alias: { '@': root + '/src', 'next/server': root + '/node_modules/next/server.js' } },
}
