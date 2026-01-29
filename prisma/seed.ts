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
    // Familles pour arbres fruitiers et petits fruits
    { id: 'Rosacées', intervalle: 10, couleur: '#ec4899', description: 'Pommier, poirier, cerisier, prunier, fraisier, framboisier...' },
    { id: 'Grossulariacées', intervalle: 8, couleur: '#8b5cf6', description: 'Groseillier, cassissier...' },
    { id: 'Ericacées', intervalle: 8, couleur: '#3b82f6', description: 'Myrtillier...' },
    { id: 'Moracées', intervalle: 10, couleur: '#6366f1', description: 'Mûrier, figuier...' },
    { id: 'Juglandacées', intervalle: 15, couleur: '#78716c', description: 'Noyer...' },
    { id: 'Corylacées', intervalle: 10, couleur: '#a16207', description: 'Noisetier...' },
    { id: 'Actinidiacées', intervalle: 10, couleur: '#65a30d', description: 'Kiwi...' },
    { id: 'Oléacées', intervalle: 15, couleur: '#84cc16', description: 'Olivier...' },
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
  // ESPÈCES - LÉGUMES
  // ============================================================
  const legumes = [
    // Solanacées
    { id: 'Tomate', type: 'legume', familleId: 'Solanacées', nomLatin: 'Solanum lycopersicum', rendement: 5, vivace: false, besoinN: 4, besoinP: 3, besoinK: 4, besoinEau: 4, couleur: '#dc2626' },
    { id: 'Poivron', type: 'legume', familleId: 'Solanacées', nomLatin: 'Capsicum annuum', rendement: 3, vivace: false, besoinN: 3, besoinP: 3, besoinK: 4, besoinEau: 4, couleur: '#ef4444' },
    { id: 'Aubergine', type: 'legume', familleId: 'Solanacées', nomLatin: 'Solanum melongena', rendement: 3, vivace: false, besoinN: 3, besoinP: 3, besoinK: 3, besoinEau: 4, couleur: '#7c3aed' },
    { id: 'Pomme de terre', type: 'legume', familleId: 'Solanacées', nomLatin: 'Solanum tuberosum', rendement: 3, vivace: false, besoinN: 3, besoinP: 3, besoinK: 5, besoinEau: 3, couleur: '#a3a3a3' },
    // Cucurbitacées
    { id: 'Courgette', type: 'legume', familleId: 'Cucurbitacées', nomLatin: 'Cucurbita pepo', rendement: 4, vivace: false, besoinN: 4, besoinP: 3, besoinK: 4, besoinEau: 4, couleur: '#84cc16' },
    { id: 'Courge', type: 'legume', familleId: 'Cucurbitacées', nomLatin: 'Cucurbita maxima', rendement: 3, vivace: false, besoinN: 3, besoinP: 2, besoinK: 4, besoinEau: 3, couleur: '#f97316' },
    { id: 'Concombre', type: 'legume', familleId: 'Cucurbitacées', nomLatin: 'Cucumis sativus', rendement: 3, vivace: false, besoinN: 3, besoinP: 2, besoinK: 4, besoinEau: 4, couleur: '#22c55e' },
    { id: 'Melon', type: 'legume', familleId: 'Cucurbitacées', nomLatin: 'Cucumis melo', rendement: 2, vivace: false, besoinN: 3, besoinP: 3, besoinK: 5, besoinEau: 4, couleur: '#fbbf24' },
    // Brassicacées
    { id: 'Chou', type: 'legume', familleId: 'Brassicacées', nomLatin: 'Brassica oleracea', rendement: 4, vivace: false, besoinN: 4, besoinP: 2, besoinK: 4, besoinEau: 3, couleur: '#22c55e' },
    { id: 'Brocoli', type: 'legume', familleId: 'Brassicacées', nomLatin: 'Brassica oleracea var. italica', rendement: 2, vivace: false, besoinN: 4, besoinP: 2, besoinK: 3, besoinEau: 3, couleur: '#16a34a' },
    { id: 'Radis', type: 'legume', familleId: 'Brassicacées', nomLatin: 'Raphanus sativus', rendement: 2, vivace: false, besoinN: 2, besoinP: 1, besoinK: 2, besoinEau: 3, couleur: '#ef4444' },
    { id: 'Navet', type: 'legume', familleId: 'Brassicacées', nomLatin: 'Brassica rapa', rendement: 3, vivace: false, besoinN: 2, besoinP: 2, besoinK: 3, besoinEau: 3, couleur: '#f5f5f4' },
    // Apiacées
    { id: 'Carotte', type: 'legume', familleId: 'Apiacées', nomLatin: 'Daucus carota', rendement: 4, vivace: false, besoinN: 2, besoinP: 2, besoinK: 4, besoinEau: 3, couleur: '#f97316' },
    { id: 'Céleri', type: 'legume', familleId: 'Apiacées', nomLatin: 'Apium graveolens', rendement: 3, vivace: false, besoinN: 4, besoinP: 2, besoinK: 5, besoinEau: 4, couleur: '#a3e635' },
    { id: 'Persil', type: 'aromatique', familleId: 'Apiacées', nomLatin: 'Petroselinum crispum', rendement: 1, vivace: false, besoinN: 2, besoinP: 1, besoinK: 2, besoinEau: 3, couleur: '#22c55e' },
    // Alliacées
    { id: 'Oignon', type: 'legume', familleId: 'Alliacées', nomLatin: 'Allium cepa', rendement: 3, vivace: false, besoinN: 2, besoinP: 2, besoinK: 3, besoinEau: 2, couleur: '#fbbf24' },
    { id: 'Ail', type: 'legume', familleId: 'Alliacées', nomLatin: 'Allium sativum', rendement: 1, vivace: false, besoinN: 1, besoinP: 2, besoinK: 3, besoinEau: 1, couleur: '#f5f5f4' },
    { id: 'Poireau', type: 'legume', familleId: 'Alliacées', nomLatin: 'Allium porrum', rendement: 3, vivace: false, besoinN: 3, besoinP: 2, besoinK: 4, besoinEau: 3, couleur: '#22c55e' },
    { id: 'Échalote', type: 'legume', familleId: 'Alliacées', nomLatin: 'Allium ascalonicum', rendement: 2, vivace: false, besoinN: 2, besoinP: 2, besoinK: 3, besoinEau: 2, couleur: '#c084fc' },
    // Fabacées
    { id: 'Haricot', type: 'legume', familleId: 'Fabacées', nomLatin: 'Phaseolus vulgaris', rendement: 2, vivace: false, besoinN: 1, besoinP: 3, besoinK: 3, besoinEau: 3, couleur: '#84cc16' },
    { id: 'Pois', type: 'legume', familleId: 'Fabacées', nomLatin: 'Pisum sativum', rendement: 1, vivace: false, besoinN: 1, besoinP: 3, besoinK: 3, besoinEau: 3, couleur: '#22c55e' },
    { id: 'Fève', type: 'legume', familleId: 'Fabacées', nomLatin: 'Vicia faba', rendement: 2, vivace: false, besoinN: 1, besoinP: 3, besoinK: 3, besoinEau: 2, couleur: '#16a34a' },
    // Astéracées
    { id: 'Laitue', type: 'legume', familleId: 'Astéracées', nomLatin: 'Lactuca sativa', rendement: 2, vivace: false, besoinN: 2, besoinP: 1, besoinK: 3, besoinEau: 4, couleur: '#a3e635' },
    { id: 'Chicorée', type: 'legume', familleId: 'Astéracées', nomLatin: 'Cichorium intybus', rendement: 2, vivace: false, besoinN: 2, besoinP: 1, besoinK: 3, besoinEau: 3, couleur: '#84cc16' },
    // Chénopodiacées
    { id: 'Betterave', type: 'legume', familleId: 'Chénopodiacées', nomLatin: 'Beta vulgaris', rendement: 3, vivace: false, besoinN: 2, besoinP: 2, besoinK: 4, besoinEau: 3, couleur: '#be123c' },
    { id: 'Épinard', type: 'legume', familleId: 'Chénopodiacées', nomLatin: 'Spinacia oleracea', rendement: 2, vivace: false, besoinN: 3, besoinP: 2, besoinK: 4, besoinEau: 4, couleur: '#166534' },
    { id: 'Blette', type: 'legume', familleId: 'Chénopodiacées', nomLatin: 'Beta vulgaris var. cicla', rendement: 3, vivace: false, besoinN: 3, besoinP: 2, besoinK: 4, besoinEau: 3, couleur: '#22c55e' },
    // Valérianacées
    { id: 'Mâche', type: 'legume', familleId: 'Valérianacées', nomLatin: 'Valerianella locusta', rendement: 1, vivace: false, besoinN: 1, besoinP: 1, besoinK: 2, besoinEau: 3, couleur: '#22c55e' },
  ]

  // ============================================================
  // ESPÈCES - AROMATIQUES
  // ============================================================
  const aromatiques = [
    { id: 'Basilic', type: 'aromatique', familleId: 'Lamiacées', nomLatin: 'Ocimum basilicum', rendement: 1, vivace: false, besoinN: 2, besoinP: 1, besoinK: 2, besoinEau: 3, couleur: '#22c55e' },
    { id: 'Menthe', type: 'aromatique', familleId: 'Lamiacées', nomLatin: 'Mentha spp.', rendement: 1, vivace: true, besoinN: 2, besoinP: 1, besoinK: 2, besoinEau: 4, couleur: '#10b981' },
    { id: 'Thym', type: 'aromatique', familleId: 'Lamiacées', nomLatin: 'Thymus vulgaris', rendement: 0.5, vivace: true, besoinN: 1, besoinP: 1, besoinK: 1, besoinEau: 1, couleur: '#a3a3a3' },
    { id: 'Romarin', type: 'aromatique', familleId: 'Lamiacées', nomLatin: 'Salvia rosmarinus', rendement: 0.5, vivace: true, besoinN: 1, besoinP: 1, besoinK: 1, besoinEau: 1, couleur: '#6366f1' },
    { id: 'Sauge', type: 'aromatique', familleId: 'Lamiacées', nomLatin: 'Salvia officinalis', rendement: 0.5, vivace: true, besoinN: 1, besoinP: 1, besoinK: 1, besoinEau: 2, couleur: '#a855f7' },
    { id: 'Ciboulette', type: 'aromatique', familleId: 'Alliacées', nomLatin: 'Allium schoenoprasum', rendement: 0.5, vivace: true, besoinN: 2, besoinP: 1, besoinK: 2, besoinEau: 3, couleur: '#c084fc' },
    { id: 'Coriandre', type: 'aromatique', familleId: 'Apiacées', nomLatin: 'Coriandrum sativum', rendement: 0.5, vivace: false, besoinN: 2, besoinP: 1, besoinK: 2, besoinEau: 3, couleur: '#34d399' },
    { id: 'Aneth', type: 'aromatique', familleId: 'Apiacées', nomLatin: 'Anethum graveolens', rendement: 0.5, vivace: false, besoinN: 2, besoinP: 1, besoinK: 2, besoinEau: 3, couleur: '#a3e635' },
  ]

  // ============================================================
  // ESPÈCES - ENGRAIS VERTS
  // ============================================================
  const engraisVerts = [
    { id: 'Moutarde', type: 'engrais_vert', familleId: 'Brassicacées', nomLatin: 'Sinapis alba', rendement: 0, vivace: false, besoinN: 0, besoinP: 0, besoinK: 0, besoinEau: 2, couleur: '#fde047', aPlanifier: false },
    { id: 'Phacélie', type: 'engrais_vert', familleId: 'Engrais vert', nomLatin: 'Phacelia tanacetifolia', rendement: 0, vivace: false, besoinN: 0, besoinP: 0, besoinK: 0, besoinEau: 2, couleur: '#a78bfa', aPlanifier: false },
    { id: 'Trèfle', type: 'engrais_vert', familleId: 'Fabacées', nomLatin: 'Trifolium spp.', rendement: 0, vivace: true, besoinN: 0, besoinP: 0, besoinK: 0, besoinEau: 2, couleur: '#22c55e', aPlanifier: false },
    { id: 'Seigle', type: 'engrais_vert', familleId: 'Poacées', nomLatin: 'Secale cereale', rendement: 0, vivace: false, besoinN: 0, besoinP: 0, besoinK: 0, besoinEau: 2, couleur: '#d4a574', aPlanifier: false },
  ]

  // ============================================================
  // ESPÈCES - ARBRES FRUITIERS
  // ============================================================
  const arbresFruitiers = [
    // Rosacées - Pépins
    { id: 'Pommier', type: 'arbre_fruitier', familleId: 'Rosacées', nomLatin: 'Malus domestica', rendement: 30, vivace: true, besoinN: 3, besoinP: 2, besoinK: 4, besoinEau: 3, couleur: '#22c55e', description: 'Arbre fruitier à pépins, nombreuses variétés' },
    { id: 'Poirier', type: 'arbre_fruitier', familleId: 'Rosacées', nomLatin: 'Pyrus communis', rendement: 25, vivace: true, besoinN: 3, besoinP: 2, besoinK: 4, besoinEau: 3, couleur: '#84cc16', description: 'Arbre fruitier à pépins' },
    { id: 'Cognassier', type: 'arbre_fruitier', familleId: 'Rosacées', nomLatin: 'Cydonia oblonga', rendement: 15, vivace: true, besoinN: 2, besoinP: 2, besoinK: 3, besoinEau: 2, couleur: '#fbbf24', description: 'Arbre fruitier rustique' },
    // Rosacées - Noyaux
    { id: 'Cerisier', type: 'arbre_fruitier', familleId: 'Rosacées', nomLatin: 'Prunus avium', rendement: 20, vivace: true, besoinN: 3, besoinP: 2, besoinK: 4, besoinEau: 3, couleur: '#dc2626', description: 'Arbre fruitier à noyau' },
    { id: 'Prunier', type: 'arbre_fruitier', familleId: 'Rosacées', nomLatin: 'Prunus domestica', rendement: 25, vivace: true, besoinN: 3, besoinP: 2, besoinK: 4, besoinEau: 3, couleur: '#7c3aed', description: 'Arbre fruitier à noyau' },
    { id: 'Pêcher', type: 'arbre_fruitier', familleId: 'Rosacées', nomLatin: 'Prunus persica', rendement: 20, vivace: true, besoinN: 4, besoinP: 2, besoinK: 5, besoinEau: 4, couleur: '#fb923c', description: 'Arbre fruitier à noyau, sensible au gel' },
    { id: 'Abricotier', type: 'arbre_fruitier', familleId: 'Rosacées', nomLatin: 'Prunus armeniaca', rendement: 20, vivace: true, besoinN: 3, besoinP: 2, besoinK: 4, besoinEau: 2, couleur: '#f97316', description: 'Arbre fruitier à noyau' },
    // Autres familles
    { id: 'Figuier', type: 'arbre_fruitier', familleId: 'Moracées', nomLatin: 'Ficus carica', rendement: 15, vivace: true, besoinN: 2, besoinP: 2, besoinK: 3, besoinEau: 2, couleur: '#a855f7', description: 'Arbre méditerranéen' },
    { id: 'Noyer', type: 'arbre_fruitier', familleId: 'Juglandacées', nomLatin: 'Juglans regia', rendement: 10, vivace: true, besoinN: 2, besoinP: 2, besoinK: 3, besoinEau: 2, couleur: '#78716c', description: 'Arbre à coques' },
    { id: 'Noisetier', type: 'arbre_fruitier', familleId: 'Corylacées', nomLatin: 'Corylus avellana', rendement: 5, vivace: true, besoinN: 2, besoinP: 2, besoinK: 3, besoinEau: 2, couleur: '#a16207', description: 'Arbuste à coques' },
    { id: 'Châtaignier', type: 'arbre_fruitier', familleId: 'Rosacées', nomLatin: 'Castanea sativa', rendement: 15, vivace: true, besoinN: 2, besoinP: 2, besoinK: 3, besoinEau: 3, couleur: '#92400e', description: 'Grand arbre à fruits à coques' },
    { id: 'Kiwi', type: 'arbre_fruitier', familleId: 'Actinidiacées', nomLatin: 'Actinidia deliciosa', rendement: 20, vivace: true, besoinN: 4, besoinP: 2, besoinK: 4, besoinEau: 4, couleur: '#65a30d', description: 'Liane fruitière, nécessite support' },
    { id: 'Olivier', type: 'arbre_fruitier', familleId: 'Oléacées', nomLatin: 'Olea europaea', rendement: 10, vivace: true, besoinN: 2, besoinP: 2, besoinK: 4, besoinEau: 1, couleur: '#84cc16', description: 'Arbre méditerranéen' },
  ]

  // ============================================================
  // ESPÈCES - PETITS FRUITS
  // ============================================================
  const petitsFruits = [
    { id: 'Fraisier', type: 'petit_fruit', familleId: 'Rosacées', nomLatin: 'Fragaria × ananassa', rendement: 1, vivace: true, besoinN: 3, besoinP: 2, besoinK: 4, besoinEau: 4, couleur: '#ef4444', description: 'Plante herbacée vivace' },
    { id: 'Framboisier', type: 'petit_fruit', familleId: 'Rosacées', nomLatin: 'Rubus idaeus', rendement: 2, vivace: true, besoinN: 3, besoinP: 2, besoinK: 4, besoinEau: 3, couleur: '#ec4899', description: 'Arbuste drageonnant' },
    { id: 'Mûrier', type: 'petit_fruit', familleId: 'Rosacées', nomLatin: 'Rubus fruticosus', rendement: 3, vivace: true, besoinN: 2, besoinP: 2, besoinK: 3, besoinEau: 2, couleur: '#1e1b4b', description: 'Ronce fruitière' },
    { id: 'Groseillier', type: 'petit_fruit', familleId: 'Grossulariacées', nomLatin: 'Ribes rubrum', rendement: 3, vivace: true, besoinN: 3, besoinP: 2, besoinK: 4, besoinEau: 3, couleur: '#dc2626', description: 'Arbuste à grappes' },
    { id: 'Cassissier', type: 'petit_fruit', familleId: 'Grossulariacées', nomLatin: 'Ribes nigrum', rendement: 3, vivace: true, besoinN: 3, besoinP: 2, besoinK: 4, besoinEau: 3, couleur: '#1e1b4b', description: 'Arbuste à baies noires' },
    { id: 'Myrtillier', type: 'petit_fruit', familleId: 'Ericacées', nomLatin: 'Vaccinium corymbosum', rendement: 2, vivace: true, besoinN: 2, besoinP: 2, besoinK: 3, besoinEau: 4, couleur: '#3b82f6', description: 'Arbuste acidophile' },
    { id: 'Groseillier à maquereau', type: 'petit_fruit', familleId: 'Grossulariacées', nomLatin: 'Ribes uva-crispa', rendement: 2, vivace: true, besoinN: 2, besoinP: 2, besoinK: 3, besoinEau: 3, couleur: '#84cc16', description: 'Arbuste épineux' },
    { id: 'Vigne', type: 'petit_fruit', familleId: 'Rosacées', nomLatin: 'Vitis vinifera', rendement: 5, vivace: true, besoinN: 2, besoinP: 2, besoinK: 5, besoinEau: 2, couleur: '#7c3aed', description: 'Liane fruitière' },
  ]

  // Combiner toutes les espèces
  const allEspeces = [...legumes, ...aromatiques, ...engraisVerts, ...arbresFruitiers, ...petitsFruits]

  for (const espece of allEspeces) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = espece as any
    const aPlanifier = data.aPlanifier !== undefined ? data.aPlanifier : true
    await prisma.espece.upsert({
      where: { id: espece.id },
      update: { ...espece, aPlanifier },
      create: { ...espece, aPlanifier },
    })
  }
  console.log(`✓ ${allEspeces.length} espèces créées (${legumes.length} légumes, ${aromatiques.length} aromatiques, ${engraisVerts.length} engrais verts, ${arbresFruitiers.length} arbres, ${petitsFruits.length} petits fruits)`)

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
