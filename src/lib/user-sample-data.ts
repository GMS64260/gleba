/**
 * Génération de données d'exemple pour les nouveaux utilisateurs
 * Crée : 2 planches, 2 cultures récoltées (année précédente),
 *        2 cultures en cours avec récoltes (année en cours), 2 arbres
 */

import prisma from "@/lib/prisma"

export async function createSampleDataForUser(userId: string): Promise<void> {
  const currentYear = new Date().getFullYear()
  const lastYear = currentYear - 1

  // Créer 2 planches
  const planche1 = await prisma.planche.create({
    data: {
      id: "Planche A",
      userId,
      largeur: 1.2,
      longueur: 10,
      surface: 12,
      posX: 2,
      posY: 2,
      rotation2D: 0,
      ilot: "Potager",
      notes: "Planche principale pour les légumes d'été",
    },
  })

  const planche2 = await prisma.planche.create({
    data: {
      id: "Planche B",
      userId,
      largeur: 1.2,
      longueur: 8,
      surface: 9.6,
      posX: 5,
      posY: 2,
      rotation2D: 0,
      ilot: "Potager",
      notes: "Planche pour les légumes racines",
    },
  })

  // Créer 2 cultures récoltées (terminées)
  // Culture 1 : Tomates de l'année dernière
  const culture1 = await prisma.culture.create({
    data: {
      userId,
      especeId: "Tomate",
      plancheId: planche1.id,
      annee: lastYear,
      dateSemis: new Date(lastYear, 2, 15), // 15 mars
      datePlantation: new Date(lastYear, 4, 10), // 10 mai
      dateRecolte: new Date(lastYear, 7, 15), // 15 août
      semisFait: true,
      plantationFaite: true,
      recolteFaite: true,
      terminee: "x",
      quantite: 6,
      nbRangs: 2,
      longueur: 5,
      notes: "Bonne récolte, environ 25 kg",
    },
  })

  // Ajouter une récolte pour la culture 1
  await prisma.recolte.create({
    data: {
      userId,
      especeId: "Tomate",
      cultureId: culture1.id,
      date: new Date(lastYear, 7, 15),
      quantite: 25,
      notes: "Première grosse récolte",
    },
  })

  // Culture 2 : Carottes de l'année dernière
  const culture2 = await prisma.culture.create({
    data: {
      userId,
      especeId: "Carotte",
      plancheId: planche2.id,
      annee: lastYear,
      dateSemis: new Date(lastYear, 3, 1), // 1 avril
      dateRecolte: new Date(lastYear, 8, 1), // 1 septembre
      semisFait: true,
      plantationFaite: false, // Semis direct
      recolteFaite: true,
      terminee: "x",
      quantite: 4.8,
      nbRangs: 4,
      longueur: 8,
      notes: "Carottes de bonne taille",
    },
  })

  // Ajouter une récolte pour la culture 2
  await prisma.recolte.create({
    data: {
      userId,
      especeId: "Carotte",
      cultureId: culture2.id,
      date: new Date(lastYear, 8, 1),
      quantite: 12,
      notes: "Environ 12 kg de carottes",
    },
  })

  // Créer 2 cultures en cours (année actuelle)
  // Culture 3 : Tomates en cours
  const culture3 = await prisma.culture.create({
    data: {
      userId,
      especeId: "Tomate",
      plancheId: planche1.id,
      annee: currentYear,
      dateSemis: new Date(currentYear, 2, 15), // 15 mars
      datePlantation: new Date(currentYear, 4, 15), // 15 mai
      semisFait: true,
      plantationFaite: true,
      recolteFaite: false,
      terminee: null,
      quantite: 8,
      nbRangs: 2,
      longueur: 6,
      notes: "Variété cœur de bœuf",
    },
  })

  // Culture 4 : Courgettes en cours
  const culture4 = await prisma.culture.create({
    data: {
      userId,
      especeId: "Courgette",
      plancheId: planche1.id,
      annee: currentYear,
      dateSemis: new Date(currentYear, 3, 15), // 15 avril
      datePlantation: new Date(currentYear, 4, 20), // 20 mai
      semisFait: true,
      plantationFaite: true,
      recolteFaite: false,
      terminee: null,
      quantite: 3,
      nbRangs: 1,
      longueur: 3,
      notes: "3 plants de courgettes vertes",
    },
  })

  // Ajouter des récoltes pour l'année en cours (pour que le dashboard ait des données)
  await prisma.recolte.create({
    data: {
      userId,
      especeId: "Tomate",
      cultureId: culture3.id,
      date: new Date(currentYear, 6, 15), // 15 juillet
      quantite: 5.5,
      notes: "Premières tomates de la saison",
    },
  })

  await prisma.recolte.create({
    data: {
      userId,
      especeId: "Tomate",
      cultureId: culture3.id,
      date: new Date(currentYear, 7, 1), // 1 août
      quantite: 12.3,
      notes: "Belle récolte",
    },
  })

  await prisma.recolte.create({
    data: {
      userId,
      especeId: "Courgette",
      cultureId: culture4.id,
      date: new Date(currentYear, 6, 20), // 20 juillet
      quantite: 8.7,
      notes: "Courgettes bien développées",
    },
  })

  // Créer 2 arbres fruitiers
  await prisma.arbre.create({
    data: {
      userId,
      nom: "Pommier Golden",
      type: "fruitier",
      especeId: "Pommier",
      espece: "Pommier",
      variete: "Golden Delicious",
      datePlantation: new Date(lastYear, 10, 15), // 15 novembre année dernière
      posX: 15,
      posY: 8,
      envergure: 3,
      hauteur: 2.5,
      notes: "Planté à l'automne, bonne reprise",
    },
  })

  await prisma.arbre.create({
    data: {
      userId,
      nom: "Cerisier Burlat",
      type: "fruitier",
      especeId: "Cerisier",
      espece: "Cerisier",
      variete: "Burlat",
      datePlantation: new Date(lastYear, 10, 15), // 15 novembre année dernière
      posX: 20,
      posY: 8,
      envergure: 4,
      hauteur: 3,
      notes: "Variété précoce, fruits sucrés",
    },
  })
}
