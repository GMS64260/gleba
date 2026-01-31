/**
 * Script d'import de la base INRAE Pépinière-Mesclun
 * Source: https://entrepot.recherche.data.gouv.fr/dataset.xhtml?persistentId=doi:10.57745/IQVM2I
 * Licence: Etalab 2.0
 *
 * Usage: npx tsx scripts/import-inrae-data.ts
 */

import { PrismaClient } from '@prisma/client'
import * as https from 'https'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

// URL du fichier INRAE
const INRAE_FILE_URL = 'https://entrepot.recherche.data.gouv.fr/api/access/datafile/183229'
const LOCAL_FILE = path.join(process.cwd(), 'inrae-data.tab')

/**
 * Télécharge le fichier INRAE
 */
async function downloadFile(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('📥 Téléchargement du fichier INRAE...')

    const file = fs.createWriteStream(LOCAL_FILE)
    https.get(INRAE_FILE_URL, (response) => {
      response.pipe(file)
      file.on('finish', () => {
        file.close()
        console.log(`✓ Fichier téléchargé: ${LOCAL_FILE}`)
        resolve()
      })
    }).on('error', (err) => {
      fs.unlink(LOCAL_FILE, () => {})
      reject(err)
    })
  })
}

/**
 * Parse le fichier TAB (TSV)
 */
function parseTabFile(): any[] {
  console.log('📖 Lecture du fichier...')

  const content = fs.readFileSync(LOCAL_FILE, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim())

  if (lines.length === 0) {
    throw new Error('Fichier vide')
  }

  // Première ligne = headers
  const headers = lines[0].split('\t').map(h => h.trim())
  console.log(`✓ Colonnes trouvées: ${headers.join(', ')}`)

  // Parse les données
  const data: any[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split('\t')
    const row: any = {}
    headers.forEach((header, idx) => {
      row[header] = values[idx]?.trim() || null
    })
    data.push(row)
  }

  console.log(`✓ ${data.length} enregistrements lus\n`)
  return data
}

/**
 * Mapper les données INRAE vers le schéma Gleba
 */
async function importData(data: any[]) {
  console.log('💾 Import dans Gleba...\n')

  let especesCreated = 0
  let especesUpdated = 0
  let itpsCreated = 0

  for (const row of data) {
    try {
      // Le nom du légume devrait être dans une colonne comme "Espece", "Legume", "Nom" etc.
      // À adapter selon les vraies colonnes du fichier INRAE
      const nomLegume = row['Espece'] || row['Legume'] || row['Nom']
      if (!nomLegume) continue

      // Nettoyer le nom
      const especeId = nomLegume.charAt(0).toUpperCase() + nomLegume.slice(1).toLowerCase()

      // Vérifier si l'espèce existe
      const existing = await prisma.espece.findUnique({
        where: { id: especeId },
      })

      // Parser les données INRAE
      const rendement = row['Rendement'] ? parseFloat(row['Rendement']) : null
      const cycleJours = row['Cycle'] || row['DureeCulture'] ? parseInt(row['Cycle'] || row['DureeCulture']) : null

      // Créer ou updater l'espèce
      if (existing) {
        // Updater seulement si les données INRAE sont plus complètes
        if (rendement && !existing.rendement) {
          await prisma.espece.update({
            where: { id: especeId },
            data: {
              rendement,
              description: row['Description'] || existing.description,
            },
          })
          especesUpdated++
          console.log(`↻ ${especeId} - rendement mis à jour: ${rendement}kg/m²`)
        }
      } else {
        // Créer nouvelle espèce
        await prisma.espece.create({
          data: {
            id: especeId,
            type: 'legume',
            rendement,
            vivace: false,
            aPlanifier: true,
            description: row['Description'] || null,
          },
        })
        especesCreated++
        console.log(`+ ${especeId} créé`)
      }

      // Créer un ITP si on a des données de cycle
      if (cycleJours) {
        const itpId = `ITP-INRAE-${especeId.toUpperCase()}`

        const existingItp = await prisma.iTP.findUnique({
          where: { id: itpId },
        })

        if (!existingItp) {
          await prisma.iTP.create({
            data: {
              id: itpId,
              especeId,
              dureeCulture: cycleJours,
              notes: 'Données INRAE Pépinière-Mesclun',
            },
          })
          itpsCreated++
          console.log(`  → ITP créé: ${itpId} (${cycleJours}j)`)
        }
      }

    } catch (error) {
      console.error(`Erreur sur ${row['Espece'] || row['Legume']}:`, error)
    }
  }

  console.log(`\n✅ Import terminé:`)
  console.log(`  + ${especesCreated} espèces créées`)
  console.log(`  ↻ ${especesUpdated} espèces mises à jour`)
  console.log(`  + ${itpsCreated} ITPs créés`)
  console.log(`\n📝 Source: INRAE Pépinière-Mesclun (Licence Etalab 2.0)`)
  console.log(`   https://entrepot.recherche.data.gouv.fr/dataset.xhtml?persistentId=doi:10.57745/IQVM2I`)
}

async function main() {
  console.log('🌱 Import base INRAE Pépinière-Mesclun\n')

  try {
    // Télécharger si pas déjà fait
    if (!fs.existsSync(LOCAL_FILE)) {
      await downloadFile()
    } else {
      console.log(`ℹ️  Fichier déjà téléchargé: ${LOCAL_FILE}`)
      console.log('   Supprimez-le pour re-télécharger\n')
    }

    // Parser le fichier
    const data = parseTabFile()

    // Afficher un aperçu des colonnes
    if (data.length > 0) {
      console.log('📊 Aperçu des données (première ligne):')
      console.log(JSON.stringify(data[0], null, 2))
      console.log('\n')

      // Demander confirmation
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout,
      })

      readline.question('Continuer l\'import ? (y/N) ', async (answer: string) => {
        readline.close()

        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
          await importData(data)
        } else {
          console.log('Import annulé')
        }

        await prisma.$disconnect()
      })
    }
  } catch (error) {
    console.error('Erreur:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

main()
