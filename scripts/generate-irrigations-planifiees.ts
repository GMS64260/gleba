/**
 * Script pour générer les irrigations planifiées
 * Pour chaque culture avec aIrriguer = true:
 * - Génère des irrigations tous les 2-3 jours (selon besoin eau)
 * - De la date de plantation à la fin de récolte
 *
 * Usage: npx tsx scripts/generate-irrigations-planifiees.ts [--annee 2026] [--force]
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Parse arguments
const args = process.argv.slice(2)
const anneeArg = args.find(a => a.startsWith('--annee='))
const annee = anneeArg ? parseInt(anneeArg.split('=')[1]) : new Date().getFullYear()
const force = args.includes('--force')

async function main() {
  console.log(`\n🌱 Génération des irrigations planifiées pour ${annee}\n`)

  if (force) {
    // Supprimer les irrigations existantes pour l'année
    const deleted = await prisma.irrigationPlanifiee.deleteMany({
      where: {
        culture: { annee },
      },
    })
    console.log(`⚠️  ${deleted.count} irrigations existantes supprimées (--force)\n`)
  }

  // Récupérer les cultures avec irrigation
  const cultures = await prisma.culture.findMany({
    where: {
      annee,
      aIrriguer: true,
      terminee: null,
    },
    include: {
      espece: {
        select: {
          id: true,
          besoinEau: true,
        },
      },
      irrigationsPlanifiees: true,
    },
  })

  console.log(`${cultures.length} cultures à irriguer trouvées\n`)

  let totalCreated = 0

  for (const culture of cultures) {
    // Si déjà des irrigations planifiées et pas --force, skip
    if (!force && culture.irrigationsPlanifiees.length > 0) {
      console.log(`⏭️  ${culture.especeId} (culture #${culture.id}) - ${culture.irrigationsPlanifiees.length} irrigations déjà planifiées`)
      continue
    }

    // Déterminer les dates
    const dateDebut = culture.datePlantation || culture.dateSemis
    const dateFin = culture.finRecolte || culture.dateRecolte

    if (!dateDebut) {
      console.log(`⚠️  ${culture.especeId} (culture #${culture.id}) - pas de date de départ`)
      continue
    }

    // Fréquence selon besoin en eau
    const besoinEau = culture.espece.besoinEau || 3
    const frequenceJours = besoinEau >= 4 ? 2 : 3

    // Générer les irrigations
    const irrigations: Date[] = []
    let currentDate = new Date(dateDebut)
    currentDate.setDate(currentDate.getDate() + frequenceJours) // Première irrigation après X jours

    const finDate = dateFin ? new Date(dateFin) : new Date(dateDebut.getFullYear(), 11, 31) // Fin d'année par défaut

    while (currentDate <= finDate) {
      irrigations.push(new Date(currentDate))
      currentDate.setDate(currentDate.getDate() + frequenceJours)
    }

    // Créer en base
    if (irrigations.length > 0) {
      await prisma.irrigationPlanifiee.createMany({
        data: irrigations.map(date => ({
          userId: culture.userId,
          cultureId: culture.id,
          datePrevue: date,
          fait: false,
        })),
      })

      totalCreated += irrigations.length
      console.log(`✓ ${culture.especeId} (culture #${culture.id}) - ${irrigations.length} irrigations créées (fréquence: ${frequenceJours}j)`)
    } else {
      console.log(`⚠️  ${culture.especeId} (culture #${culture.id}) - aucune irrigation à générer`)
    }
  }

  console.log(`\n✅ ${totalCreated} irrigations planifiées créées au total`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
