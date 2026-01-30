/**
 * Données de test complètes pour Gleba
 * Couvre 2023 et 2024 avec un jardin réaliste
 */

// ============================================================
// RÉFÉRENTIELS (partagés entre tous les utilisateurs)
// ============================================================

export const familles = [
  { id: "Solanacées", intervalle: 4, couleur: "#e74c3c", description: "Tomates, poivrons, aubergines, pommes de terre" },
  { id: "Cucurbitacées", intervalle: 3, couleur: "#f39c12", description: "Courgettes, courges, concombres, melons" },
  { id: "Brassicacées", intervalle: 4, couleur: "#27ae60", description: "Choux, brocolis, radis, navets" },
  { id: "Fabacées", intervalle: 2, couleur: "#9b59b6", description: "Haricots, pois, fèves - fixent l'azote" },
  { id: "Apiacées", intervalle: 3, couleur: "#3498db", description: "Carottes, persil, céleri, fenouil" },
  { id: "Alliacées", intervalle: 3, couleur: "#1abc9c", description: "Oignons, ail, poireaux, échalotes" },
  { id: "Astéracées", intervalle: 2, couleur: "#e67e22", description: "Laitues, chicorées, artichauts" },
  { id: "Chénopodiacées", intervalle: 3, couleur: "#c0392b", description: "Épinards, betteraves, blettes" },
  { id: "Rosacées", intervalle: 5, couleur: "#d35400", description: "Fraises, framboises, pommiers, poiriers" },
]

export const fournisseurs = [
  { id: "Kokopelli", contact: "Association", email: "info@kokopelli-semences.fr", siteWeb: "https://kokopelli-semences.fr", notes: "Semences reproductibles" },
  { id: "Germinance", contact: "SARL", email: "contact@germinance.com", siteWeb: "https://germinance.com", notes: "Semences bio" },
  { id: "La Ferme de Sainte Marthe", contact: "SAS", siteWeb: "https://fermedesaintemarthe.com", notes: "Large catalogue" },
  { id: "Semailles", contact: "Coopérative", siteWeb: "https://semaille.com", notes: "Belgique, variétés anciennes" },
  { id: "Biaugerme", contact: "GAEC", siteWeb: "https://biaugerme.com", notes: "Producteur français bio" },
]

export const destinations = [
  { id: "Consommation", description: "Consommation personnelle" },
  { id: "Vente", description: "Vente directe ou marché" },
  { id: "Don", description: "Don à des proches ou associations" },
  { id: "Conservation", description: "Mise en conserve, congélation, séchage" },
  { id: "Pertes", description: "Pertes (maladies, ravageurs, météo)" },
]

export const fertilisants = [
  { id: "Compost maison", type: "Organique", n: 1.5, p: 0.8, k: 1.2, description: "Compost de déchets verts et cuisine" },
  { id: "Fumier de cheval", type: "Organique", n: 0.6, p: 0.3, k: 0.5, description: "Bien composté" },
  { id: "Corne broyée", type: "Organique", n: 13, p: 0, k: 0, description: "Azote à libération lente" },
  { id: "Sang séché", type: "Organique", n: 12, p: 1, k: 0, description: "Azote rapide" },
  { id: "Cendres de bois", type: "Minéral", n: 0, p: 2, k: 8, ca: 25, description: "Riche en potasse" },
  { id: "Purin d'ortie", type: "Organique", n: 2, p: 0.5, k: 3, description: "Stimulant et engrais foliaire" },
  { id: "BRF", type: "Organique", n: 0.5, p: 0.2, k: 0.3, description: "Bois Raméal Fragmenté" },
]

// ============================================================
// ESPÈCES ET VARIÉTÉS
// ============================================================

