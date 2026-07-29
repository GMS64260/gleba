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
    'semaine_implantation_debut',
    'semaine_implantation_fin',
    'semaine_recolte',
    'semaine_recolte_fin',
    'duree_recolte',
    'duree_pepiniere',
    'duree_culture',
    'nb_rangs',
    'espacement_cm',
    'esp_rangs_cm',
    'dose_semis',
    'implantation',
    'forcage',
    'zone_climat',
    'contexte_climatique',
    'statut_validation',
    'actif',
    'source_reference',
    'source_url',
    'source_record_id',
    'source_version',
    'source_licence',
    'derniere_revision',
    'commentaire_agronome',
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
      itp.semaineImplantationDebut ?? '',
      itp.semaineImplantationFin ?? '',
      itp.semaineRecolte ?? '',
      itp.semaineRecolteFin ?? '',
      itp.dureeRecolte ?? '',
      itp.dureePepiniere ?? '',
      itp.dureeCulture ?? '',
      itp.nbRangs ?? '',
      itp.espacement ?? '',
      itp.espacementRangs ?? '',
      itp.doseSemis ?? '',
      itp.implantation ?? '',
      itp.forcage ?? '',
      itp.zoneClimat ?? '',
      itp.contexteClimatique ?? '',
      itp.statutValidation,
      itp.actif,
      itp.sourceReference ?? '',
      itp.sourceUrl ?? '',
      itp.sourceRecordId ?? '',
      itp.sourceVersion ?? '',
      itp.sourceLicence ?? '',
      itp.derniereRevision?.toISOString() ?? '',
      (itp.commentaireAgronome ?? '').replace(/\r?\n/g, ' \\n '),
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
