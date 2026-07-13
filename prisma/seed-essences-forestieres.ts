/**
 * Seed « Gleba officiel » des essences forestières : importe le référentiel
 * historique (src/data/essences-forestieres.ts) dans la table essences_forestieres.
 * Idempotent (upsert par id-slug). userId null + partageCommunaute false = catalogue officiel.
 *
 *   npx tsx prisma/seed-essences-forestieres.ts
 */
import { PrismaClient } from '@prisma/client'
import { ESSENCES_FORESTIERES } from '../src/data/essences-forestieres'

const prisma = new PrismaClient()

async function main() {
  let n = 0
  for (const e of ESSENCES_FORESTIERES) {
    const data = {
      nom: e.nom,
      nomLatin: e.nomLatin,
      categorie: e.categorie,
      usages: e.usages,
      densitesParHa: (e.densitesParHa ?? {}) as object,
      croissance: e.croissance,
      sols: e.sols,
      expositions: e.expositions,
      cycleAnsRecolte: e.cycleAnsRecolte ?? null,
      conseils: e.conseils ?? null,
    }
    await prisma.essenceForestiere.upsert({
      where: { id: e.id },
      update: data,
      create: { id: e.id, userId: null, partageCommunaute: false, ...data },
    })
    n++
  }
  console.log(`✓ ${n} essences forestières seedées (catalogue Gleba officiel)`)
}

main()
  .catch((err) => {
    console.error('Seed essences forestières échec :', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