export const especes = [
  // Légumes fruits
  { id: "Tomate", type: "legume", familleId: "Solanacées", rendement: 4.5, besoinN: 4, besoinEau: 4, couleur: "#e74c3c" },
  { id: "Courgette", type: "legume", familleId: "Cucurbitacées", rendement: 5, besoinN: 4, besoinEau: 4, couleur: "#2ecc71" },
  { id: "Concombre", type: "legume", familleId: "Cucurbitacées", rendement: 3, besoinN: 3, besoinEau: 5, couleur: "#27ae60" },
  { id: "Poivron", type: "legume", familleId: "Solanacées", rendement: 2.5, besoinN: 3, besoinEau: 3, couleur: "#e67e22" },
  { id: "Aubergine", type: "legume", familleId: "Solanacées", rendement: 3, besoinN: 4, besoinEau: 4, couleur: "#8e44ad" },
  { id: "Courge butternut", type: "legume", familleId: "Cucurbitacées", rendement: 3, besoinN: 3, besoinEau: 3, couleur: "#d35400" },
  { id: "Potimarron", type: "legume", familleId: "Cucurbitacées", rendement: 2.5, besoinN: 3, besoinEau: 3, couleur: "#e74c3c" },

  // Légumes feuilles
  { id: "Laitue", type: "legume", familleId: "Astéracées", rendement: 2, besoinN: 2, besoinEau: 4, couleur: "#27ae60" },
  { id: "Épinard", type: "legume", familleId: "Chénopodiacées", rendement: 1.5, besoinN: 3, besoinEau: 3, couleur: "#1e8449" },
  { id: "Blette", type: "legume", familleId: "Chénopodiacées", rendement: 3, besoinN: 3, besoinEau: 3, couleur: "#f1c40f" },
  { id: "Chou kale", type: "legume", familleId: "Brassicacées", rendement: 2, besoinN: 3, besoinEau: 3, couleur: "#1e8449" },

  // Légumes racines
  { id: "Carotte", type: "legume", familleId: "Apiacées", rendement: 4, besoinN: 2, besoinEau: 3, couleur: "#e67e22" },
  { id: "Betterave", type: "legume", familleId: "Chénopodiacées", rendement: 3.5, besoinN: 2, besoinEau: 3, couleur: "#c0392b" },
  { id: "Radis", type: "legume", familleId: "Brassicacées", rendement: 1.5, besoinN: 1, besoinEau: 3, couleur: "#e74c3c" },
  { id: "Navet", type: "legume", familleId: "Brassicacées", rendement: 2.5, besoinN: 2, besoinEau: 3, couleur: "#ecf0f1" },
  { id: "Pomme de terre", type: "legume", familleId: "Solanacées", rendement: 3, besoinN: 3, besoinEau: 3, couleur: "#d4ac0d" },

  // Légumineuses
  { id: "Haricot vert", type: "legume", familleId: "Fabacées", rendement: 1.5, besoinN: 1, besoinEau: 3, couleur: "#27ae60" },
  { id: "Haricot sec", type: "legume", familleId: "Fabacées", rendement: 0.3, besoinN: 1, besoinEau: 2, couleur: "#795548" },
  { id: "Petit pois", type: "legume", familleId: "Fabacées", rendement: 0.8, besoinN: 1, besoinEau: 3, couleur: "#2ecc71" },
  { id: "Fève", type: "legume", familleId: "Fabacées", rendement: 1, besoinN: 1, besoinEau: 3, couleur: "#27ae60" },

  // Alliacées
  { id: "Oignon", type: "legume", familleId: "Alliacées", rendement: 3, besoinN: 2, besoinEau: 2, couleur: "#d4ac0d" },
  { id: "Ail", type: "legume", familleId: "Alliacées", rendement: 1, besoinN: 2, besoinEau: 2, couleur: "#ecf0f1" },
  { id: "Poireau", type: "legume", familleId: "Alliacées", rendement: 3, besoinN: 3, besoinEau: 3, couleur: "#1e8449" },
  { id: "Échalote", type: "legume", familleId: "Alliacées", rendement: 1.5, besoinN: 2, besoinEau: 2, couleur: "#c0392b" },

  // Choux
  { id: "Chou-fleur", type: "legume", familleId: "Brassicacées", rendement: 2, besoinN: 4, besoinEau: 4, couleur: "#ecf0f1" },
  { id: "Brocoli", type: "legume", familleId: "Brassicacées", rendement: 1.5, besoinN: 4, besoinEau: 4, couleur: "#27ae60" },
  { id: "Chou pommé", type: "legume", familleId: "Brassicacées", rendement: 4, besoinN: 4, besoinEau: 3, couleur: "#1e8449" },

  // Aromatiques
  { id: "Basilic", type: "aromatique", familleId: "Solanacées", rendement: 0.5, besoinN: 2, besoinEau: 3, couleur: "#27ae60" },
  { id: "Persil", type: "aromatique", familleId: "Apiacées", rendement: 0.8, besoinN: 2, besoinEau: 3, couleur: "#1e8449" },
  { id: "Coriandre", type: "aromatique", familleId: "Apiacées", rendement: 0.3, besoinN: 2, besoinEau: 3, couleur: "#27ae60" },

  // Fruits
  { id: "Fraise", type: "petit_fruit", familleId: "Rosacées", rendement: 0.8, vivace: true, besoinN: 2, besoinEau: 4, couleur: "#e74c3c" },
  { id: "Framboise", type: "petit_fruit", familleId: "Rosacées", rendement: 0.5, vivace: true, besoinN: 2, besoinEau: 3, couleur: "#c0392b" },
  { id: "Pommier", type: "arbre_fruitier", familleId: "Rosacées", rendement: 30, vivace: true, besoinN: 3, besoinEau: 3, couleur: "#c0392b" },
  { id: "Poirier", type: "arbre_fruitier", familleId: "Rosacées", rendement: 25, vivace: true, besoinN: 3, besoinEau: 3, couleur: "#f1c40f" },
  { id: "Prunier", type: "arbre_fruitier", familleId: "Rosacées", rendement: 20, vivace: true, besoinN: 2, besoinEau: 2, couleur: "#8e44ad" },

  // Engrais verts
  { id: "Phacélie", type: "engrais_vert", rendement: 0, besoinN: 1, besoinEau: 2, couleur: "#9b59b6" },
  { id: "Moutarde", type: "engrais_vert", familleId: "Brassicacées", rendement: 0, besoinN: 1, besoinEau: 2, couleur: "#f1c40f" },
  { id: "Trèfle incarnat", type: "engrais_vert", familleId: "Fabacées", rendement: 0, besoinN: 0, besoinEau: 2, couleur: "#c0392b" },
]

