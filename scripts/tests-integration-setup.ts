import { afterAll } from 'vitest'

// L'isolation des modules Vitest ne vide pas le singleton global de Prisma.
// Un spy posé sur un délégué proxy peut donc altérer les fichiers suivants.
const contexte = globalThis as typeof globalThis & {
  prisma?: { $disconnect(): Promise<void> }
}
delete contexte.prisma

afterAll(async () => {
  await contexte.prisma?.$disconnect()
  delete contexte.prisma
})
