/**
 * Importe les CSV enrichis par IA dans Gleba
 * Fusionne les données actuelles avec les enrichissements IA
 *
 * Usage: npx tsx scripts/import-enriched-csv.ts
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

function parseCSV(filePath: string): any[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim())

  if (lines.length === 0) return []

  const headers = parseCSVLine(lines[0])
  const data: any[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: any = {}
    headers.forEach((header, idx) => {
      row[header] = values[idx] || null
    })
    data.push(row)
  }

  return data
}

function parseCSVLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  values.push(current.trim())
  return values
}

function parseNumber(value: string | null): number | null {
  if (!value || value === '') return null
  const num = parseFloat(value)
  return isNaN(num) ? null : num
}

function parseInt(value: string | null): number | null {
  if (!value || value === '') return null
  const num = Number.parseInt(value)
  return isNaN(num) ? null : num
}

async function importEspeces(file: string) {
  console.log('\n🌱 Import Espèces enrichies...')

  if (!fs.existsSync(file)) {
    console.log(`⚠️  Fichier non trouvé: ${file}`)
    return
  }

  const data = parseCSV(file)
  let updated = 0
  let skipped = 0

  for (const row of data) {
    try {
      const updateData: any = {}
      let hasUpdates = false

      // Fusionner les données AI si présentes et différentes de l'actuel
      if (row.rendement_AI && row.rendement_AI !== row.rendement_actuel) {
        updateData.rendement = parseNumber(row.rendement_AI)
        hasUpdates = true
      }
      if (row.besoinN_AI && row.besoinN_AI !== row.besoinN_actuel) {
        updateData.besoinN = parseInt(row.besoinN_AI)
        hasUpdates = true
      }
      if (row.besoinP_AI && row.besoinP_AI !== row.besoinP_actuel) {
        updateData.besoinP = parseInt(row.besoinP_AI)
        hasUpdates = true
      }
      if (row.besoinK_AI && row.besoinK_AI !== row.besoinK_actuel) {
        updateData.besoinK = parseInt(row.besoinK_AI)
        hasUpdates = true
      }
      if (row.besoinEau_AI && row.besoinEau_AI !== row.besoinEau_actuel) {
        updateData.besoinEau = parseInt(row.besoinEau_AI)
        hasUpdates = true
      }
      if (row.densite_AI && row.densite_AI !== row.densite_actuel) {
        updateData.densite = parseNumber(row.densite_AI)
        hasUpdates = true
      }
      if (row.doseSemis_AI && row.doseSemis_AI !== row.doseSemis_actuel) {
        updateData.doseSemis = parseNumber(row.doseSemis_AI)
        hasUpdates = true
      }
      if (row.tauxGermination_AI && row.tauxGermination_AI !== row.tauxGermination_actuel) {
        updateData.tauxGermination = parseInt(row.tauxGermination_AI)
        hasUpdates = true
      }
      if (row.temperatureGerm_AI && row.temperatureGerm_AI !== row.temperatureGerm_actuel) {
        updateData.temperatureGerm = row.temperatureGerm_AI
        hasUpdates = true
      }
      if (row.joursLevee_AI && row.joursLevee_AI !== row.joursLevee_actuel) {
        updateData.joursLevee = parseInt(row.joursLevee_AI)
        hasUpdates = true
      }
      if (row.prixKg_AI && row.prixKg_AI !== row.prixKg_actuel) {
        updateData.prixKg = parseNumber(row.prixKg_AI)
        hasUpdates = true
      }
      if (row.description_AI && row.description_AI !== row.description_actuelle) {
        // Ajouter la source si fournie
        const newDesc = row.sources_AI
          ? `${row.description_AI}\n\nSource: ${row.sources_AI}`
          : row.description_AI
        updateData.description = newDesc
        hasUpdates = true
      }

      if (hasUpdates) {
        await prisma.espece.update({
          where: { id: row.id },
          data: updateData,
        })
        updated++
        console.log(`↻ ${row.id} - ${Object.keys(updateData).join(', ')}`)
      } else {
        skipped++
      }
    } catch (error) {
      console.error(`Erreur ${row.id}:`, error)
    }
  }

  console.log(`✓ ${updated} espèces mises à jour, ${skipped} inchangées`)
}

async function importITPs(file: string) {
  console.log('\n📋 Import ITPs enrichis...')

  if (!fs.existsSync(file)) {
    console.log(`⚠️  Fichier non trouvé: ${file}`)
    return
  }

  const data = parseCSV(file)
  let updated = 0
  let skipped = 0

  for (const row of data) {
    try {
      const updateData: any = {}
      let hasUpdates = false

      if (row.semaineSemis_AI && row.semaineSemis_AI !== row.semaineSemis_actuel) {
        updateData.semaineSemis = parseInt(row.semaineSemis_AI)
        hasUpdates = true
      }
      if (row.semainePlantation_AI && row.semainePlantation_AI !== row.semainePlantation_actuel) {
        updateData.semainePlantation = parseInt(row.semainePlantation_AI)
        hasUpdates = true
      }
      if (row.semaineRecolte_AI && row.semaineRecolte_AI !== row.semaineRecolte_actuel) {
        updateData.semaineRecolte = parseInt(row.semaineRecolte_AI)
        hasUpdates = true
      }
      if (row.dureeRecolte_AI && row.dureeRecolte_AI !== row.dureeRecolte_actuel) {
        updateData.dureeRecolte = parseInt(row.dureeRecolte_AI)
        hasUpdates = true
      }
      if (row.dureePepiniere_AI && row.dureePepiniere_AI !== row.dureePepiniere_actuel) {
        updateData.dureePepiniere = parseInt(row.dureePepiniere_AI)
        hasUpdates = true
      }
      if (row.dureeCulture_AI && row.dureeCulture_AI !== row.dureeCulture_actuel) {
        updateData.dureeCulture = parseInt(row.dureeCulture_AI)
        hasUpdates = true
      }
      if (row.nbRangs_AI && row.nbRangs_AI !== row.nbRangs_actuel) {
        updateData.nbRangs = parseInt(row.nbRangs_AI)
        hasUpdates = true
      }
      if (row.espacement_AI && row.espacement_AI !== row.espacement_actuel) {
        updateData.espacement = parseInt(row.espacement_AI)
        hasUpdates = true
      }
      if (row.espacementRangs_AI && row.espacementRangs_AI !== row.espacementRangs_actuel) {
        updateData.espacementRangs = parseInt(row.espacementRangs_AI)
        hasUpdates = true
      }
      if (row.notes_AI && row.notes_AI !== row.notes_actuelle) {
        const newNotes = row.sources_AI
          ? `${row.notes_AI}\nSource: ${row.sources_AI}`
          : row.notes_AI
        updateData.notes = newNotes
        hasUpdates = true
      }

      if (hasUpdates) {
        await prisma.iTP.update({
          where: { id: row.id },
          data: updateData,
        })
        updated++
        console.log(`↻ ${row.id} - ${Object.keys(updateData).join(', ')}`)
      } else {
        skipped++
      }
    } catch (error) {
      console.error(`Erreur ${row.id}:`, error)
    }
  }

  console.log(`✓ ${updated} ITPs mis à jour, ${skipped} inchangés`)
}

async function importVarietes(file: string) {
  console.log('\n🌾 Import Variétés enrichies...')

  if (!fs.existsSync(file)) {
    console.log(`⚠️  Fichier non trouvé: ${file}`)
    return
  }

  const data = parseCSV(file)
  let updated = 0
  let skipped = 0

  for (const row of data) {
    try {
      const updateData: any = {}
      let hasUpdates = false

      if (row.semaineRecolte_AI && row.semaineRecolte_AI !== row.semaineRecolte_actuel) {
        updateData.semaineRecolte = parseInt(row.semaineRecolte_AI)
        hasUpdates = true
      }
      if (row.dureeRecolte_AI && row.dureeRecolte_AI !== row.dureeRecolte_actuel) {
        updateData.dureeRecolte = parseInt(row.dureeRecolte_AI)
        hasUpdates = true
      }
      if (row.nbGrainesG_AI && row.nbGrainesG_AI !== row.nbGrainesG_actuel) {
        updateData.nbGrainesG = parseNumber(row.nbGrainesG_AI)
        hasUpdates = true
      }
      if (row.prixGraine_AI && row.prixGraine_AI !== row.prixGraine_actuel) {
        updateData.prixGraine = parseNumber(row.prixGraine_AI)
        hasUpdates = true
      }
      if (row.description_AI && row.description_AI !== row.description_actuelle) {
        const newDesc = row.sources_AI
          ? `${row.description_AI}\nSource: ${row.sources_AI}`
          : row.description_AI
        updateData.description = newDesc
        hasUpdates = true
      }

      if (hasUpdates) {
        await prisma.variete.update({
          where: { id: row.id },
          data: updateData,
        })
        updated++
        console.log(`↻ ${row.id} - ${Object.keys(updateData).join(', ')}`)
      } else {
        skipped++
      }
    } catch (error) {
      console.error(`Erreur ${row.id}:`, error)
    }
  }

  console.log(`✓ ${updated} variétés mises à jour, ${skipped} inchangées`)
}

async function main() {
  console.log('🔄 Import des CSV enrichis par IA\n')

  const files = {
    especes: fs.existsSync('especes_enriched.csv') ? 'especes_enriched.csv' : 'especes_to_enrich.csv',
    itps: fs.existsSync('itps_enriched.csv') ? 'itps_enriched.csv' : 'itps_to_enrich.csv',
    varietes: fs.existsSync('varietes_enriched.csv') ? 'varietes_enriched.csv' : 'varietes_to_enrich.csv',
  }

  // Vérifier quels fichiers existent
  const existing = Object.entries(files).filter(([_, file]) => fs.existsSync(file))

  if (existing.length === 0) {
    console.log('❌ Aucun fichier enrichi trouvé.')
    console.log('Fichiers attendus: especes_to_enrich.csv, itps_to_enrich.csv, varietes_to_enrich.csv')
    return
  }

  console.log(`Fichiers trouvés: ${existing.map(([name]) => name).join(', ')}\n`)

  // Importer chaque type
  if (fs.existsSync(files.especes)) {
    await importEspeces(files.especes)
  }

  if (fs.existsSync(files.itps)) {
    await importITPs(files.itps)
  }

  if (fs.existsSync(files.varietes)) {
    await importVarietes(files.varietes)
  }

  console.log('\n✅ Import terminé !')
  console.log('\n💡 Les données ont été enrichies avec les informations de l\'IA')
  console.log('   Les sources sont ajoutées dans les descriptions/notes')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