export const varietes = [
  // Tomates
  { id: "Tomate-Coeur de Boeuf", especeId: "Tomate", fournisseurId: "Kokopelli", nbGrainesG: 300, bio: true, description: "Grosse tomate charnue" },
  { id: "Tomate-Marmande", especeId: "Tomate", fournisseurId: "Germinance", nbGrainesG: 350, bio: true, description: "Classique, précoce" },
  { id: "Tomate-Roma", especeId: "Tomate", fournisseurId: "La Ferme de Sainte Marthe", nbGrainesG: 320, bio: true, description: "Pour sauce et conserve" },
  { id: "Tomate-Cerise rouge", especeId: "Tomate", fournisseurId: "Kokopelli", nbGrainesG: 400, bio: true, description: "Productive, sucrée" },
  { id: "Tomate-Noire de Crimée", especeId: "Tomate", fournisseurId: "Biaugerme", nbGrainesG: 280, bio: true, description: "Goût exceptionnel" },

  // Courgettes
  { id: "Courgette-Verte de Milan", especeId: "Courgette", fournisseurId: "Germinance", nbGrainesG: 7, bio: true },
  { id: "Courgette-Ronde de Nice", especeId: "Courgette", fournisseurId: "Kokopelli", nbGrainesG: 6, bio: true, description: "Parfaite pour farcir" },

  // Carottes
  { id: "Carotte-Nantaise", especeId: "Carotte", fournisseurId: "Germinance", nbGrainesG: 800, bio: true },
  { id: "Carotte-Touchon", especeId: "Carotte", fournisseurId: "Biaugerme", nbGrainesG: 750, bio: true, description: "Demi-longue, sucrée" },

  // Haricots
  { id: "Haricot-Contender", especeId: "Haricot vert", fournisseurId: "Germinance", nbGrainesG: 3, bio: true, description: "Nain, très productif" },
  { id: "Haricot-Coco de Prague", especeId: "Haricot sec", fournisseurId: "Kokopelli", nbGrainesG: 2, bio: true },

  // Salades
  { id: "Laitue-Batavia", especeId: "Laitue", fournisseurId: "Germinance", nbGrainesG: 800, bio: true },
  { id: "Laitue-Feuille de chêne", especeId: "Laitue", fournisseurId: "Semailles", nbGrainesG: 850, bio: true },

  // Autres
  { id: "Poivron-Corno di Toro", especeId: "Poivron", fournisseurId: "Kokopelli", nbGrainesG: 150, bio: true, description: "Long, très doux" },
  { id: "Aubergine-Violette longue", especeId: "Aubergine", fournisseurId: "Germinance", nbGrainesG: 200, bio: true },
  { id: "Courge butternut-Waltham", especeId: "Courge butternut", fournisseurId: "Biaugerme", nbGrainesG: 5, bio: true },
  { id: "Potimarron-Red Kuri", especeId: "Potimarron", fournisseurId: "Kokopelli", nbGrainesG: 4, bio: true },
  { id: "Oignon-Jaune Paille des Vertus", especeId: "Oignon", fournisseurId: "Germinance", nbGrainesG: 250, bio: true },
  { id: "Poireau-Bleu de Solaise", especeId: "Poireau", fournisseurId: "Biaugerme", nbGrainesG: 400, bio: true, description: "Résistant au froid" },
  { id: "Épinard-Géant d'hiver", especeId: "Épinard", fournisseurId: "Germinance", nbGrainesG: 100, bio: true },
  { id: "Betterave-Detroit", especeId: "Betterave", fournisseurId: "Kokopelli", nbGrainesG: 60, bio: true },
  { id: "Petit pois-Merveille de Kelvedon", especeId: "Petit pois", fournisseurId: "Germinance", nbGrainesG: 4, bio: true },
  { id: "Fraise-Mara des Bois", especeId: "Fraise", fournisseurId: "La Ferme de Sainte Marthe", bio: true, description: "Remontante, très parfumée" },
]

// ============================================================
// ITPS (Itinéraires Techniques)
// ============================================================

export const itps = [
  // Tomates
  { id: "ITP-Tomate-printemps", especeId: "Tomate", semaineSemis: 8, semainePlantation: 18, semaineRecolte: 28, dureePepiniere: 70, dureeCulture: 150, nbRangs: 2, espacement: 50 },
  { id: "ITP-Tomate-tardive", especeId: "Tomate", semaineSemis: 12, semainePlantation: 22, semaineRecolte: 32, dureePepiniere: 70, dureeCulture: 140, nbRangs: 2, espacement: 50 },

  // Courgettes
  { id: "ITP-Courgette", especeId: "Courgette", semaineSemis: 16, semainePlantation: 20, semaineRecolte: 26, dureePepiniere: 28, dureeCulture: 90, nbRangs: 1, espacement: 100 },

  // Carottes
  { id: "ITP-Carotte-printemps", especeId: "Carotte", semaineSemis: 12, semaineRecolte: 26, dureeCulture: 100, nbRangs: 5, espacement: 5 },
  { id: "ITP-Carotte-automne", especeId: "Carotte", semaineSemis: 24, semaineRecolte: 40, dureeCulture: 110, nbRangs: 5, espacement: 5 },

  // Haricots
  { id: "ITP-Haricot-vert", especeId: "Haricot vert", semaineSemis: 18, semaineRecolte: 28, dureeCulture: 70, nbRangs: 4, espacement: 8 },
  { id: "ITP-Haricot-sec", especeId: "Haricot sec", semaineSemis: 20, semaineRecolte: 38, dureeCulture: 120, nbRangs: 3, espacement: 10 },

  // Salades
  { id: "ITP-Laitue-printemps", especeId: "Laitue", semaineSemis: 8, semainePlantation: 14, semaineRecolte: 20, dureePepiniere: 42, dureeCulture: 50, nbRangs: 5, espacement: 25 },
  { id: "ITP-Laitue-ete", especeId: "Laitue", semaineSemis: 20, semainePlantation: 24, semaineRecolte: 30, dureePepiniere: 28, dureeCulture: 45, nbRangs: 5, espacement: 25 },
  { id: "ITP-Laitue-automne", especeId: "Laitue", semaineSemis: 30, semainePlantation: 34, semaineRecolte: 42, dureePepiniere: 28, dureeCulture: 55, nbRangs: 5, espacement: 25 },

  // Poivrons / Aubergines
  { id: "ITP-Poivron", especeId: "Poivron", semaineSemis: 6, semainePlantation: 20, semaineRecolte: 30, dureePepiniere: 98, dureeCulture: 150, nbRangs: 2, espacement: 45 },
  { id: "ITP-Aubergine", especeId: "Aubergine", semaineSemis: 6, semainePlantation: 20, semaineRecolte: 28, dureePepiniere: 98, dureeCulture: 140, nbRangs: 2, espacement: 50 },

  // Courges
  { id: "ITP-Butternut", especeId: "Courge butternut", semaineSemis: 16, semainePlantation: 21, semaineRecolte: 38, dureePepiniere: 35, dureeCulture: 120, nbRangs: 1, espacement: 150 },
  { id: "ITP-Potimarron", especeId: "Potimarron", semaineSemis: 16, semainePlantation: 21, semaineRecolte: 38, dureePepiniere: 35, dureeCulture: 120, nbRangs: 1, espacement: 150 },

  // Alliacées
  { id: "ITP-Oignon", especeId: "Oignon", semaineSemis: 8, semainePlantation: 16, semaineRecolte: 32, dureePepiniere: 56, dureeCulture: 150, nbRangs: 5, espacement: 10 },
  { id: "ITP-Poireau", especeId: "Poireau", semaineSemis: 8, semainePlantation: 22, semaineRecolte: 40, dureePepiniere: 98, dureeCulture: 180, nbRangs: 4, espacement: 12 },
  { id: "ITP-Ail", especeId: "Ail", semainePlantation: 42, semaineRecolte: 28, dureeCulture: 240, nbRangs: 5, espacement: 12 },

  // Choux
  { id: "ITP-Chou-kale", especeId: "Chou kale", semaineSemis: 16, semainePlantation: 22, semaineRecolte: 36, dureePepiniere: 42, dureeCulture: 120, nbRangs: 3, espacement: 40 },
  { id: "ITP-Brocoli", especeId: "Brocoli", semaineSemis: 14, semainePlantation: 20, semaineRecolte: 32, dureePepiniere: 42, dureeCulture: 100, nbRangs: 3, espacement: 45 },

  // Autres
  { id: "ITP-Epinard", especeId: "Épinard", semaineSemis: 12, semaineRecolte: 20, dureeCulture: 55, nbRangs: 5, espacement: 10 },
  { id: "ITP-Betterave", especeId: "Betterave", semaineSemis: 14, semaineRecolte: 28, dureeCulture: 100, nbRangs: 4, espacement: 12 },
  { id: "ITP-Petit-pois", especeId: "Petit pois", semaineSemis: 10, semaineRecolte: 22, dureeCulture: 85, nbRangs: 3, espacement: 5 },
  { id: "ITP-Radis", especeId: "Radis", semaineSemis: 12, semaineRecolte: 16, dureeCulture: 30, nbRangs: 6, espacement: 3 },

  // Engrais verts
  { id: "ITP-Phacelie", especeId: "Phacélie", semaineSemis: 32, dureeCulture: 60, nbRangs: 1, espacement: 2 },
  { id: "ITP-Moutarde", especeId: "Moutarde", semaineSemis: 34, dureeCulture: 45, nbRangs: 1, espacement: 2 },
]

