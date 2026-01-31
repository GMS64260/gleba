import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Simuler ce que fait l'API calendrier
  const start = new Date('2026-05-01T00:00:00.000Z')
  const end = new Date('2026-05-31T23:59:59.999Z')

  console.log(`\nRécupération événements calendrier Mai 2026`)
  console.log(`Du ${start.toLocaleDateString()} au ${end.toLocaleDateString()}\n`)

  const [semis, plantations, recoltes, irrigations] = await Promise.all([
    prisma.culture.count({
      where: {
        dateSemis: { gte: start, lte: end },
      },
    }),
    prisma.culture.count({
      where: {
        datePlantation: { gte: start, lte: end },
      },
    }),
    prisma.culture.count({
      where: {
        dateRecolte: { gte: start, lte: end },
      },
    }),
    prisma.irrigationPlanifiee.count({
      where: {
        datePrevue: { gte: start, lte: end },
      },
    }),
  ])

  console.log(`📊 Statistiques:`)
  console.log(`  🌱 Semis: ${semis}`)
  console.log(`  🌿 Plantations: ${plantations}`)
  console.log(`  🍅 Récoltes: ${recoltes}`)
  console.log(`  💧 Irrigations: ${irrigations}`)
  console.log(`  📅 Total: ${semis + plantations + recoltes + irrigations}`)

  // Quelques exemples d'irrigations
  console.log(`\n💧 Exemples d'irrigations en mai 2026:`)
  const examples = await prisma.irrigationPlanifiee.findMany({
    where: {
      datePrevue: { gte: start, lte: end },
    },
    include: {
      culture: {
        select: { especeId: true },
      },
    },
    take: 10,
    orderBy: { datePrevue: 'asc' },
  })

  examples.forEach(i => {
    console.log(`  - ${i.datePrevue.toLocaleDateString()} : ${i.culture.especeId} (ID: ${i.id})`)
  })
}

main().finally(() => prisma.$disconnect())
