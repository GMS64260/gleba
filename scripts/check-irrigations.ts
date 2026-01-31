import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const count = await prisma.irrigationPlanifiee.count()
  console.log(`Total irrigations: ${count}`)

  if (count > 0) {
    const first = await prisma.irrigationPlanifiee.findFirst({
      orderBy: { datePrevue: 'asc' },
      include: { culture: { select: { especeId: true } } },
    })
    const last = await prisma.irrigationPlanifiee.findFirst({
      orderBy: { datePrevue: 'desc' },
      include: { culture: { select: { especeId: true } } },
    })

    console.log(`Première irrigation: ${first?.datePrevue} - ${first?.culture.especeId}`)
    console.log(`Dernière irrigation: ${last?.datePrevue} - ${last?.culture.especeId}`)

    // Irrigations par mois
    const byMonth = await prisma.$queryRaw`
      SELECT
        TO_CHAR(date_prevue, 'YYYY-MM') as mois,
        COUNT(*)::int as nb
      FROM irrigations_planifiees
      GROUP BY TO_CHAR(date_prevue, 'YYYY-MM')
      ORDER BY mois
      LIMIT 12
    `
    console.log('\nIrrigations par mois:')
    console.table(byMonth)
  }
}

main().finally(() => prisma.$disconnect())