// ============================================================
// ROTATIONS
// ============================================================

export const rotations = [
  { id: "Rotation-4ans-A", active: true, nbAnnees: 4, notes: "Rotation standard: Solanacées → Légumineuses → Brassicacées → Racines" },
  { id: "Rotation-4ans-B", active: true, nbAnnees: 4, notes: "Rotation standard décalée d'un an" },
  { id: "Rotation-3ans-Courges", active: true, nbAnnees: 3, notes: "Courges → Légumineuses → Engrais vert" },
]

export const rotationsDetails = [
  // Rotation A
  { rotationId: "Rotation-4ans-A", itpId: "ITP-Tomate-printemps", annee: 1 },
  { rotationId: "Rotation-4ans-A", itpId: "ITP-Haricot-vert", annee: 2 },
  { rotationId: "Rotation-4ans-A", itpId: "ITP-Chou-kale", annee: 3 },
  { rotationId: "Rotation-4ans-A", itpId: "ITP-Carotte-printemps", annee: 4 },

  // Rotation B
  { rotationId: "Rotation-4ans-B", itpId: "ITP-Carotte-printemps", annee: 1 },
  { rotationId: "Rotation-4ans-B", itpId: "ITP-Tomate-printemps", annee: 2 },
  { rotationId: "Rotation-4ans-B", itpId: "ITP-Haricot-vert", annee: 3 },
  { rotationId: "Rotation-4ans-B", itpId: "ITP-Brocoli", annee: 4 },

  // Rotation Courges
  { rotationId: "Rotation-3ans-Courges", itpId: "ITP-Butternut", annee: 1 },
  { rotationId: "Rotation-3ans-Courges", itpId: "ITP-Haricot-sec", annee: 2 },
  { rotationId: "Rotation-3ans-Courges", itpId: "ITP-Phacelie", annee: 3 },
]

// ============================================================
// DONNÉES UTILISATEUR (PLANCHES, CULTURES, RÉCOLTES)
// ============================================================

export const planches = [
  // Îlot A - Légumes d'été
  { id: "A1", rotationId: "Rotation-4ans-A", largeur: 1.2, longueur: 10, posX: 0, posY: 0, ilot: "A", notes: "Planche principale tomates" },
  { id: "A2", rotationId: "Rotation-4ans-A", largeur: 1.2, longueur: 10, posX: 1.5, posY: 0, ilot: "A", planchesInfluencees: "A1,A3" },
  { id: "A3", rotationId: "Rotation-4ans-B", largeur: 1.2, longueur: 10, posX: 3, posY: 0, ilot: "A", planchesInfluencees: "A2,A4" },
  { id: "A4", rotationId: "Rotation-4ans-B", largeur: 1.2, longueur: 10, posX: 4.5, posY: 0, ilot: "A", planchesInfluencees: "A3" },

  // Îlot B - Légumes racines et feuilles
  { id: "B1", rotationId: "Rotation-4ans-A", largeur: 1.2, longueur: 8, posX: 0, posY: 12, ilot: "B" },
  { id: "B2", rotationId: "Rotation-4ans-B", largeur: 1.2, longueur: 8, posX: 1.5, posY: 12, ilot: "B" },
  { id: "B3", largeur: 1.2, longueur: 8, posX: 3, posY: 12, ilot: "B", notes: "Salades succession" },

  // Îlot C - Courges
  { id: "C1", rotationId: "Rotation-3ans-Courges", largeur: 2, longueur: 6, posX: 8, posY: 0, ilot: "C", notes: "Courges coureuses" },
  { id: "C2", rotationId: "Rotation-3ans-Courges", largeur: 2, longueur: 6, posX: 8, posY: 7, ilot: "C" },

  // Îlot D - Vivaces et aromatiques
  { id: "D1", largeur: 1.5, longueur: 4, posX: 12, posY: 0, ilot: "D", notes: "Fraisiers" },
  { id: "D2", largeur: 1.5, longueur: 4, posX: 12, posY: 5, ilot: "D", notes: "Aromatiques" },
]

