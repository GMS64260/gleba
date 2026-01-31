/**
 * Script pour mettre à jour aIrriguer sur les cultures 2026
 * basé sur le besoinEau des espèces
 *
 * Usage: npx tsx scripts/update-irrigation-2026.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Mise à jour des irrigations pour 2026...\n')

  // Récupérer toutes les cultures 2026 avec leur espèce
  const cultures2026 = await prisma.culture.findMany({
    where: { annee: 2026 },
    include: { espece: true },
  })

  console.log(`${cultures2026.length} cultures trouvées pour 2026\n`)

  let updated = 0
  for (const culture of cultures2026) {
    const espece = culture.espece

    // Besoin eau >= 3 ou irrigation explicitement "Eleve"/"Élevé"
    const needsIrrigation =
      (espece.besoinEau && espece.besoinEau >= 3) ||
      espece.irrigation?.toLowerCase() === 'eleve' ||
      espece.irrigation?.toLowerCase() === 'élevé'

    if (needsIrrigation && !culture.aIrriguer) {
      await prisma.culture.update({
        where: { id: culture.id },
        data: { aIrriguer: true },
      })
      console.log(`✓ ${espece.id} (culture #${culture.id}) - aIrriguer = true (besoinEau: ${espece.besoinEau})`)
      updated++
    } else if (needsIrrigation && culture.aIrriguer) {
      console.log(`- ${espece.id} (culture #${culture.id}) - déjà configuré`)
    } else {
      console.log(`○ ${espece.id} (culture #${culture.id}) - pas besoin d'irrigation (besoinEau: ${espece.besoinEau})`)
    }
  }

  console.log(`\n${updated} cultures mises à jour.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
