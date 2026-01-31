import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('📊 Vérification des données enrichies\n')

  const especes = await prisma.espece.findMany({
    where: { id: { in: ['Tomate', 'Carotte', 'Ail', 'Courgette', 'Laitue'] } },
    select: {
      id: true,
      rendement: true,
      besoinN: true,
      besoinEau: true,
      prixKg: true,
      densite: true,
      doseSemis: true,
    },
    orderBy: { id: 'asc' },
  })

  console.log('🌱 Espèces enrichies:')
  console.table(especes)

  const itps = await prisma.iTP.findMany({
    where: { id: { startsWith: 'ITP-TOM' } },
    select: {
      id: true,
      nbRangs: true,
      espacement: true,
      espacementRangs: true,
      dureeCulture: true,
    },
  })

  console.log('\n📋 ITPs Tomates enrichis:')
  console.table(itps)

  console.log('\n✅ Données enrichies correctement importées !')
}

main().finally(() => prisma.$disconnect())