// Helper pour générer les cultures des années 2023 et 2024
export function generateCultures(userId: string) {
  const cultures = []

  // 2023
  cultures.push(
    // Tomates 2023
    { especeId: "Tomate", varieteId: "Tomate-Coeur de Boeuf", itpId: "ITP-Tomate-printemps", plancheId: "A1", annee: 2023, dateSemis: new Date("2023-02-20"), datePlantation: new Date("2023-05-05"), dateRecolte: new Date("2023-07-15"), semisFait: true, plantationFaite: true, recolteFaite: true, terminee: "x", nbRangs: 2, longueur: 5, userId },
    { especeId: "Tomate", varieteId: "Tomate-Cerise rouge", itpId: "ITP-Tomate-printemps", plancheId: "A1", annee: 2023, dateSemis: new Date("2023-02-20"), datePlantation: new Date("2023-05-05"), dateRecolte: new Date("2023-07-10"), semisFait: true, plantationFaite: true, recolteFaite: true, terminee: "x", nbRangs: 2, longueur: 5, userId },
    { especeId: "Tomate", varieteId: "Tomate-Roma", itpId: "ITP-Tomate-tardive", plancheId: "A2", annee: 2023, dateSemis: new Date("2023-03-20"), datePlantation: new Date("2023-06-01"), dateRecolte: new Date("2023-08-10"), semisFait: true, plantationFaite: true, recolteFaite: true, terminee: "x", nbRangs: 2, longueur: 10, userId },

    // Courgettes 2023
    { especeId: "Courgette", varieteId: "Courgette-Verte de Milan", itpId: "ITP-Courgette", plancheId: "A3", annee: 2023, dateSemis: new Date("2023-04-15"), datePlantation: new Date("2023-05-20"), dateRecolte: new Date("2023-07-01"), semisFait: true, plantationFaite: true, recolteFaite: true, terminee: "x", nbRangs: 1, longueur: 10, userId },

    // Carottes 2023
    { especeId: "Carotte", varieteId: "Carotte-Nantaise", itpId: "ITP-Carotte-printemps", plancheId: "B1", annee: 2023, dateSemis: new Date("2023-03-20"), dateRecolte: new Date("2023-07-01"), semisFait: true, recolteFaite: true, terminee: "x", nbRangs: 5, longueur: 8, userId },
    { especeId: "Carotte", varieteId: "Carotte-Touchon", itpId: "ITP-Carotte-automne", plancheId: "B1", annee: 2023, dateSemis: new Date("2023-06-15"), dateRecolte: new Date("2023-10-10"), semisFait: true, recolteFaite: true, terminee: "x", nbRangs: 5, longueur: 4, userId },

    // Haricots 2023
    { especeId: "Haricot vert", varieteId: "Haricot-Contender", itpId: "ITP-Haricot-vert", plancheId: "A4", annee: 2023, dateSemis: new Date("2023-05-01"), dateRecolte: new Date("2023-07-15"), semisFait: true, recolteFaite: true, terminee: "x", nbRangs: 4, longueur: 10, userId },

    // Salades 2023
    { especeId: "Laitue", varieteId: "Laitue-Batavia", itpId: "ITP-Laitue-printemps", plancheId: "B3", annee: 2023, dateSemis: new Date("2023-02-20"), datePlantation: new Date("2023-04-05"), dateRecolte: new Date("2023-05-20"), semisFait: true, plantationFaite: true, recolteFaite: true, terminee: "x", nbRangs: 5, longueur: 3, userId },
    { especeId: "Laitue", varieteId: "Laitue-Feuille de chêne", itpId: "ITP-Laitue-ete", plancheId: "B3", annee: 2023, dateSemis: new Date("2023-05-15"), datePlantation: new Date("2023-06-15"), dateRecolte: new Date("2023-07-25"), semisFait: true, plantationFaite: true, recolteFaite: true, terminee: "x", nbRangs: 5, longueur: 3, userId },

    // Courges 2023
    { especeId: "Courge butternut", varieteId: "Courge butternut-Waltham", itpId: "ITP-Butternut", plancheId: "C1", annee: 2023, dateSemis: new Date("2023-04-15"), datePlantation: new Date("2023-05-25"), dateRecolte: new Date("2023-09-20"), semisFait: true, plantationFaite: true, recolteFaite: true, terminee: "x", nbRangs: 1, longueur: 6, userId },
    { especeId: "Potimarron", varieteId: "Potimarron-Red Kuri", itpId: "ITP-Potimarron", plancheId: "C2", annee: 2023, dateSemis: new Date("2023-04-15"), datePlantation: new Date("2023-05-25"), dateRecolte: new Date("2023-09-25"), semisFait: true, plantationFaite: true, recolteFaite: true, terminee: "x", nbRangs: 1, longueur: 6, userId },

    // Oignons 2023
    { especeId: "Oignon", varieteId: "Oignon-Jaune Paille des Vertus", itpId: "ITP-Oignon", plancheId: "B2", annee: 2023, dateSemis: new Date("2023-02-20"), datePlantation: new Date("2023-04-15"), dateRecolte: new Date("2023-08-10"), semisFait: true, plantationFaite: true, recolteFaite: true, terminee: "x", nbRangs: 5, longueur: 8, userId },

    // Poireaux 2023
    { especeId: "Poireau", varieteId: "Poireau-Bleu de Solaise", itpId: "ITP-Poireau", plancheId: "B2", annee: 2023, dateSemis: new Date("2023-02-20"), datePlantation: new Date("2023-06-01"), dateRecolte: new Date("2023-10-05"), semisFait: true, plantationFaite: true, recolteFaite: true, terminee: "x", nbRangs: 4, longueur: 4, userId },

    // Fraises 2023 (vivaces)
    { especeId: "Fraise", varieteId: "Fraise-Mara des Bois", plancheId: "D1", annee: 2023, datePlantation: new Date("2022-09-15"), dateRecolte: new Date("2023-05-20"), plantationFaite: true, recolteFaite: true, terminee: "v", nbRangs: 3, longueur: 4, userId },
  )

  // 2024
  cultures.push(
    // Tomates 2024
    { especeId: "Tomate", varieteId: "Tomate-Coeur de Boeuf", itpId: "ITP-Tomate-printemps", plancheId: "A2", annee: 2024, dateSemis: new Date("2024-02-18"), datePlantation: new Date("2024-05-01"), dateRecolte: new Date("2024-07-12"), semisFait: true, plantationFaite: true, recolteFaite: true, terminee: "x", nbRangs: 2, longueur: 5, userId },
    { especeId: "Tomate", varieteId: "Tomate-Noire de Crimée", itpId: "ITP-Tomate-printemps", plancheId: "A2", annee: 2024, dateSemis: new Date("2024-02-18"), datePlantation: new Date("2024-05-01"), dateRecolte: new Date("2024-07-20"), semisFait: true, plantationFaite: true, recolteFaite: true, terminee: "x", nbRangs: 2, longueur: 5, userId },
    { especeId: "Tomate", varieteId: "Tomate-Cerise rouge", itpId: "ITP-Tomate-tardive", plancheId: "A3", annee: 2024, dateSemis: new Date("2024-03-15"), datePlantation: new Date("2024-06-01"), dateRecolte: new Date("2024-08-01"), semisFait: true, plantationFaite: true, recolteFaite: true, terminee: "x", nbRangs: 2, longueur: 5, userId },

    // Courgettes 2024
    { especeId: "Courgette", varieteId: "Courgette-Ronde de Nice", itpId: "ITP-Courgette", plancheId: "A4", annee: 2024, dateSemis: new Date("2024-04-18"), datePlantation: new Date("2024-05-20"), dateRecolte: new Date("2024-07-05"), semisFait: true, plantationFaite: true, recolteFaite: true, terminee: "x", nbRangs: 1, longueur: 10, userId },

    // Poivrons 2024
    { especeId: "Poivron", varieteId: "Poivron-Corno di Toro", itpId: "ITP-Poivron", plancheId: "A1", annee: 2024, dateSemis: new Date("2024-02-05"), datePlantation: new Date("2024-05-15"), dateRecolte: new Date("2024-07-25"), semisFait: true, plantationFaite: true, recolteFaite: true, terminee: "x", nbRangs: 2, longueur: 5, userId },

    // Aubergines 2024
    { especeId: "Aubergine", varieteId: "Aubergine-Violette longue", itpId: "ITP-Aubergine", plancheId: "A1", annee: 2024, dateSemis: new Date("2024-02-05"), datePlantation: new Date("2024-05-15"), dateRecolte: new Date("2024-07-10"), semisFait: true, plantationFaite: true, recolteFaite: true, terminee: "x", nbRangs: 2, longueur: 5, userId },

    // Carottes 2024
    { especeId: "Carotte", varieteId: "Carotte-Nantaise", itpId: "ITP-Carotte-printemps", plancheId: "B2", annee: 2024, dateSemis: new Date("2024-03-18"), dateRecolte: new Date("2024-06-28"), semisFait: true, recolteFaite: true, terminee: "x", nbRangs: 5, longueur: 4, userId },
    { especeId: "Carotte", varieteId: "Carotte-Touchon", itpId: "ITP-Carotte-automne", plancheId: "B2", annee: 2024, dateSemis: new Date("2024-06-10"), dateRecolte: new Date("2024-10-05"), semisFait: true, recolteFaite: true, terminee: "x", nbRangs: 5, longueur: 4, userId },

    // Haricots 2024
    { especeId: "Haricot vert", varieteId: "Haricot-Contender", itpId: "ITP-Haricot-vert", plancheId: "A3", annee: 2024, dateSemis: new Date("2024-05-05"), dateRecolte: new Date("2024-07-18"), semisFait: true, recolteFaite: true, terminee: "x", nbRangs: 4, longueur: 5, userId },
    { especeId: "Haricot sec", varieteId: "Haricot-Coco de Prague", itpId: "ITP-Haricot-sec", plancheId: "C2", annee: 2024, dateSemis: new Date("2024-05-18"), dateRecolte: new Date("2024-09-20"), semisFait: true, recolteFaite: true, terminee: "x", nbRangs: 3, longueur: 6, userId },

    // Salades 2024
    { especeId: "Laitue", varieteId: "Laitue-Batavia", itpId: "ITP-Laitue-printemps", plancheId: "B3", annee: 2024, dateSemis: new Date("2024-02-22"), datePlantation: new Date("2024-04-08"), dateRecolte: new Date("2024-05-22"), semisFait: true, plantationFaite: true, recolteFaite: true, terminee: "x", nbRangs: 5, longueur: 2.5, userId },
    { especeId: "Laitue", varieteId: "Laitue-Feuille de chêne", itpId: "ITP-Laitue-ete", plancheId: "B3", annee: 2024, dateSemis: new Date("2024-05-18"), datePlantation: new Date("2024-06-18"), dateRecolte: new Date("2024-07-28"), semisFait: true, plantationFaite: true, recolteFaite: true, terminee: "x", nbRangs: 5, longueur: 2.5, userId },
    { especeId: "Laitue", varieteId: "Laitue-Batavia", itpId: "ITP-Laitue-automne", plancheId: "B3", annee: 2024, dateSemis: new Date("2024-07-28"), datePlantation: new Date("2024-08-25"), dateRecolte: new Date("2024-10-18"), semisFait: true, plantationFaite: true, recolteFaite: true, terminee: "x", nbRangs: 5, longueur: 3, userId },

    // Courges 2024
    { especeId: "Courge butternut", varieteId: "Courge butternut-Waltham", itpId: "ITP-Butternut", plancheId: "C1", annee: 2024, dateSemis: new Date("2024-04-18"), datePlantation: new Date("2024-05-28"), dateRecolte: new Date("2024-09-22"), semisFait: true, plantationFaite: true, recolteFaite: true, terminee: "x", nbRangs: 1, longueur: 6, userId },

    // Choux 2024
    { especeId: "Chou kale", itpId: "ITP-Chou-kale", plancheId: "B1", annee: 2024, dateSemis: new Date("2024-04-15"), datePlantation: new Date("2024-06-01"), dateRecolte: new Date("2024-09-08"), semisFait: true, plantationFaite: true, recolteFaite: true, terminee: "x", nbRangs: 3, longueur: 4, userId },
    { especeId: "Brocoli", itpId: "ITP-Brocoli", plancheId: "B1", annee: 2024, dateSemis: new Date("2024-04-01"), datePlantation: new Date("2024-05-18"), dateRecolte: new Date("2024-08-10"), semisFait: true, plantationFaite: true, recolteFaite: true, terminee: "x", nbRangs: 3, longueur: 4, userId },

    // Betteraves 2024
    { especeId: "Betterave", varieteId: "Betterave-Detroit", itpId: "ITP-Betterave", plancheId: "B1", annee: 2024, dateSemis: new Date("2024-04-05"), dateRecolte: new Date("2024-07-15"), semisFait: true, recolteFaite: true, terminee: "x", nbRangs: 4, longueur: 4, userId },

    // Petits pois 2024
    { especeId: "Petit pois", varieteId: "Petit pois-Merveille de Kelvedon", itpId: "ITP-Petit-pois", plancheId: "A4", annee: 2024, dateSemis: new Date("2024-03-08"), dateRecolte: new Date("2024-06-02"), semisFait: true, recolteFaite: true, terminee: "x", nbRangs: 3, longueur: 5, userId },

    // Fraises 2024 (vivaces)
    { especeId: "Fraise", varieteId: "Fraise-Mara des Bois", plancheId: "D1", annee: 2024, dateRecolte: new Date("2024-05-18"), recolteFaite: true, terminee: "v", nbRangs: 3, longueur: 4, userId },

    // Engrais vert 2024
    { especeId: "Phacélie", itpId: "ITP-Phacelie", plancheId: "C2", annee: 2024, dateSemis: new Date("2024-08-10"), semisFait: true, terminee: "x", nbRangs: 1, longueur: 6, notes: "Engrais vert après haricots", userId },
  )

  return cultures
}

