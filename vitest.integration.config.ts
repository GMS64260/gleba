import { defineConfig } from 'vitest/config'
import base from './vitest.config'

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    // Globs : les fichiers privés absents du dépôt public ne sont pas requis.
    include: ['src/**/*.integration.test.ts', 'src/**/integration.test.ts'],
    setupFiles: ['./scripts/tests-integration-setup.ts'],
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
