/**
 * Seed de données initiales pour Potaléger
 * Basé sur CreateBaseData.sql du projet Qt
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // ============================================================
  // FAMILLES BOTANIQUES
  // ============================================================
  const familles = [
    { id: 'Alliacées', intervalle: 4, couleur: '#9333ea', description: 'Ail, oignon, poireau, échalote...' },
    { id: 'Apiacées', intervalle: 4, couleur: '#f97316', description: 'Carotte, céleri, persil, fenouil...' },
    { id: 'Astéracées', intervalle: 3, couleur: '#eab308', description: 'Laitue, chicorée, artichaut...' },
    { id: 'Brassicacées', intervalle: 4, couleur: '#22c55e', description: 'Chou, radis, navet, roquette...' },
    { id: 'Chénopodiacées', intervalle: 3, couleur: '#ef4444', description: 'Betterave, épinard, blette...' },
    { id: 'Cucurbitacées', intervalle: 3, couleur: '#f59e0b', description: 'Courgette, courge, concombre, melon...' },
    { id: 'Fabacées', intervalle: 3, couleur: '#84cc16', description: 'Haricot, pois, fève... (enrichit en azote)' },
    { id: 'Lamiacées', intervalle: 2, couleur: '#14b8a6', description: 'Basilic, menthe, thym, romarin...' },
    { id: 'Poacées', intervalle: 2, couleur: '#a3e635', description: 'Maïs, céréales' },
    { id: 'Solanacées', intervalle: 4, couleur: '#dc2626', description: 'Tomate, poivron, aubergine, pomme de terre...' },
    { id: 'Valérianacées', intervalle: 2, couleur: '#06b6d4', description: 'Mâche' },
    { id: 'Engrais vert', intervalle: 0, couleur: '#65a30d', description: 'Cultures non récoltées (moutarde, phacélie...)' },
  ]

  for (const famille of familles) {
    await prisma.famille.upsert({
      where: { id: famille.id },
      update: famille,
      create: famille,
    })
  }
  console.log(`✓ ${familles.length} familles créées`)

  // ============================================================
  // DESTINATIONS
  // ============================================================
  const destinations = [
    { id: 'Auto-consommation', description: 'Consommation personnelle' },
    { id: 'Vente directe', description: 'Vente au marché ou à la ferme' },
    { id: 'AMAP', description: 'Association pour le maintien d\'une agriculture paysanne' },
    { id: 'Restaurant', description: 'Vente à des restaurants' },
    { id: 'Don', description: 'Don à des associations ou particuliers' },
    { id: 'Transformation', description: 'Conserves, confitures, etc.' },
    { id: 'Pertes', description: 'Pertes, invendus, maladies' },
  ]

  for (const dest of destinations) {
    await prisma.destination.upsert({
      where: { id: dest.id },
      update: dest,
      create: dest,
    })
  }
  console.log(`✓ ${destinations.length} destinations créées`)

  // ============================================================
  // ESPÈCES PRINCIPALES
  // ============================================================
  const especes = [
    // Solanacées
    { id: 'Tomate', familleId: 'Solanacées', rendement: 5, vivace: false, besoinN: 4, besoinEau: 4, couleur: '#dc2626' },
    { id: 'Poivron', familleId: 'Solanacées', rendement: 3, vivace: false, besoinN: 3, besoinEau: 4, couleur: '#ef4444' },
    { id: 'Aubergine', familleId: 'Solanacées', rendement: 3, vivace: false, besoinN: 3, besoinEau: 4, couleur: '#7c3aed' },
    { id: 'Pomme de terre', familleId: 'Solanacées', rendement: 3, vivace: false, besoinN: 3, besoinEau: 3, couleur: '#a3a3a3' },
    // Cucurbitacées
    { id: 'Courgette', familleId: 'Cucurbitacées', rendement: 4, vivace: false, besoinN: 4, besoinEau: 4, couleur: '#84cc16' },
    { id: 'Courge', familleId: 'Cucurbitacées', rendement: 3, vivace: false, besoinN: 3, besoinEau: 3, couleur: '#f97316' },
    { id: 'Concombre', familleId: 'Cucurbitacées', rendement: 3, vivace: false, besoinN: 3, besoinEau: 4, couleur: '#22c55e' },
    { id: 'Melon', familleId: 'Cucurbitacées', rendement: 2, vivace: false, besoinN: 3, besoinEau: 4, couleur: '#fbbf24' },
    // Brassicacées
    { id: 'Chou', familleId: 'Brassicacées', rendement: 4, vivace: false, besoinN: 4, besoinEau: 3, couleur: '#22c55e' },
    { id: 'Brocoli', familleId: 'Brassicacées', rendement: 2, vivace: false, besoinN: 4, besoinEau: 3, couleur: '#16a34a' },
    { id: 'Radis', familleId: 'Brassicacées', rendement: 2, vivace: false, besoinN: 2, besoinEau: 3, couleur: '#ef4444' },
    { id: 'Navet', familleId: 'Brassicacées', rendement: 3, vivace: false, besoinN: 2, besoinEau: 3, couleur: '#f5f5f4' },
    // Apiacées
    { id: 'Carotte', familleId: 'Apiacées', rendement: 4, vivace: false, besoinN: 2, besoinEau: 3, couleur: '#f97316' },
    { id: 'Céleri', familleId: 'Apiacées', rendement: 3, vivace: false, besoinN: 4, besoinEau: 4, couleur: '#a3e635' },
    { id: 'Persil', familleId: 'Apiacées', rendement: 1, vivace: false, besoinN: 2, besoinEau: 3, couleur: '#22c55e' },
    // Alliacées
    { id: 'Oignon', familleId: 'Alliacées', rendement: 3, vivace: false, besoinN: 2, besoinEau: 2, couleur: '#fbbf24' },
    { id: 'Ail', familleId: 'Alliacées', rendement: 1, vivace: false, besoinN: 1, besoinEau: 1, couleur: '#f5f5f4' },
    { id: 'Poireau', familleId: 'Alliacées', rendement: 3, vivace: false, besoinN: 3, besoinEau: 3, couleur: '#22c55e' },
    { id: 'Échalote', familleId: 'Alliacées', rendement: 2, vivace: false, besoinN: 2, besoinEau: 2, couleur: '#c084fc' },
    // Fabacées
    { id: 'Haricot', familleId: 'Fabacées', rendement: 2, vivace: false, besoinN: 1, besoinEau: 3, couleur: '#84cc16' },
    { id: 'Pois', familleId: 'Fabacées', rendement: 1, vivace: false, besoinN: 1, besoinEau: 3, couleur: '#22c55e' },
    { id: 'Fève', familleId: 'Fabacées', rendement: 2, vivace: false, besoinN: 1, besoinEau: 2, couleur: '#16a34a' },
    // Astéracées
    { id: 'Laitue', familleId: 'Astéracées', rendement: 2, vivace: false, besoinN: 2, besoinEau: 4, couleur: '#a3e635' },
    { id: 'Chicorée', familleId: 'Astéracées', rendement: 2, vivace: false, besoinN: 2, besoinEau: 3, couleur: '#84cc16' },
    // Chénopodiacées
    { id: 'Betterave', familleId: 'Chénopodiacées', rendement: 3, vivace: false, besoinN: 2, besoinEau: 3, couleur: '#be123c' },
    { id: 'Épinard', familleId: 'Chénopodiacées', rendement: 2, vivace: false, besoinN: 3, besoinEau: 4, couleur: '#166534' },
    { id: 'Blette', familleId: 'Chénopodiacées', rendement: 3, vivace: false, besoinN: 3, besoinEau: 3, couleur: '#22c55e' },
    // Lamiacées (aromatiques)
    { id: 'Basilic', familleId: 'Lamiacées', rendement: 1, vivace: false, besoinN: 2, besoinEau: 3, couleur: '#22c55e' },
    { id: 'Menthe', familleId: 'Lamiacées', rendement: 1, vivace: true, besoinN: 2, besoinEau: 4, couleur: '#10b981' },
    { id: 'Thym', familleId: 'Lamiacées', rendement: 0.5, vivace: true, besoinN: 1, besoinEau: 1, couleur: '#a3a3a3' },
    { id: 'Romarin', familleId: 'Lamiacées', rendement: 0.5, vivace: true, besoinN: 1, besoinEau: 1, couleur: '#6366f1' },
    // Valérianacées
    { id: 'Mâche', familleId: 'Valérianacées', rendement: 1, vivace: false, besoinN: 1, besoinEau: 3, couleur: '#22c55e' },
    // Engrais verts
    { id: 'Moutarde', familleId: 'Engrais vert', rendement: 0, vivace: false, besoinN: 0, besoinEau: 2, couleur: '#fde047' },
    { id: 'Phacélie', familleId: 'Engrais vert', rendement: 0, vivace: false, besoinN: 0, besoinEau: 2, couleur: '#a78bfa' },
  ]

  for (const espece of especes) {
    await prisma.espece.upsert({
      where: { id: espece.id },
      update: espece,
      create: {
        ...espece,
        aPlanifier: true,
      },
    })
  }
  console.log(`✓ ${especes.length} espèces créées`)

  // ============================================================
  // PARAMÈTRES PAR DÉFAUT
  // ============================================================
  const params = [
    { id: 'annee_courante', valeur: new Date().getFullYear().toString() },
    { id: 'largeur_planche_defaut', valeur: '0.8' },
    { id: 'longueur_planche_defaut', valeur: '10' },
    { id: 'theme', valeur: 'light' },
  ]

  for (const param of params) {
    await prisma.parametre.upsert({
      where: { id: param.id },
      update: param,
      create: param,
    })
  }
  console.log(`✓ ${params.length} paramètres créés`)

  console.log('\n✅ Seed terminé avec succès!')
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