// Helper pour générer les récoltes
export function generateRecoltes(cultures: any[]) {
  const recoltes: any[] = []

  // Index pour suivre l'ID des cultures (sera remplacé par les vrais IDs après création)
  let cultureIndex = 0

  const recolteData: { [key: string]: { dates: string[], quantites: number[] }[] } = {
    // 2023
    "2023-Tomate-Coeur de Boeuf-A1": [
      { dates: ["2023-07-15", "2023-07-25", "2023-08-05", "2023-08-15", "2023-08-25", "2023-09-05"], quantites: [2.5, 4.2, 5.8, 6.1, 4.5, 2.8] }
    ],
    "2023-Tomate-Cerise rouge-A1": [
      { dates: ["2023-07-10", "2023-07-20", "2023-07-30", "2023-08-10", "2023-08-20", "2023-08-30", "2023-09-10"], quantites: [1.2, 2.1, 2.8, 3.2, 2.9, 2.1, 1.5] }
    ],
    "2023-Tomate-Roma-A2": [
      { dates: ["2023-08-10", "2023-08-20", "2023-08-30", "2023-09-10", "2023-09-20"], quantites: [8.5, 12.3, 15.2, 10.8, 6.2] }
    ],
    "2023-Courgette-Verte de Milan-A3": [
      { dates: ["2023-07-01", "2023-07-08", "2023-07-15", "2023-07-22", "2023-07-29", "2023-08-05", "2023-08-12", "2023-08-19"], quantites: [3.2, 4.5, 5.8, 6.2, 5.5, 4.8, 3.5, 2.2] }
    ],
    "2023-Carotte-Nantaise-B1": [
      { dates: ["2023-07-01", "2023-07-15"], quantites: [12.5, 18.3] }
    ],
    "2023-Carotte-Touchon-B1": [
      { dates: ["2023-10-10", "2023-10-25"], quantites: [8.2, 6.5] }
    ],
    "2023-Haricot vert-Contender-A4": [
      { dates: ["2023-07-15", "2023-07-22", "2023-07-29", "2023-08-05", "2023-08-12"], quantites: [2.8, 3.5, 4.2, 3.8, 2.1] }
    ],
    "2023-Laitue-Batavia-B3": [
      { dates: ["2023-05-20", "2023-05-27", "2023-06-03"], quantites: [1.8, 2.2, 1.5] }
    ],
    "2023-Laitue-Feuille de chêne-B3": [
      { dates: ["2023-07-25", "2023-08-01", "2023-08-08"], quantites: [1.5, 2.0, 1.2] }
    ],
    "2023-Courge butternut-Waltham-C1": [
      { dates: ["2023-09-20"], quantites: [28.5] }
    ],
    "2023-Potimarron-Red Kuri-C2": [
      { dates: ["2023-09-25"], quantites: [22.8] }
    ],
    "2023-Oignon-Jaune Paille des Vertus-B2": [
      { dates: ["2023-08-10"], quantites: [18.5] }
    ],
    "2023-Poireau-Bleu de Solaise-B2": [
      { dates: ["2023-10-05", "2023-10-20", "2023-11-05"], quantites: [4.2, 3.8, 3.5] }
    ],
    "2023-Fraise-Mara des Bois-D1": [
      { dates: ["2023-05-20", "2023-05-28", "2023-06-05", "2023-06-15", "2023-06-25", "2023-07-05", "2023-08-15", "2023-09-01"], quantites: [0.8, 1.2, 1.5, 1.8, 1.2, 0.8, 0.6, 0.4] }
    ],

    // 2024
    "2024-Tomate-Coeur de Boeuf-A2": [
      { dates: ["2024-07-12", "2024-07-22", "2024-08-02", "2024-08-12", "2024-08-22", "2024-09-02"], quantites: [3.2, 5.1, 6.5, 7.2, 5.2, 3.1] }
    ],
    "2024-Tomate-Noire de Crimée-A2": [
      { dates: ["2024-07-20", "2024-07-30", "2024-08-10", "2024-08-20", "2024-08-30"], quantites: [2.8, 4.5, 5.2, 4.1, 2.5] }
    ],
    "2024-Tomate-Cerise rouge-A3": [
      { dates: ["2024-08-01", "2024-08-10", "2024-08-20", "2024-08-30", "2024-09-10"], quantites: [1.8, 2.5, 3.1, 2.2, 1.5] }
    ],
    "2024-Courgette-Ronde de Nice-A4": [
      { dates: ["2024-07-05", "2024-07-12", "2024-07-19", "2024-07-26", "2024-08-02", "2024-08-09", "2024-08-16"], quantites: [2.8, 4.2, 5.5, 6.8, 5.2, 4.1, 2.5] }
    ],
    "2024-Poivron-Corno di Toro-A1": [
      { dates: ["2024-07-25", "2024-08-05", "2024-08-15", "2024-08-25", "2024-09-05"], quantites: [1.5, 2.8, 3.5, 2.8, 1.8] }
    ],
    "2024-Aubergine-Violette longue-A1": [
      { dates: ["2024-07-10", "2024-07-22", "2024-08-03", "2024-08-15", "2024-08-27"], quantites: [2.2, 3.5, 4.2, 3.8, 2.5] }
    ],
    "2024-Carotte-Nantaise-B2": [
      { dates: ["2024-06-28", "2024-07-10"], quantites: [8.5, 6.2] }
    ],
    "2024-Carotte-Touchon-B2": [
      { dates: ["2024-10-05", "2024-10-20"], quantites: [7.8, 5.5] }
    ],
    "2024-Haricot vert-Contender-A3": [
      { dates: ["2024-07-18", "2024-07-25", "2024-08-01", "2024-08-08"], quantites: [1.8, 2.5, 2.2, 1.5] }
    ],
    "2024-Haricot sec-Coco de Prague-C2": [
      { dates: ["2024-09-20"], quantites: [2.8] }
    ],
    "2024-Laitue-Batavia-B3-p": [
      { dates: ["2024-05-22", "2024-05-29"], quantites: [1.5, 1.8] }
    ],
    "2024-Laitue-Feuille de chêne-B3": [
      { dates: ["2024-07-28", "2024-08-04"], quantites: [1.8, 1.5] }
    ],
    "2024-Laitue-Batavia-B3-a": [
      { dates: ["2024-10-18", "2024-10-28"], quantites: [2.2, 1.8] }
    ],
    "2024-Courge butternut-Waltham-C1": [
      { dates: ["2024-09-22"], quantites: [32.5] }
    ],
    "2024-Chou kale-B1": [
      { dates: ["2024-09-08", "2024-09-22", "2024-10-06", "2024-10-20"], quantites: [1.2, 1.5, 1.8, 1.2] }
    ],
    "2024-Brocoli-B1": [
      { dates: ["2024-08-10", "2024-08-24"], quantites: [2.5, 1.8] }
    ],
    "2024-Betterave-Detroit-B1": [
      { dates: ["2024-07-15"], quantites: [12.5] }
    ],
    "2024-Petit pois-Merveille de Kelvedon-A4": [
      { dates: ["2024-06-02", "2024-06-09", "2024-06-16"], quantites: [1.5, 2.2, 1.2] }
    ],
    "2024-Fraise-Mara des Bois-D1": [
      { dates: ["2024-05-18", "2024-05-26", "2024-06-03", "2024-06-13", "2024-06-23", "2024-08-12", "2024-08-28"], quantites: [1.0, 1.5, 1.8, 2.0, 1.5, 0.8, 0.5] }
    ],
  }

  return recolteData
}

