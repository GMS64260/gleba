/**
 * Seed idempotent : étalement à maturité (m) des espèces officielles.
 *
 * Renseigne `especes.etalement` (diamètre occupé par une plante adulte,
 * dessiné à l'échelle sur le plan 2D) UNIQUEMENT pour les espèces du
 * catalogue Gleba (user_id NULL) dont l'étalement est encore NULL :
 * les valeurs déjà saisies par l'admin ou les membres sont préservées.
 *
 * Valeurs indicatives de conduite potagère courante (plein développement),
 * pas des maxima botaniques.
 *
 * Usage (depuis l'hôte) : npx tsx prisma/seed-etalement.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ETALEMENTS: Record<string, number> = {
  // Légumes racines / bulbes
  'Ail': 0.1,
  'Betterave': 0.15,
  'Carotte': 0.05,
  'Céleri': 0.3,
  'Chou-rave': 0.25,
  'Échalote': 0.1,
  'Fenouil': 0.25,
  'Navet': 0.15,
  'Oignon': 0.1,
  'Panais': 0.15,
  'Poireau': 0.08,
  'Pomme de terre': 0.4,
  'Radis': 0.05,
  'Radis noir': 0.15,
  'Raifort': 0.5,
  'Salsifis': 0.1,
  'Topinambour': 0.5,

  // Légumes feuilles
  'Blette': 0.4,
  'Chicorée frisée': 0.3,
  'Chicorée sauvage': 0.3,
  'Chou': 0.5,
  'Chou brocoli': 0.5,
  'Chou de Bruxelles': 0.5,
  'Chou de Chine': 0.3,
  'Chou frisé': 0.5,
  'Chou kale': 0.5,
  'Chou pommé': 0.5,
  'Chou-fleur': 0.6,
  'Épinard': 0.2,
  'Laitue': 0.3,
  'Mâche': 0.1,
  'Roquette': 0.15,
  'Chénopode': 0.4,
  'Chénopode vivace': 0.5,
  'Amarante': 0.5,
  'Épinard pays (amarante)': 0.5,

  // Légumes fruits
  'Aubergine': 0.6,
  'Concombre': 0.45,
  'Courge': 1.5,
  'Courge butternut': 1.2,
  'Courgette': 0.9,
  'Giraumon': 1.5,
  'Gombo': 0.4,
  'Maïs': 0.25,
  'Margose (concombre amer)': 0.5,
  'Melon': 0.8,
  'Piment antillais': 0.5,
  'Poivron': 0.45,
  'Poivron piment': 0.45,
  'Potimarron': 1.2,
  'Potiron': 1.8,
  'Tomate': 0.6,
  'Chayote': 2.0,

  // Légumineuses
  'Fève': 0.25,
  'Haricot': 0.3,
  'Haricot sec': 0.3,
  'Haricot vert': 0.3,
  'Petit pois': 0.2,
  'Pois': 0.2,
  "Pois d'Angole": 1.0,

  // Vivaces potagères
  'Artichaut': 1.0,
  'Asperge': 0.4,
  'Houblon': 1.0,

  // Tropicales
  'Brède mafane': 0.3,
  'Brède morelle': 0.4,
  'Curcuma (safran-pays)': 0.4,
  'Dachine (taro)': 0.8,
  'Gingembre': 0.4,
  'Hibiscus': 1.0,
  'Igname': 0.5,
  'Igname couche-couche': 0.5,
  'Madère (tania)': 0.8,
  'Manioc': 1.0,
  'Patate douce': 0.6,

  // Aromatiques
  'Absinthe': 0.6,
  'Achillée millefeuille': 0.4,
  'Aneth': 0.25,
  'Basilic': 0.3,
  'Bourrache': 0.4,
  'Camomille': 0.3,
  'Ciboulette': 0.2,
  'Cive': 0.15,
  'Coriandre': 0.2,
  'Lavande': 0.6,
  'Marjolaine': 0.25,
  'Menthe': 0.4,
  'Mélisse': 0.4,
  'Origan': 0.3,
  'Persil': 0.25,
  'Romarin': 0.8,
  'Sarriette': 0.3,
  'Sauge': 0.5,
  'Thym': 0.3,

  // Fleurs compagnes
  'Capucine': 0.4,
  'Cosmos': 0.4,
  'Souci': 0.3,
  'Tagètes': 0.3,

  // Arbres fruitiers — diamètre de couronne adulte en conduite de verger
  // familial (demi-tige / gobelet), pas le maximum en franc de plein vent.
  // Sert de repli au cercle pointillé « taille adulte » du plan 2D quand
  // Arbre.envergureAdulte n'est pas saisi.
  'Abricotier': 4.5,
  'Amandier': 5,
  'Arbre à pain': 10,
  'Avocatier': 6,
  'Bananier': 3,
  'Bananier plantain': 3.5,
  'Carambole': 5,
  'Cerisier': 6,
  'Châtaignier': 12,
  'Citronnier': 3.5,
  'Cocotier': 6,
  'Cognassier': 4,
  'Combava': 3,
  'Corossol': 4,
  'Feijoa': 3,
  'Figuier': 5,
  'Goyavier': 4,
  'Grenadier': 3,
  'Jacquier': 8,
  'Kiwi': 3,
  'Kumquat': 2.5,
  'Letchi': 8,
  'Lime de Tahiti': 3.5,
  'Longane': 8,
  'Mandarinier': 3.5,
  'Manguier': 8,
  'Noyer': 12,
  'Néflier': 4,
  'Olivier': 5,
  'Oranger': 4,
  'Papayer': 2,
  'Plaqueminier': 5,
  'Poirier': 4.5,
  'Pommier': 4,
  'Prunier': 4.5,
  'Pêcher': 4,
  'Ramboutan': 8,
  'Tamarinier': 10,
  'Vanille': 1,
  'Vigne': 1.5,
  'Noisetier': 3,

  // Petits fruits
  "Acérola (cerise des Antilles)": 3,
  'Ananas': 0.8,
  'Argousier': 3,
  'Cassissier': 1.2,
  "Fraise d'altitude": 0.25,
  'Fraisier': 0.25,
  'Framboisier': 0.5,
  'Fruit de la passion': 2,
  'Goyavier de Chine (goyave-fraise)': 3,
  'Groseillier': 1.2,
  'Mûrier platane': 8,
  'Mûrier sans épine': 6,
  'Oseille de Guinée (roselle)': 1,
  'Physalis': 0.8,
  'Sureau': 3,
}

async function main() {
  let maj = 0
  let dejaRenseignees = 0
  let absentes = 0

  for (const [id, etalement] of Object.entries(ETALEMENTS)) {
    const res = await prisma.espece.updateMany({
      where: { id, userId: null, etalement: null },
      data: { etalement },
    })
    if (res.count > 0) {
      maj += res.count
      continue
    }
    const existe = await prisma.espece.findFirst({
      where: { id, userId: null },
      select: { id: true },
    })
    if (existe) dejaRenseignees++
    else absentes++
  }

  console.log(
    `Étalement : ${maj} espèces renseignées, ${dejaRenseignees} déjà renseignées (préservées), ${absentes} absentes du catalogue.`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
