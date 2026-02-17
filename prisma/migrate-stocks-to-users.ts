/**
 * Migration script: copie les stocks globaux vers les tables UserStock* per-user.
 *
 * Usage:
 *   docker compose exec -T backend npx tsx prisma/migrate-stocks-to-users.ts
 *
 * Ce script est idempotent : il utilise upsert pour ne pas créer de doublons.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Migration des stocks vers les tables per-user ===')

  const users = await prisma.user.findMany({ select: { id: true, email: true } })
  console.log(`${users.length} utilisateur(s) trouvé(s)`)

  if (users.length === 0) {
    console.log('Aucun utilisateur, rien à migrer.')
    return
  }

  // 1. Variétés avec stock
  const varietes = await prisma.variete.findMany({
    where: {
      OR: [
        { stockGraines: { not: null } },
        { stockPlants: { not: null } },
      ],
    },
    select: { id: true, stockGraines: true, stockPlants: true, dateStock: true },
  })
  console.log(`\n${varietes.length} variété(s) avec stock à migrer`)

  for (const user of users) {
    for (const v of varietes) {
      await prisma.userStockVariete.upsert({
        where: { userId_varieteId: { userId: user.id, varieteId: v.id } },
        create: {
          userId: user.id,
          varieteId: v.id,
          stockGraines: v.stockGraines,
          stockPlants: v.stockPlants,
          dateStock: v.dateStock,
        },
        update: {}, // ne pas écraser si déjà présent
      })
    }
  }
  console.log('  -> UserStockVariete OK')

  // 2. Fertilisants avec stock
  const fertilisants = await prisma.fertilisant.findMany({
    where: { stock: { not: null } },
    select: { id: true, stock: true, dateStock: true, prix: true },
  })
  console.log(`${fertilisants.length} fertilisant(s) avec stock à migrer`)

  for (const user of users) {
    for (const f of fertilisants) {
      await prisma.userStockFertilisant.upsert({
        where: { userId_fertilisantId: { userId: user.id, fertilisantId: f.id } },
        create: {
          userId: user.id,
          fertilisantId: f.id,
          stock: f.stock,
          dateStock: f.dateStock,
          prix: f.prix,
        },
        update: {},
      })
    }
  }
  console.log('  -> UserStockFertilisant OK')

  // 3. Aliments avec stock
  const aliments = await prisma.aliment.findMany({
    where: { stock: { not: null } },
    select: { id: true, stock: true, dateStock: true, stockMin: true, prix: true },
  })
  console.log(`${aliments.length} aliment(s) avec stock à migrer`)

  for (const user of users) {
    for (const a of aliments) {
      await prisma.userStockAliment.upsert({
        where: { userId_alimentId: { userId: user.id, alimentId: a.id } },
        create: {
          userId: user.id,
          alimentId: a.id,
          stock: a.stock,
          dateStock: a.dateStock,
          stockMin: a.stockMin,
          prix: a.prix,
        },
        update: {},
      })
    }
  }
  console.log('  -> UserStockAliment OK')

  // 4. Espèces avec inventaire
  const especes = await prisma.espece.findMany({
    where: { inventaire: { not: null } },
    select: { id: true, inventaire: true, dateInventaire: true, prixKg: true, objectifAnnuel: true },
  })
  console.log(`${especes.length} espèce(s) avec inventaire à migrer`)

  for (const user of users) {
    for (const e of especes) {
      await prisma.userStockEspece.upsert({
        where: { userId_especeId: { userId: user.id, especeId: e.id } },
        create: {
          userId: user.id,
          especeId: e.id,
          inventaire: e.inventaire,
          dateInventaire: e.dateInventaire,
          prixKg: e.prixKg,
          objectifAnnuel: e.objectifAnnuel,
        },
        update: {},
      })
    }
  }
  console.log('  -> UserStockEspece OK')

  console.log('\n=== Migration terminée avec succès ===')
}

main()
  .catch((e) => {
    console.error('Erreur lors de la migration:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