// Arbres fruitiers
export const arbres = [
  { nom: "Pommier Golden", type: "fruitier", espece: "Pommier", variete: "Golden Delicious", portGreffe: "M9", datePlantation: new Date("2020-11-15"), posX: 16, posY: 2, envergure: 3, hauteur: 2.5, etat: "bon" },
  { nom: "Pommier Reine des Reinettes", type: "fruitier", espece: "Pommier", variete: "Reine des Reinettes", portGreffe: "M9", datePlantation: new Date("2020-11-15"), posX: 16, posY: 6, envergure: 3, hauteur: 2.8, etat: "excellent", pollinisateur: "Golden Delicious" },
  { nom: "Poirier Conference", type: "fruitier", espece: "Poirier", variete: "Conference", portGreffe: "Cognassier BA29", datePlantation: new Date("2021-02-20"), posX: 20, posY: 2, envergure: 2.5, hauteur: 3, etat: "bon" },
  { nom: "Poirier Williams", type: "fruitier", espece: "Poirier", variete: "Williams", portGreffe: "Cognassier BA29", datePlantation: new Date("2021-02-20"), posX: 20, posY: 6, envergure: 2.5, hauteur: 2.8, etat: "bon", pollinisateur: "Conference" },
  { nom: "Prunier Reine Claude", type: "fruitier", espece: "Prunier", variete: "Reine Claude dorée", datePlantation: new Date("2019-11-10"), posX: 24, posY: 4, envergure: 4, hauteur: 3.5, etat: "excellent" },
  { nom: "Framboisiers", type: "petit_fruit", espece: "Framboisier", variete: "Malling Promise", datePlantation: new Date("2022-03-10"), posX: 12, posY: 10, envergure: 2, hauteur: 1.5, etat: "bon", notes: "Rang de 4m" },
]

// Objets du jardin
export const objetsJardin = [
  { nom: "Allée principale", type: "allee", largeur: 1, longueur: 20, posX: -0.5, posY: 0, couleur: "#d4a574" },
  { nom: "Allée secondaire", type: "allee", largeur: 0.6, longueur: 12, posX: 6, posY: -0.3, rotation2D: 90, couleur: "#d4a574" },
  { nom: "Composteur", type: "compost", largeur: 1.5, longueur: 1.5, posX: -2, posY: 15, couleur: "#5d4037" },
  { nom: "Serre", type: "serre", largeur: 3, longueur: 6, posX: 14, posY: 12, couleur: "#90caf9", notes: "Serre tunnel pour semis" },
  { nom: "Abri outils", type: "autre", largeur: 2, longueur: 3, posX: -2, posY: 0, couleur: "#8d6e63" },
]
