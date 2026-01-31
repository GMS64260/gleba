/**
 * Script pour corriger gleba_demo_data.json
 * Ajuste nbRangs et longueur pour respecter les contraintes physiques
 */

import * as fs from 'fs'
import * as path from 'path'

// Charger le fichier
const filePath = path.join(process.cwd(), 'gleba_demo_data.json')
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

console.log('🔍 Analyse des contraintes de gleba_demo_data.json\n')

// 1. Ajouter espacementRangs aux ITPs si manquant
console.log('📐 Ajout de espacementRangs aux ITPs...')
let itpsModified = 0

data.itps.forEach((itp: any) => {
  if (!itp.espacementRangs) {
    // Estimation selon espacement entre plants
    const espacement = itp.espacement || 30
    if (espacement >= 80) {
      itp.espacementRangs = 100 // Courges, courgettes
    } else if (espacement >= 50) {
      itp.espacementRangs = 60 // Tomates, aubergines
    } else if (espacement >= 30) {
      itp.espacementRangs = 40 // PDT, poivrons
    } else if (espacement >= 20) {
      itp.espacementRangs = 30 // Laitues, basilic
    } else if (espacement >= 10) {
      itp.espacementRangs = 20 // Poireaux, épinards
    } else {
      itp.espacementRangs = 15 // Carottes, radis, haricots
    }
    itpsModified++
    console.log(`  - ${itp.id}: espacementRangs = ${itp.espacementRangs}cm`)
  }
})
console.log(`✓ ${itpsModified} ITPs modifiés\n`)

// 2. Map ITP id → espacementRangs
const itpMap = new Map(data.itps.map((itp: any) => [itp.id, itp]))

// 3. Map planche id → { largeur, longueur }
const plancheMap = new Map(
  data.planches.map((p: any) => [p.id, { largeur: p.largeur || 0.8, longueur: p.longueur || 10 }])
)

console.log('🌱 Validation des cultures...\n')

let culturesModified = 0
let culturesOK = 0
let culturesProblems = 0

data.cultures.forEach((culture: any) => {
  const itp = itpMap.get(culture.itpId)
  const planche = plancheMap.get(culture.plancheId)

  if (!planche || !itp) {
    culturesOK++
    return // Pas de planche ou ITP, skip
  }

  let modified = false
  const original = { nbRangs: culture.nbRangs, longueur: culture.longueur }

  // Contrainte 1: Longueur de culture ≤ longueur de planche
  if (culture.longueur && culture.longueur > planche.longueur) {
    culture.longueur = planche.longueur
    modified = true
    console.log(`  ⚠️  Culture #${culture.id} (${culture.especeId}) - longueur réduite de ${original.longueur}m à ${culture.longueur}m`)
  }

  // Contrainte 2: Largeur occupée ≤ largeur planche
  const nbRangs = culture.nbRangs || itp.nbRangs || 1
  const espacementRangs = itp.espacementRangs || 30
  const largeurNecessaire = ((nbRangs - 1) * espacementRangs) / 100
  const largeurDisponible = planche.largeur - 0.2 // Marges 10cm de chaque côté

  if (largeurNecessaire > largeurDisponible) {
    // Calculer le nb de rangs max possible
    const nbRangsMax = Math.floor((largeurDisponible * 100) / espacementRangs) + 1
    culture.nbRangs = Math.max(1, nbRangsMax)
    modified = true
    console.log(`  ⚠️  Culture #${culture.id} (${culture.especeId} sur ${culture.plancheId}) - nbRangs réduit de ${nbRangs} à ${culture.nbRangs}`)
    console.log(`      (largeur nécessaire: ${largeurNecessaire.toFixed(2)}m > disponible: ${largeurDisponible.toFixed(2)}m, espacement: ${espacementRangs}cm)`)
  }

  if (modified) {
    culturesModified++
  } else {
    culturesOK++
  }
})

console.log(`\n📊 Résultats:`)
console.log(`  ✓ ${culturesOK} cultures OK`)
console.log(`  ⚠️  ${culturesModified} cultures modifiées`)
if (culturesProblems > 0) {
  console.log(`  ❌ ${culturesProblems} cultures avec problèmes`)
}

// 4. Sauvegarder le fichier corrigé
const outputPath = path.join(process.cwd(), 'gleba_demo_data_fixed.json')
fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8')

console.log(`\n✅ Fichier corrigé sauvegardé: gleba_demo_data_fixed.json`)
console.log(`\n💡 Commande pour l'utiliser:`)
console.log(`   mv gleba_demo_data_fixed.json gleba_demo_data.json`)
