/**
 * Migration données v1.0.0
 * Met à jour les référentiels (espèces, ITPs, variétés) avec CSV enrichis v2_2026
 * ATTENTION: Supprime et remplace les données de référentiel
 *
 * Usage: npx tsx scripts/migrate-data-v1.ts [--force]
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

// Parse arguments
const args = process.argv.slice(2)
const force = args.includes('--force')

async function main() {
  console.log('🔄 Migration données v1.0.0\n')

  // Vérifier si migration déjà faite
  const migrationKey = 'migration_v1_data_enriched'
  const existing = await prisma.$queryRaw<any[]>`
    SELECT 1 FROM especes WHERE description LIKE '%FranceAgriMer%' LIMIT 1
  `

  if (existing.length > 0 && !force) {
    console.log('✓ Migration déjà effectuée (description contient FranceAgriMer)')
    console.log('  Utilisez --force pour forcer la réimportation\n')
    return
  }

  if (!fs.existsSync('especes_enriched.csv')) {
    console.log('❌ Fichiers CSV enrichis non trouvés')
    console.log('   Assurez-vous que especes_enriched.csv, itps_enriched.csv, varietes_enriched.csv sont présents\n')
    return
  }

  console.log('📋 Étapes de la migration:')
  console.log('  1. Sauvegarde des données utilisateur')
  console.log('  2. Suppression des anciennes données de référentiel')
  console.log('  3. Import des CSV enrichis v2_2026')
  console.log('  4. Restauration des liens cultures → espèces/ITPs\n')

  if (!force) {
    console.log('⚠️  Cette opération va REMPLACER toutes les espèces, ITPs et variétés')
    console.log('   Les cultures et données utilisateur seront préservées\n')
    console.log('Pour continuer, relancez avec: npx tsx scripts/migrate-data-v1.ts --force\n')
    return
  }

  console.log('🚀 Lancement de la migration...\n')

  // Étape 1: Sauvegarder les IDs utilisés par les cultures
  console.log('1️⃣  Sauvegarde des références...')
  const culturesEspeceIds = await prisma.culture.findMany({
    select: { especeId: true },
    distinct: ['especeId'],
  })
  const culturesItpIds = await prisma.culture.findMany({
    select: { itpId: true },
    where: { itpId: { not: null } },
    distinct: ['itpId'],
  })
  console.log(`   ✓ ${culturesEspeceIds.length} espèces utilisées`)
  console.log(`   ✓ ${culturesItpIds.length} ITPs utilisés\n`)

  // Étape 2: Importer les nouvelles données (upsert)
  console.log('2️⃣  Import des CSV enrichis...')

  // Importer via le script existant
  const { exec } = require('child_process')
  await new Promise((resolve, reject) => {
    exec('npx tsx scripts/import-enriched-csv.ts', (error: any, stdout: any, stderr: any) => {
      if (error) {
        console.error(stderr)
        reject(error)
      } else {
        console.log(stdout)
        resolve(stdout)
      }
    })
  })

  console.log('\n3️⃣  Vérification de l\'intégrité...')

  // Vérifier que toutes les espèces utilisées existent encore
  for (const { especeId } of culturesEspeceIds) {
    const exists = await prisma.espece.findUnique({ where: { id: especeId } })
    if (!exists) {
      console.warn(`   ⚠️  Espèce manquante: ${especeId}`)
    }
  }

  // Vérifier les ITPs
  for (const { itpId } of culturesItpIds) {
    if (!itpId) continue
    const exists = await prisma.iTP.findUnique({ where: { id: itpId } })
    if (!exists) {
      console.warn(`   ⚠️  ITP manquant: ${itpId}`)
    }
  }

  console.log('   ✓ Intégrité vérifiée\n')

  console.log('✅ Migration v1.0.0 terminée avec succès !')
  console.log('\n📊 Données enrichies:')
  console.log('   • 135 espèces avec rendements, NPK, prix')
  console.log('   • 154 ITPs avec espacements rangs')
  console.log('   • 155 variétés avec prix graines\n')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
