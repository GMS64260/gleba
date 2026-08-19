/**
 * Génération de données d'exemple pour les nouveaux utilisateurs
 * Crée : 2 planches, 2 cultures récoltées (annee précédente),
 *        2 cultures en cours avec recoltes (annee en cours), 2 arbres,
 *        irrigations planifiées pour les cultures actives
 *
 * Refonte onboarding 2026-08-17 : ce décor n'est plus créé d'office au signup —
 * il est proposé comme CHOIX à la fin du parcours de configuration, ancré sur
 * la parcelle réelle de l'utilisateur (fini Paris 4ᵉ pour tout le monde) et
 * borné aux modules qu'il a activés (un éleveur pur ne reçoit pas 4 cultures).
 */

import prisma from "@/lib/prisma"
import { genererIrrigationsPlanifiees } from "@/lib/irrigation-scheduler"
import { PARCELLE_EXEMPLE } from "@/lib/localisation-exemple"
import { productifParDefaut } from "@/lib/tree-care-calendar"

export interface SampleDataOptions {
  /**
   * Parcelle d'ancrage : les planches d'exemple s'y rattachent au lieu de
   * créer la parcelle-décor de Paris. C'est la parcelle géolocalisée à la
   * commune de l'utilisateur, créée par l'étape « exploitation » du parcours.
   */
  parcelleGeoId?: string | null
  /** Planches, cultures, récoltes et irrigations d'exemple (défaut : oui). */
  avecMaraichage?: boolean
  /** Arbres d'exemple (défaut : oui). */
  avecVerger?: boolean
}

export async function createSampleDataForUser(
  userId: string,
  options: SampleDataOptions = {},
): Promise<void> {
  const avecMaraichage = options.avecMaraichage !== false
  const avecVerger = options.avecVerger !== false
  const currentYear = new Date().getFullYear()
  const lastYear = currentYear - 1
  // 15 novembre de l'année précédente : les deux arbres d'exemple ont donc
  // moins d'un an, et un pommier n'entre en production que vers 3 ans.
  const datePlantationArbres = new Date(lastYear, 10, 15)

  if (avecVerger) {
    await creerArbresExemple(userId, datePlantationArbres)
  }
  if (!avecMaraichage) return

  // Parcelle d'ancrage des planches : celle de l'utilisateur quand le parcours
  // de configuration l'a créée à SA commune. À défaut (chemin admin,
  // rétro-compat), le décor historique de Paris 4ᵉ — `localisation-exemple.ts`
  // détient ces coordonnées et détecte les comptes qui bâtissent du réel
  // dessus sans les recaler, la météo, la pluie et Hub'Eau en dépendant.
  const parcellePotager = options.parcelleGeoId
    ? { id: options.parcelleGeoId }
    : await prisma.parcelleGeo.create({
        data: {
          userId,
          ...PARCELLE_EXEMPLE,
        },
      })

  // Créer 2 planches
  const planche1 = await prisma.planche.create({
    data: {
      nom: "Planche A",
      userId,
      largeur: 1.2,
      longueur: 10,
      surface: 12,
      posX: 2,
      posY: 2,
      rotation2D: 0,
      ilot: "Maraîchage",
      notes: "Planche principale pour les légumes d'été",
      parcelleGeoId: parcellePotager.id,
    },
  })

  const planche2 = await prisma.planche.create({
    data: {
      nom: "Planche B",
      userId,
      largeur: 1.2,
      longueur: 8,
      surface: 9.6,
      posX: 5,
      posY: 2,
      rotation2D: 0,
      ilot: "Maraîchage",
      notes: "Planche pour les légumes racines",
      parcelleGeoId: parcellePotager.id,
    },
  })

  // Créer 2 cultures récoltées (terminées)
  // Culture 1 : Tomates de l'annee dernière
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

  // Ajouter une recolte pour la culture 1
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

  // Culture 2 : Carottes de l'annee dernière
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

  // Ajouter une recolte pour la culture 2
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

  // Créer 2 cultures en cours (annee actuelle)
  // Culture 3 : Tomates en cours
  const culture3 = await prisma.culture.create({
    data: {
      userId,
      especeId: "Tomate",
      plancheId: planche1.id,
      annee: currentYear,
      dateSemis: new Date(currentYear, 2, 15), // 15 mars
      datePlantation: new Date(currentYear, 4, 15), // 15 mai
      // Échéance à venir : sans date de récolte, le tout premier briefing
      // reprochait au compte neuf des « cultures sans échéance » qu'il n'avait
      // pas saisies (constat compte réel du 2026-08-17).
      dateRecolte: new Date(Date.now() + 30 * 86400000),
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
      dateRecolte: new Date(Date.now() + 21 * 86400000), // idem tomate en cours
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

  // Ajouter des recoltes pour l'annee en cours (pour que le dashboard ait des données)
  await prisma.recolte.create({
    data: {
      userId,
      especeId: "Tomate",
      cultureId: culture3.id,
      date: new Date(Date.now() - 21 * 86400000), // ~3 semaines avant (audit #50 : plus de date future)
      quantite: 5.5,
      notes: "Premières tomates de la saison",
    },
  })

  await prisma.recolte.create({
    data: {
      userId,
      especeId: "Tomate",
      cultureId: culture3.id,
      date: new Date(Date.now() - 10 * 86400000), // ~10 jours avant (audit #50)
      quantite: 12.3,
      notes: "Belle récolte",
    },
  })

  await prisma.recolte.create({
    data: {
      userId,
      especeId: "Courgette",
      cultureId: culture4.id,
      date: new Date(Date.now() - 14 * 86400000), // ~2 semaines avant (audit #50)
      quantite: 8.7,
      notes: "Courgettes bien développées",
    },
  })

  // Générer les irrigations planifiées pour les cultures actives
  await genererIrrigationsPlanifiees(userId)
}

async function creerArbresExemple(userId: string, datePlantationArbres: Date): Promise<void> {
  // Créer 2 arbres fruitiers
  await prisma.arbre.create({
    data: {
      userId,
      nom: "Pommier Golden",
      type: "fruitier",
      especeId: "Pommier",
      espece: "Pommier",
      variete: "Golden Delicious",
      datePlantation: datePlantationArbres,
      // Le défaut Prisma de la colonne est `true` : les deux arbres d'exemple
      // naissaient « productifs » alors qu'ils sont plantés depuis moins d'un
      // an, et tout compte neuf affichait « 2 fruitiers productifs » (KPI
      // Verger). Constaté le 2026-08-12 sur les comptes du jour.
      productif: productifParDefaut("Pommier", datePlantationArbres),
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
      datePlantation: datePlantationArbres,
      productif: productifParDefaut("Cerisier", datePlantationArbres),
      posX: 20,
      posY: 8,
      envergure: 4,
      hauteur: 3,
      notes: "Variété précoce, fruits sucrés",
    },
  })
}
