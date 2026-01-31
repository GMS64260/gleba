/**
 * Exporte les données Gleba en CSV pour enrichissement par IA (Gemini/GPT)
 * Génère un fichier avec colonnes vides à compléter
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

async function main() {
  console.log('📊 Export des données pour enrichissement IA\n')

  // 1. Export Espèces
  const especes = await prisma.espece.findMany({
    orderBy: { id: 'asc' },
    include: { famille: true },
  })

  const especesCSV = [
    // Headers
    'id,nomLatin,famille,type,rendement_actuel,rendement_AI,besoinN_actuel,besoinN_AI,besoinP_actuel,besoinP_AI,besoinK_actuel,besoinK_AI,besoinEau_actuel,besoinEau_AI,densite_actuel,densite_AI,doseSemis_actuel,doseSemis_AI,tauxGermination_actuel,tauxGermination_AI,temperatureGerm_actuel,temperatureGerm_AI,joursLevee_actuel,joursLevee_AI,prixKg_actuel,prixKg_AI,niveau,conservation,description_actuelle,description_AI,sources_AI',
    // Data
    ...especes.map(e => [
      escapeCSV(e.id),
      escapeCSV(e.nomLatin),
      escapeCSV(e.famille?.id || e.familleId),
      escapeCSV(e.type),
      escapeCSV(e.rendement),
      '', // rendement_AI
      escapeCSV(e.besoinN),
      '', // besoinN_AI
      escapeCSV(e.besoinP),
      '', // besoinP_AI
      escapeCSV(e.besoinK),
      '', // besoinK_AI
      escapeCSV(e.besoinEau),
      '', // besoinEau_AI
      escapeCSV(e.densite),
      '', // densite_AI
      escapeCSV(e.doseSemis),
      '', // doseSemis_AI
      escapeCSV(e.tauxGermination),
      '', // tauxGermination_AI
      escapeCSV(e.temperatureGerm),
      '', // temperatureGerm_AI
      escapeCSV(e.joursLevee),
      '', // joursLevee_AI
      escapeCSV(e.prixKg),
      '', // prixKg_AI
      escapeCSV(e.niveau),
      escapeCSV(e.conservation),
      escapeCSV(e.description),
      '', // description_AI
      '', // sources_AI
    ].join(',')),
  ].join('\n')

  fs.writeFileSync('especes_to_enrich.csv', especesCSV, 'utf-8')
  console.log(`✓ especes_to_enrich.csv créé (${especes.length} espèces)`)

  // 2. Export ITPs
  const itps = await prisma.iTP.findMany({
    orderBy: { id: 'asc' },
  })

  const itpsCSV = [
    // Headers
    'id,espece,semaineSemis_actuel,semaineSemis_AI,semainePlantation_actuel,semainePlantation_AI,semaineRecolte_actuel,semaineRecolte_AI,dureeRecolte_actuel,dureeRecolte_AI,dureePepiniere_actuel,dureePepiniere_AI,dureeCulture_actuel,dureeCulture_AI,nbRangs_actuel,nbRangs_AI,espacement_actuel,espacement_AI,espacementRangs_actuel,espacementRangs_AI,typePlanche,notes_actuelle,notes_AI,sources_AI',
    // Data
    ...itps.map(i => [
      escapeCSV(i.id),
      escapeCSV(i.especeId),
      escapeCSV(i.semaineSemis),
      '', // semaineSemis_AI
      escapeCSV(i.semainePlantation),
      '', // semainePlantation_AI
      escapeCSV(i.semaineRecolte),
      '', // semaineRecolte_AI
      escapeCSV(i.dureeRecolte),
      '', // dureeRecolte_AI
      escapeCSV(i.dureePepiniere),
      '', // dureePepiniere_AI
      escapeCSV(i.dureeCulture),
      '', // dureeCulture_AI
      escapeCSV(i.nbRangs),
      '', // nbRangs_AI
      escapeCSV(i.espacement),
      '', // espacement_AI
      escapeCSV(i.espacementRangs),
      '', // espacementRangs_AI
      escapeCSV(i.typePlanche),
      escapeCSV(i.notes),
      '', // notes_AI
      '', // sources_AI
    ].join(',')),
  ].join('\n')

  fs.writeFileSync('itps_to_enrich.csv', itpsCSV, 'utf-8')
  console.log(`✓ itps_to_enrich.csv créé (${itps.length} ITPs)`)

  // 3. Export Variétés avec prix
  const varietes = await prisma.variete.findMany({
    orderBy: { id: 'asc' },
  })

  const varietesCSV = [
    // Headers
    'id,espece,fournisseur,semaineRecolte_actuel,semaineRecolte_AI,dureeRecolte_actuel,dureeRecolte_AI,nbGrainesG_actuel,nbGrainesG_AI,prixGraine_actuel,prixGraine_AI,prixVenteKg_AI,circuit_AI,description_actuelle,description_AI,sources_AI',
    // Data
    ...varietes.map(v => [
      escapeCSV(v.id),
      escapeCSV(v.especeId),
      escapeCSV(v.fournisseurId),
      escapeCSV(v.semaineRecolte),
      '', // semaineRecolte_AI
      escapeCSV(v.dureeRecolte),
      '', // dureeRecolte_AI
      escapeCSV(v.nbGrainesG),
      '', // nbGrainesG_AI
      escapeCSV(v.prixGraine),
      '', // prixGraine_AI
      '', // prixVenteKg_AI (nouveau champ pour prix de vente des récoltes)
      '', // circuit_AI (court/long)
      escapeCSV(v.description),
      '', // description_AI
      '', // sources_AI
    ].join(',')),
  ].join('\n')

  fs.writeFileSync('varietes_to_enrich.csv', varietesCSV, 'utf-8')
  console.log(`✓ varietes_to_enrich.csv créé (${varietes.length} variétés)`)

  console.log('\n📋 Instructions pour enrichissement IA:\n')
  console.log('1. Envoie les fichiers CSV à Gemini/GPT avec ce prompt:')
  console.log('---')
  console.log('Voici des données de maraîchage à enrichir. Pour chaque ligne :')
  console.log('- Remplis les colonnes *_AI avec des données fiables trouvées sur internet')
  console.log('- Sources préférées : ITAB, guides techniques maraîchage bio, Kokopelli, Germinance')
  console.log('- Indique tes sources dans la colonne sources_AI')
  console.log('- Si pas de données trouvées, laisse vide')
  console.log('- Rendement en kg/m², espacements en cm, durées en jours/semaines')
  console.log('- Prix en €/kg pour les récoltes, €/sachet pour les graines')
  console.log('- Retourne le CSV complet avec les colonnes *_AI remplies')
  console.log('---')
  console.log('\n2. Importe les CSV enrichis avec:')
  console.log('   npx tsx scripts/import-enriched-csv.ts')
  console.log('')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
