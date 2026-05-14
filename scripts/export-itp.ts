/**
 * Export du référentiel ITP en CSV pour audit agronomique.
 *
 * Usage :
 *   npx tsx scripts/export-itp.ts > audit/itp-current.csv
 *
 * À regénérer après chaque vague de corrections agronomiques pour conserver
 * un diff archivable dans `audit/` (avant / après).
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

async function main(): Promise<void> {
  const itps = await prisma.iTP.findMany({
    include: {
      espece: { select: { id: true, familleId: true, nomLatin: true } },
    },
    orderBy: [{ especeId: 'asc' }, { id: 'asc' }],
  })

  const headers = [
    'itp_id',
    'espece',
    'famille',
    'nom_latin',
    'type_planche',
    'semaine_semis',
    'semaine_plantation',
    'semaine_recolte',
    'duree_recolte',
    'duree_pepiniere',
    'duree_culture',
    'nb_rangs',
    'espacement_cm',
    'esp_rangs_cm',
    'dose_semis',
    'notes',
  ]
  console.log(headers.join(','))

  for (const itp of itps) {
    const row = [
      itp.id,
      itp.espece?.id ?? '',
      itp.espece?.familleId ?? '',
      itp.espece?.nomLatin ?? '',
      itp.typePlanche ?? '',
      itp.semaineSemis ?? '',
      itp.semainePlantation ?? '',
      itp.semaineRecolte ?? '',
      itp.dureeRecolte ?? '',
      itp.dureePepiniere ?? '',
      itp.dureeCulture ?? '',
      itp.nbRangs ?? '',
      itp.espacement ?? '',
      itp.espacementRangs ?? '',
      itp.doseSemis ?? '',
      (itp.notes ?? '').replace(/\r?\n/g, ' \\n '),
    ]
    console.log(row.map(csvEscape).join(','))
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
