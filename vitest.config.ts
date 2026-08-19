import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
    server: {
      deps: {
        // Laisser Vite traiter next-auth pour que l'alias `next/server`
        // ci-dessous s'applique (Node seul ne résout pas cet export).
        inline: ['next-auth'],
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Vite ne suit pas l'export conditionnel `next/server` utilisé par
      // next-auth ; nécessaire pour importer @/lib/auth dans un test.
      'next/server': path.resolve(__dirname, './node_modules/next/server.js'),
    },
  },
})
