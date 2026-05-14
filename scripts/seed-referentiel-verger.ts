/**
 * Seed initial des référentiels Verger (PROMPT 08 LOT 2) :
 *   - 20 porte-greffes (Pommier, Poirier, Prunier, Pêcher, Cerisier…)
 *   - 30 bioagresseurs (tavelure, carpocapse, monilia, mildiou, doryphore…)
 *   - 30 essences bocagères (Aubépine, Charme, Cornouiller, Noisetier…)
 *
 * Idempotent (upsert sur id ou nom). Crée aussi les liens many-to-many vers
 * Espece quand l'espèce existe en BDD (sinon ignore — n'échoue pas).
 *
 * Usage :
 *   docker compose exec -T app sh -c "cd /app && npx tsx scripts/seed-referentiel-verger.ts"
 *   ou sur l'hôte : npx tsx scripts/seed-referentiel-verger.ts
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// ────────────────────────────────────────────────────────────────────────────
// PORTE-GREFFES (20)
// vigueur/precocite sur échelle 1-5 (1=très faible, 5=très fort)
// ────────────────────────────────────────────────────────────────────────────
type PG = {
  id: string
  nom: string
  vigueur: number
  precocite: number
  sensibilites: string[]
  drageonnement: boolean
  notes?: string
  especes: string[] // ids d'espèces (doit correspondre à Espece.id existant)
}

const portesGreffe: PG[] = [
  // Pommier
  { id: "pg-pommier-m9",      nom: "Pommier M9",      vigueur: 2, precocite: 5, sensibilites: ["asphyxie", "secheresse"], drageonnement: true,  notes: "Nain — verger intensif palissé.", especes: ["Pommier"] },
  { id: "pg-pommier-m26",     nom: "Pommier M26",     vigueur: 3, precocite: 4, sensibilites: ["asphyxie"], drageonnement: true, notes: "Semi-nanifiant.", especes: ["Pommier"] },
  { id: "pg-pommier-mm106",   nom: "Pommier MM106",   vigueur: 4, precocite: 3, sensibilites: ["asphyxie", "phytophthora"], drageonnement: false, notes: "Vigueur moyenne — verger commercial.", especes: ["Pommier"] },
  { id: "pg-pommier-mm111",   nom: "Pommier MM111",   vigueur: 5, precocite: 2, sensibilites: [], drageonnement: false, notes: "Vigoureux — sols pauvres tolérés.", especes: ["Pommier"] },
  { id: "pg-pommier-pajam2",  nom: "Pommier Pajam2",  vigueur: 2, precocite: 5, sensibilites: ["asphyxie"], drageonnement: true, notes: "Type M9, tolérance feu bactérien.", especes: ["Pommier"] },
  // Poirier
  { id: "pg-poirier-sydo",        nom: "Poirier Sydo",        vigueur: 4, precocite: 3, sensibilites: ["calcaire"], drageonnement: false, notes: "Franc poirier amélioré.", especes: ["Poirier"] },
  { id: "pg-poirier-ba29",        nom: "Poirier BA29",        vigueur: 3, precocite: 4, sensibilites: ["calcaire", "secheresse"], drageonnement: false, notes: "Cognassier — vigueur moyenne.", especes: ["Poirier"] },
  { id: "pg-poirier-ohf",         nom: "Poirier OHF",         vigueur: 3, precocite: 4, sensibilites: ["feu_bacterien"], drageonnement: false, notes: "Old Home × Farmingdale.", especes: ["Poirier"] },
  { id: "pg-poirier-cognassier-a", nom: "Poirier Cognassier A", vigueur: 3, precocite: 4, sensibilites: ["calcaire"], drageonnement: true, especes: ["Poirier", "Cognassier"] },
  // Prunier
  { id: "pg-prunier-mariana",     nom: "Prunier Mariana 2624", vigueur: 5, precocite: 3, sensibilites: [], drageonnement: false, especes: ["Prunier", "Abricotier"] },
  { id: "pg-prunier-saint-julien", nom: "Prunier Saint-Julien A", vigueur: 3, precocite: 4, sensibilites: ["secheresse"], drageonnement: true, especes: ["Prunier", "Abricotier", "Pêcher"] },
  { id: "pg-prunier-gf655-2",     nom: "Prunier GF655-2",      vigueur: 2, precocite: 4, sensibilites: [], drageonnement: false, especes: ["Prunier", "Abricotier"] },
  { id: "pg-prunier-pixy",        nom: "Prunier Pixy",         vigueur: 2, precocite: 5, sensibilites: ["asphyxie"], drageonnement: false, notes: "Nanifiant — petits formes.", especes: ["Prunier"] },
  // Pêcher
  { id: "pg-pecher-gf677",        nom: "Pêcher GF677",         vigueur: 5, precocite: 3, sensibilites: ["asphyxie"], drageonnement: false, notes: "Pêcher × amandier — sols calcaires.", especes: ["Pêcher", "Amandier"] },
  { id: "pg-pecher-adesoto",      nom: "Pêcher Adesoto 101",   vigueur: 3, precocite: 4, sensibilites: ["asphyxie"], drageonnement: false, especes: ["Pêcher"] },
  { id: "pg-pecher-cadaman",      nom: "Pêcher Cadaman Avimag", vigueur: 5, precocite: 3, sensibilites: [], drageonnement: false, especes: ["Pêcher"] },
  // Cerisier
  { id: "pg-cerisier-maxma14",    nom: "Cerisier Maxma 14",    vigueur: 4, precocite: 4, sensibilites: [], drageonnement: false, especes: ["Cerisier"] },
  { id: "pg-cerisier-gisela5",    nom: "Cerisier Gisela 5",    vigueur: 2, precocite: 5, sensibilites: ["secheresse"], drageonnement: false, notes: "Nanifiant — palissé.", especes: ["Cerisier"] },
  { id: "pg-cerisier-gisela6",    nom: "Cerisier Gisela 6",    vigueur: 3, precocite: 4, sensibilites: [], drageonnement: false, especes: ["Cerisier"] },
  { id: "pg-cerisier-sainte-lucie", nom: "Cerisier Sainte-Lucie F12/1", vigueur: 5, precocite: 2, sensibilites: ["asphyxie"], drageonnement: false, notes: "Vigoureux — verger non irrigué.", especes: ["Cerisier"] },
]

// ────────────────────────────────────────────────────────────────────────────
// BIOAGRESSEURS (30)
// ────────────────────────────────────────────────────────────────────────────
type BA = {
  id: string
  nomCommun: string
  nomLatin: string
  type: "Maladie" | "Ravageur" | "Adventice"
  organeCible: string
  periodePression: string[]
  methodesPbi: string[]
  seuilNuisibilite?: string
  especes: string[]
}

const bioagresseurs: BA[] = [
  // Maladies fruitières
  { id: "ba-tavelure", nomCommun: "Tavelure", nomLatin: "Venturia inaequalis", type: "Maladie", organeCible: "Feuille", periodePression: ["S12-S25"], methodesPbi: ["biocontrôle", "traitement_AB"], seuilNuisibilite: "RIMpro > 50", especes: ["Pommier", "Poirier"] },
  { id: "ba-monilia", nomCommun: "Moniliose", nomLatin: "Monilinia laxa", type: "Maladie", organeCible: "Fruit", periodePression: ["S10-S15", "S30-S35"], methodesPbi: ["traitement_AB"], especes: ["Abricotier", "Pêcher", "Cerisier", "Prunier"] },
  { id: "ba-oidium-pommier", nomCommun: "Oïdium du pommier", nomLatin: "Podosphaera leucotricha", type: "Maladie", organeCible: "Feuille", periodePression: ["S15-S25"], methodesPbi: ["soufre", "biocontrôle"], especes: ["Pommier"] },
  { id: "ba-feu-bacterien", nomCommun: "Feu bactérien", nomLatin: "Erwinia amylovora", type: "Maladie", organeCible: "Bois", periodePression: ["S18-S25"], methodesPbi: ["taille_assainissement"], seuilNuisibilite: "Risque selon météo (chaleur+humidité floraison)", especes: ["Pommier", "Poirier", "Cognassier"] },
  { id: "ba-cloque", nomCommun: "Cloque du pêcher", nomLatin: "Taphrina deformans", type: "Maladie", organeCible: "Feuille", periodePression: ["S05-S12"], methodesPbi: ["cuivre", "biocontrôle"], especes: ["Pêcher", "Amandier"] },
  { id: "ba-mildiou-vigne", nomCommun: "Mildiou de la vigne", nomLatin: "Plasmopara viticola", type: "Maladie", organeCible: "Feuille", periodePression: ["S18-S35"], methodesPbi: ["cuivre", "biocontrôle"], especes: ["Vigne"] },
  { id: "ba-mildiou-pomme-terre", nomCommun: "Mildiou de la pomme de terre", nomLatin: "Phytophthora infestans", type: "Maladie", organeCible: "Feuille", periodePression: ["S22-S38"], methodesPbi: ["cuivre", "biocontrôle"], especes: ["Pomme de terre", "Tomate"] },
  { id: "ba-mildiou-tomate", nomCommun: "Mildiou de la tomate", nomLatin: "Phytophthora infestans", type: "Maladie", organeCible: "Feuille", periodePression: ["S25-S38"], methodesPbi: ["cuivre", "biocontrôle", "abri"], especes: ["Tomate"] },
  { id: "ba-fusariose", nomCommun: "Fusariose", nomLatin: "Fusarium oxysporum", type: "Maladie", organeCible: "Racine", periodePression: ["S20-S35"], methodesPbi: ["rotation", "porte_greffe_resistant"], especes: ["Tomate", "Melon", "Concombre"] },
  { id: "ba-rouille", nomCommun: "Rouille brune", nomLatin: "Puccinia recondita", type: "Maladie", organeCible: "Feuille", periodePression: ["S18-S28"], methodesPbi: ["variete_resistante"], especes: ["Blé", "Poireau"] },
  // Ravageurs fruitiers
  { id: "ba-carpocapse", nomCommun: "Carpocapse des pommes", nomLatin: "Cydia pomonella", type: "Ravageur", organeCible: "Fruit", periodePression: ["S20-S35"], methodesPbi: ["piège", "confusion_sexuelle", "filet"], seuilNuisibilite: "5 captures/piège/semaine", especes: ["Pommier", "Poirier", "Noyer"] },
  { id: "ba-puceron-cendre", nomCommun: "Puceron cendré du pommier", nomLatin: "Dysaphis plantaginea", type: "Ravageur", organeCible: "Feuille", periodePression: ["S10-S20"], methodesPbi: ["auxiliaires", "savon_noir"], especes: ["Pommier"] },
  { id: "ba-hoplocampe", nomCommun: "Hoplocampe du pommier", nomLatin: "Hoplocampa testudinea", type: "Ravageur", organeCible: "Fruit", periodePression: ["S15-S20"], methodesPbi: ["piège_blanc"], especes: ["Pommier"] },
  { id: "ba-anthonome", nomCommun: "Anthonome du pommier", nomLatin: "Anthonomus pomorum", type: "Ravageur", organeCible: "Fleur", periodePression: ["S10-S15"], methodesPbi: ["frappage", "barrière_glu"], especes: ["Pommier", "Poirier"] },
  { id: "ba-mouche-cerise", nomCommun: "Mouche de la cerise", nomLatin: "Rhagoletis cerasi", type: "Ravageur", organeCible: "Fruit", periodePression: ["S20-S25"], methodesPbi: ["piège_jaune", "filet"], especes: ["Cerisier"] },
  { id: "ba-drosophila-suzukii", nomCommun: "Drosophile à ailes tachetées", nomLatin: "Drosophila suzukii", type: "Ravageur", organeCible: "Fruit", periodePression: ["S25-S40"], methodesPbi: ["filet_insectproof", "piège"], seuilNuisibilite: "Présence = action", especes: ["Cerisier", "Framboisier", "Vigne"] },
  // Ravageurs maraîchers
  { id: "ba-doryphore", nomCommun: "Doryphore", nomLatin: "Leptinotarsa decemlineata", type: "Ravageur", organeCible: "Feuille", periodePression: ["S18-S28"], methodesPbi: ["ramassage_manuel", "BT_tenebrionis"], especes: ["Pomme de terre", "Aubergine"] },
  { id: "ba-altise", nomCommun: "Altises", nomLatin: "Phyllotreta spp.", type: "Ravageur", organeCible: "Feuille", periodePression: ["S15-S25"], methodesPbi: ["filet", "voile"], especes: ["Radis", "Roquette", "Chou", "Navet"] },
  { id: "ba-piéride-chou", nomCommun: "Piéride du chou", nomLatin: "Pieris brassicae", type: "Ravageur", organeCible: "Feuille", periodePression: ["S18-S35"], methodesPbi: ["filet", "BT_kurstaki"], especes: ["Chou", "Chou-fleur", "Chou de Bruxelles"] },
  { id: "ba-noctuelle", nomCommun: "Noctuelles", nomLatin: "Agrotis spp.", type: "Ravageur", organeCible: "Tige", periodePression: ["S18-S35"], methodesPbi: ["piège_phéromone", "auxiliaires"], especes: ["Tomate", "Chou", "Salade"] },
  { id: "ba-mineuse-poireau", nomCommun: "Mineuse du poireau", nomLatin: "Phytomyza gymnostoma", type: "Ravageur", organeCible: "Feuille", periodePression: ["S14-S20", "S35-S40"], methodesPbi: ["filet", "voile"], especes: ["Poireau", "Oignon"] },
  { id: "ba-thrips-oignon", nomCommun: "Thrips de l'oignon", nomLatin: "Thrips tabaci", type: "Ravageur", organeCible: "Feuille", periodePression: ["S22-S32"], methodesPbi: ["piège_bleu", "auxiliaires"], especes: ["Oignon", "Poireau"] },
  { id: "ba-taupin", nomCommun: "Taupins", nomLatin: "Agriotes spp.", type: "Ravageur", organeCible: "Racine", periodePression: ["S15-S38"], methodesPbi: ["rotation", "engrais_vert"], especes: ["Pomme de terre", "Carotte", "Salade"] },
  { id: "ba-puceron-noir", nomCommun: "Puceron noir de la fève", nomLatin: "Aphis fabae", type: "Ravageur", organeCible: "Tige", periodePression: ["S18-S25"], methodesPbi: ["auxiliaires", "savon_noir"], especes: ["Fève", "Haricot", "Betterave"] },
  // Maladies maraîchères / petits fruits
  { id: "ba-ascochytose", nomCommun: "Ascochytose du pois", nomLatin: "Ascochyta pisi", type: "Maladie", organeCible: "Feuille", periodePression: ["S20-S28"], methodesPbi: ["rotation", "variete_resistante"], especes: ["Pois"] },
  { id: "ba-oidium-cucurbitacees", nomCommun: "Oïdium des cucurbitacées", nomLatin: "Podosphaera xanthii", type: "Maladie", organeCible: "Feuille", periodePression: ["S20-S35"], methodesPbi: ["soufre", "variete_resistante"], especes: ["Courgette", "Concombre", "Courge", "Melon"] },
  { id: "ba-botrytis", nomCommun: "Pourriture grise", nomLatin: "Botrytis cinerea", type: "Maladie", organeCible: "Fruit", periodePression: ["S15-S40"], methodesPbi: ["aération", "biocontrôle"], especes: ["Fraisier", "Vigne", "Tomate"] },
  { id: "ba-mildiou-laitue", nomCommun: "Mildiou de la laitue", nomLatin: "Bremia lactucae", type: "Maladie", organeCible: "Feuille", periodePression: ["S10-S20", "S35-S45"], methodesPbi: ["variete_resistante"], especes: ["Laitue"] },
  // Adventices
  { id: "ba-chiendent", nomCommun: "Chiendent rampant", nomLatin: "Elytrigia repens", type: "Adventice", organeCible: "Racine", periodePression: ["S10-S40"], methodesPbi: ["faux_semis", "occultation"], especes: [] },
  { id: "ba-liseron", nomCommun: "Liseron des champs", nomLatin: "Convolvulus arvensis", type: "Adventice", organeCible: "Tige", periodePression: ["S15-S40"], methodesPbi: ["occultation"], especes: [] },
]

// ────────────────────────────────────────────────────────────────────────────
// ESSENCES BOCAGÈRES (30)
// ────────────────────────────────────────────────────────────────────────────
type EB = {
  id: string
  nomCommun: string
  nomLatin: string
  hauteurM: number
  croissance: "Lente" | "Moyenne" | "Rapide"
  roles: string[]
  persistant: boolean
  epineux: boolean
}

const essencesBocageres: EB[] = [
  { id: "eb-aubepine",          nomCommun: "Aubépine monogyne", nomLatin: "Crataegus monogyna", hauteurM: 8,  croissance: "Moyenne", roles: ["brise-vent", "refuge auxiliaires", "mellifère"], persistant: false, epineux: true },
  { id: "eb-charme",            nomCommun: "Charme commun",      nomLatin: "Carpinus betulus",   hauteurM: 20, croissance: "Moyenne", roles: ["brise-vent", "bois énergie"], persistant: false, epineux: false },
  { id: "eb-cornouiller-sanguin", nomCommun: "Cornouiller sanguin", nomLatin: "Cornus sanguinea", hauteurM: 4,  croissance: "Moyenne", roles: ["refuge auxiliaires", "mellifère"], persistant: false, epineux: false },
  { id: "eb-cornouiller-male",  nomCommun: "Cornouiller mâle",  nomLatin: "Cornus mas",         hauteurM: 6,  croissance: "Lente",  roles: ["mellifère", "fruits comestibles"], persistant: false, epineux: false },
  { id: "eb-erable-champetre",  nomCommun: "Érable champêtre",  nomLatin: "Acer campestre",     hauteurM: 15, croissance: "Moyenne", roles: ["brise-vent", "bois énergie"], persistant: false, epineux: false },
  { id: "eb-noisetier",         nomCommun: "Noisetier commun",   nomLatin: "Corylus avellana",  hauteurM: 6,  croissance: "Rapide",  roles: ["refuge auxiliaires", "fruits comestibles"], persistant: false, epineux: false },
  { id: "eb-prunellier",        nomCommun: "Prunellier",         nomLatin: "Prunus spinosa",    hauteurM: 4,  croissance: "Moyenne", roles: ["refuge auxiliaires", "mellifère"], persistant: false, epineux: true },
  { id: "eb-sureau-noir",       nomCommun: "Sureau noir",        nomLatin: "Sambucus nigra",    hauteurM: 8,  croissance: "Rapide",  roles: ["refuge auxiliaires", "mellifère", "fruits comestibles"], persistant: false, epineux: false },
  { id: "eb-viorne-lantane",    nomCommun: "Viorne lantane",     nomLatin: "Viburnum lantana",  hauteurM: 4,  croissance: "Moyenne", roles: ["refuge auxiliaires", "mellifère"], persistant: false, epineux: false },
  { id: "eb-viorne-obier",      nomCommun: "Viorne obier",       nomLatin: "Viburnum opulus",   hauteurM: 4,  croissance: "Moyenne", roles: ["refuge auxiliaires", "mellifère"], persistant: false, epineux: false },
  { id: "eb-fusain",            nomCommun: "Fusain d'Europe",    nomLatin: "Euonymus europaeus", hauteurM: 5, croissance: "Moyenne", roles: ["refuge auxiliaires"], persistant: false, epineux: false },
  { id: "eb-houx",              nomCommun: "Houx commun",        nomLatin: "Ilex aquifolium",   hauteurM: 8,  croissance: "Lente",  roles: ["brise-vent", "refuge auxiliaires"], persistant: true, epineux: true },
  { id: "eb-troene",            nomCommun: "Troène commun",      nomLatin: "Ligustrum vulgare", hauteurM: 4,  croissance: "Moyenne", roles: ["brise-vent", "mellifère"], persistant: false, epineux: false },
  { id: "eb-bourdaine",         nomCommun: "Bourdaine",          nomLatin: "Frangula alnus",    hauteurM: 5,  croissance: "Moyenne", roles: ["refuge auxiliaires", "mellifère"], persistant: false, epineux: false },
  { id: "eb-neflier",           nomCommun: "Néflier",            nomLatin: "Mespilus germanica", hauteurM: 5, croissance: "Lente",  roles: ["fruits comestibles", "mellifère"], persistant: false, epineux: false },
  { id: "eb-tilleul-petites-feuilles", nomCommun: "Tilleul à petites feuilles", nomLatin: "Tilia cordata", hauteurM: 25, croissance: "Moyenne", roles: ["mellifère", "bois énergie"], persistant: false, epineux: false },
  { id: "eb-chataignier",       nomCommun: "Châtaignier",        nomLatin: "Castanea sativa",   hauteurM: 25, croissance: "Rapide", roles: ["bois énergie", "fruits comestibles"], persistant: false, epineux: false },
  { id: "eb-saule-marsault",    nomCommun: "Saule marsault",     nomLatin: "Salix caprea",      hauteurM: 10, croissance: "Rapide", roles: ["mellifère", "refuge auxiliaires", "bois énergie"], persistant: false, epineux: false },
  { id: "eb-frene-commun",      nomCommun: "Frêne commun",       nomLatin: "Fraxinus excelsior", hauteurM: 30, croissance: "Rapide", roles: ["bois énergie", "brise-vent"], persistant: false, epineux: false },
  { id: "eb-chene-sessile",     nomCommun: "Chêne sessile",      nomLatin: "Quercus petraea",   hauteurM: 30, croissance: "Lente", roles: ["bois oeuvre", "refuge auxiliaires"], persistant: false, epineux: false },
  { id: "eb-chene-pedoncule",   nomCommun: "Chêne pédonculé",    nomLatin: "Quercus robur",     hauteurM: 35, croissance: "Lente", roles: ["bois oeuvre", "refuge auxiliaires"], persistant: false, epineux: false },
  { id: "eb-merisier",          nomCommun: "Merisier",           nomLatin: "Prunus avium",      hauteurM: 20, croissance: "Rapide", roles: ["mellifère", "bois oeuvre"], persistant: false, epineux: false },
  { id: "eb-alisier-blanc",     nomCommun: "Alisier blanc",      nomLatin: "Sorbus aria",       hauteurM: 12, croissance: "Lente", roles: ["mellifère", "refuge auxiliaires"], persistant: false, epineux: false },
  { id: "eb-sorbier-oiseleurs", nomCommun: "Sorbier des oiseleurs", nomLatin: "Sorbus aucuparia", hauteurM: 12, croissance: "Moyenne", roles: ["refuge auxiliaires", "mellifère"], persistant: false, epineux: false },
  { id: "eb-pommier-sauvage",   nomCommun: "Pommier sauvage",    nomLatin: "Malus sylvestris",  hauteurM: 10, croissance: "Lente", roles: ["mellifère", "refuge auxiliaires"], persistant: false, epineux: false },
  { id: "eb-poirier-sauvage",   nomCommun: "Poirier sauvage",    nomLatin: "Pyrus pyraster",    hauteurM: 15, croissance: "Lente", roles: ["mellifère", "refuge auxiliaires"], persistant: false, epineux: false },
  { id: "eb-genet-balais",      nomCommun: "Genêt à balais",     nomLatin: "Cytisus scoparius", hauteurM: 3,  croissance: "Rapide", roles: ["mellifère", "fixateur azote"], persistant: false, epineux: false },
  { id: "eb-bouleau-verruqueux", nomCommun: "Bouleau verruqueux", nomLatin: "Betula pendula",   hauteurM: 25, croissance: "Rapide", roles: ["brise-vent", "bois énergie"], persistant: false, epineux: false },
  { id: "eb-robinier",          nomCommun: "Robinier faux-acacia", nomLatin: "Robinia pseudoacacia", hauteurM: 20, croissance: "Rapide", roles: ["mellifère", "bois énergie", "fixateur azote"], persistant: false, epineux: true },
  { id: "eb-erable-sycomore",   nomCommun: "Érable sycomore",    nomLatin: "Acer pseudoplatanus", hauteurM: 25, croissance: "Rapide", roles: ["brise-vent", "bois oeuvre"], persistant: false, epineux: false },
]

// ────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("[seed-referentiel-verger] Démarrage")

  // 1) Porte-greffes
  for (const pg of portesGreffe) {
    await prisma.porteGreffe.upsert({
      where: { id: pg.id },
      update: { nom: pg.nom, vigueur: pg.vigueur, precocite: pg.precocite, sensibilites: pg.sensibilites, drageonnement: pg.drageonnement, notes: pg.notes ?? null },
      create: { id: pg.id, nom: pg.nom, vigueur: pg.vigueur, precocite: pg.precocite, sensibilites: pg.sensibilites, drageonnement: pg.drageonnement, notes: pg.notes ?? null },
    })
    // Liens vers especes existantes
    for (const especeId of pg.especes) {
      const e = await prisma.espece.findUnique({ where: { id: especeId } })
      if (!e) continue
      await prisma.porteGreffeEspece.upsert({
        where: { porteGreffeId_especeId: { porteGreffeId: pg.id, especeId } },
        update: {},
        create: { porteGreffeId: pg.id, especeId },
      })
    }
  }
  console.log(`  ✓ ${portesGreffe.length} porte-greffes`)

  // 2) Bioagresseurs
  for (const ba of bioagresseurs) {
    await prisma.bioagresseur.upsert({
      where: { id: ba.id },
      update: { nomCommun: ba.nomCommun, nomLatin: ba.nomLatin, type: ba.type, organeCible: ba.organeCible, periodePression: ba.periodePression, methodesPbi: ba.methodesPbi, seuilNuisibilite: ba.seuilNuisibilite ?? null },
      create: { id: ba.id, nomCommun: ba.nomCommun, nomLatin: ba.nomLatin, type: ba.type, organeCible: ba.organeCible, periodePression: ba.periodePression, methodesPbi: ba.methodesPbi, seuilNuisibilite: ba.seuilNuisibilite ?? null },
    })
    for (const especeId of ba.especes) {
      const e = await prisma.espece.findUnique({ where: { id: especeId } })
      if (!e) continue
      await prisma.bioagresseurEspece.upsert({
        where: { bioagresseurId_especeId: { bioagresseurId: ba.id, especeId } },
        update: {},
        create: { bioagresseurId: ba.id, especeId },
      })
    }
  }
  console.log(`  ✓ ${bioagresseurs.length} bioagresseurs`)

  // 3) Essences bocagères
  for (const eb of essencesBocageres) {
    await prisma.essenceBocagere.upsert({
      where: { id: eb.id },
      update: { nomCommun: eb.nomCommun, nomLatin: eb.nomLatin, hauteurM: eb.hauteurM, croissance: eb.croissance, roles: eb.roles, persistant: eb.persistant, epineux: eb.epineux },
      create: { id: eb.id, nomCommun: eb.nomCommun, nomLatin: eb.nomLatin, hauteurM: eb.hauteurM, croissance: eb.croissance, roles: eb.roles, persistant: eb.persistant, epineux: eb.epineux },
    })
  }
  console.log(`  ✓ ${essencesBocageres.length} essences bocagères`)

  console.log("[seed-referentiel-verger] Terminé")
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
