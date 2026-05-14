/**
 * Référentiel des essences forestières et de haie communes en France métropolitaine.
 * Utilisé par l'assistant de plantation pour proposer densités, espacements et conseils.
 *
 * Densités recommandées :
 * - Futaie régulière : 1100 à 1600 tiges/ha
 * - Taillis : 2000 à 3000 tiges/ha
 * - Haie champêtre : 3 à 5 plants par mètre linéaire
 * - Agroforesterie intra-parcellaire : 40 à 100 arbres/ha
 */

export type TypeFormation =
  | "verger"
  | "haie"
  | "agroforesterie"
  | "forestier_futaie"
  | "forestier_taillis"
  | "bosquet"
  | "miscanthus"

export interface EssenceForestiere {
  id: string
  nom: string
  nomLatin: string
  categorie: "feuillu" | "resineux" | "petit_fruit" | "fruitier"
  usages: string[] // "bois_oeuvre", "bois_chauffage", "BRF", "biodiversite", "haie_brise_vent", "fruit", "ombre_animaux", "miel"
  densitesParHa: {
    futaie?: [number, number]
    taillis?: [number, number]
    agroforesterie?: [number, number]
    haie?: [number, number] // par 100m linéaires
  }
  croissance: "lente" | "moyenne" | "rapide" | "tres_rapide"
  sols: string[] // "calcaire", "argileux", "sableux", "limoneux", "acide", "humide"
  expositions: string[] // "soleil", "mi_ombre", "tous"
  cycleAnsRecolte?: number // annees avant recolte/exploitation
  conseils?: string
}

export const ESSENCES_FORESTIERES: EssenceForestiere[] = [
  // ============ FEUILLUS NOBLES ============
  {
    id: "chene_sessile",
    nom: "Chêne sessile",
    nomLatin: "Quercus petraea",
    categorie: "feuillu",
    usages: ["bois_oeuvre", "bois_chauffage", "biodiversite"],
    densitesParHa: { futaie: [1100, 1600], taillis: [2500, 3000] },
    croissance: "lente",
    sols: ["limoneux", "sableux", "acide"],
    expositions: ["soleil", "mi_ombre"],
    cycleAnsRecolte: 150,
    conseils: "Bois d'œuvre de référence. Eviter les sols calcaires actifs.",
  },
  {
    id: "chene_pedoncule",
    nom: "Chêne pédonculé",
    nomLatin: "Quercus robur",
    categorie: "feuillu",
    usages: ["bois_oeuvre", "bois_chauffage", "biodiversite"],
    densitesParHa: { futaie: [1100, 1500], taillis: [2500, 3000] },
    croissance: "lente",
    sols: ["limoneux", "argileux", "humide"],
    expositions: ["soleil"],
    cycleAnsRecolte: 120,
    conseils: "Préfère les sols frais et profonds. Sensible à l'oïdium jeune.",
  },
  {
    id: "hetre",
    nom: "Hêtre",
    nomLatin: "Fagus sylvatica",
    categorie: "feuillu",
    usages: ["bois_oeuvre", "bois_chauffage"],
    densitesParHa: { futaie: [1500, 2500] },
    croissance: "moyenne",
    sols: ["calcaire", "limoneux", "argileux"],
    expositions: ["mi_ombre"],
    cycleAnsRecolte: 100,
    conseils: "Sensible à la sécheresse. A éviter en zone exposée plein sud.",
  },
  {
    id: "merisier",
    nom: "Merisier",
    nomLatin: "Prunus avium",
    categorie: "feuillu",
    usages: ["bois_oeuvre", "biodiversite", "miel"],
    densitesParHa: { futaie: [400, 800], agroforesterie: [40, 80] },
    croissance: "rapide",
    sols: ["limoneux", "calcaire"],
    expositions: ["soleil"],
    cycleAnsRecolte: 60,
    conseils: "Bois précieux à croissance rapide. Idéal en agroforesterie.",
  },
  {
    id: "frene",
    nom: "Frêne commun",
    nomLatin: "Fraxinus excelsior",
    categorie: "feuillu",
    usages: ["bois_oeuvre", "bois_chauffage"],
    densitesParHa: { futaie: [1100, 1600], agroforesterie: [50, 100] },
    croissance: "rapide",
    sols: ["limoneux", "humide"],
    expositions: ["soleil"],
    cycleAnsRecolte: 60,
    conseils: "Attention chalarose (champignon). Vérifier provenances résistantes.",
  },
  {
    id: "erable_sycomore",
    nom: "Érable sycomore",
    nomLatin: "Acer pseudoplatanus",
    categorie: "feuillu",
    usages: ["bois_oeuvre", "miel"],
    densitesParHa: { futaie: [1100, 1600] },
    croissance: "rapide",
    sols: ["limoneux", "calcaire"],
    expositions: ["soleil", "mi_ombre"],
    cycleAnsRecolte: 60,
  },
  {
    id: "chataignier",
    nom: "Châtaignier",
    nomLatin: "Castanea sativa",
    categorie: "feuillu",
    usages: ["bois_oeuvre", "bois_chauffage", "fruit"],
    densitesParHa: { futaie: [1100, 1500], taillis: [2000, 2500] },
    croissance: "rapide",
    sols: ["sableux", "acide"],
    expositions: ["soleil"],
    cycleAnsRecolte: 40,
    conseils: "Refuse les sols calcaires. Production double : bois + fruits.",
  },
  // ============ FEUILLUS RUSTIQUES ============
  {
    id: "charme",
    nom: "Charme",
    nomLatin: "Carpinus betulus",
    categorie: "feuillu",
    usages: ["bois_chauffage", "haie_brise_vent"],
    densitesParHa: { taillis: [2500, 3000], haie: [300, 500] },
    croissance: "moyenne",
    sols: ["calcaire", "limoneux", "argileux"],
    expositions: ["soleil", "mi_ombre"],
    cycleAnsRecolte: 30,
    conseils: "Excellent en haie brise-vent (garde ses feuilles sèches l'hiver).",
  },
  {
    id: "noisetier",
    nom: "Noisetier",
    nomLatin: "Corylus avellana",
    categorie: "feuillu",
    usages: ["BRF", "haie_brise_vent", "fruit", "biodiversite"],
    densitesParHa: { haie: [300, 500], agroforesterie: [200, 400] },
    croissance: "rapide",
    sols: ["limoneux", "calcaire"],
    expositions: ["soleil", "mi_ombre"],
    cycleAnsRecolte: 5,
    conseils: "Croissance rapide. Idéal pour BRF (Bois Raméal Fragmenté).",
  },
  {
    id: "alisier_torminal",
    nom: "Alisier torminal",
    nomLatin: "Sorbus torminalis",
    categorie: "feuillu",
    usages: ["bois_oeuvre", "biodiversite"],
    densitesParHa: { agroforesterie: [40, 80] },
    croissance: "lente",
    sols: ["calcaire", "limoneux"],
    expositions: ["soleil"],
    cycleAnsRecolte: 80,
    conseils: "Bois précieux rare. Bonne disséminée en mélange.",
  },
  {
    id: "tilleul",
    nom: "Tilleul à grandes feuilles",
    nomLatin: "Tilia platyphyllos",
    categorie: "feuillu",
    usages: ["miel", "biodiversite", "haie_brise_vent"],
    densitesParHa: { agroforesterie: [40, 100], haie: [300, 400] },
    croissance: "moyenne",
    sols: ["calcaire", "limoneux"],
    expositions: ["soleil"],
    cycleAnsRecolte: 80,
    conseils: "Très mellifère, ombre dense.",
  },
  // ============ RESINEUX ============
  {
    id: "douglas",
    nom: "Douglas",
    nomLatin: "Pseudotsuga menziesii",
    categorie: "resineux",
    usages: ["bois_oeuvre"],
    densitesParHa: { futaie: [1100, 1600] },
    croissance: "tres_rapide",
    sols: ["limoneux", "acide"],
    expositions: ["soleil"],
    cycleAnsRecolte: 50,
    conseils: "Refuse les sols calcaires. Choisir provenances Washington/Oregon.",
  },
  {
    id: "pin_maritime",
    nom: "Pin maritime",
    nomLatin: "Pinus pinaster",
    categorie: "resineux",
    usages: ["bois_oeuvre"],
    densitesParHa: { futaie: [1100, 1500] },
    croissance: "rapide",
    sols: ["sableux", "acide"],
    expositions: ["soleil"],
    cycleAnsRecolte: 45,
    conseils: "Adapté aux sols pauvres et secs. Sud-Ouest principalement.",
  },
  {
    id: "pin_sylvestre",
    nom: "Pin sylvestre",
    nomLatin: "Pinus sylvestris",
    categorie: "resineux",
    usages: ["bois_oeuvre", "bois_chauffage"],
    densitesParHa: { futaie: [1500, 2000] },
    croissance: "moyenne",
    sols: ["sableux", "limoneux"],
    expositions: ["soleil"],
    cycleAnsRecolte: 80,
  },
  {
    id: "meleze",
    nom: "Mélèze d'Europe",
    nomLatin: "Larix decidua",
    categorie: "resineux",
    usages: ["bois_oeuvre"],
    densitesParHa: { futaie: [1100, 1500] },
    croissance: "rapide",
    sols: ["limoneux"],
    expositions: ["soleil"],
    cycleAnsRecolte: 70,
    conseils: "Résineux à feuilles caduques. Zones montagneuses.",
  },
  // ============ HAIE / PETITS FRUITS ============
  {
    id: "aubepine",
    nom: "Aubépine",
    nomLatin: "Crataegus monogyna",
    categorie: "feuillu",
    usages: ["haie_brise_vent", "biodiversite", "miel"],
    densitesParHa: { haie: [400, 600] },
    croissance: "moyenne",
    sols: ["calcaire", "limoneux", "argileux"],
    expositions: ["soleil"],
    conseils: "Pilier de la haie champêtre. Très mellifère.",
  },
  {
    id: "prunellier",
    nom: "Prunellier",
    nomLatin: "Prunus spinosa",
    categorie: "feuillu",
    usages: ["haie_brise_vent", "biodiversite"],
    densitesParHa: { haie: [400, 600] },
    croissance: "rapide",
    sols: ["calcaire", "limoneux", "argileux"],
    expositions: ["soleil"],
    conseils: "Drageonne fortement, attention en bord de cultures.",
  },
  {
    id: "viorne_obier",
    nom: "Viorne obier",
    nomLatin: "Viburnum opulus",
    categorie: "feuillu",
    usages: ["haie_brise_vent", "biodiversite"],
    densitesParHa: { haie: [300, 500] },
    croissance: "moyenne",
    sols: ["limoneux", "humide"],
    expositions: ["soleil", "mi_ombre"],
  },
  {
    id: "cornouiller_sanguin",
    nom: "Cornouiller sanguin",
    nomLatin: "Cornus sanguinea",
    categorie: "feuillu",
    usages: ["haie_brise_vent", "biodiversite"],
    densitesParHa: { haie: [300, 500] },
    croissance: "moyenne",
    sols: ["calcaire", "limoneux"],
    expositions: ["soleil", "mi_ombre"],
  },
]

/** Densité par défaut selon le type de formation (plants/ha sauf haie : plants/100m) */
export const DENSITES_DEFAUT: Record<TypeFormation, { min: number; max: number; unite: string }> = {
  verger: { min: 200, max: 800, unite: "plants/ha" },
  haie: { min: 300, max: 500, unite: "plants/100m" },
  agroforesterie: { min: 40, max: 100, unite: "plants/ha" },
  forestier_futaie: { min: 1100, max: 1600, unite: "plants/ha" },
  forestier_taillis: { min: 2500, max: 3000, unite: "plants/ha" },
  bosquet: { min: 1500, max: 2500, unite: "plants/ha" },
  miscanthus: { min: 15000, max: 20000, unite: "plants/ha" },
}

/** Etapes types par cycle de plantation forestière */
export const ETAPES_TYPES: Record<TypeFormation, Array<{ type: string; libelle: string; offsetJours: number }>> = {
  forestier_futaie: [
    { type: "preparation_sol", libelle: "Préparation du sol (sous-solage, dégagement)", offsetJours: -60 },
    { type: "plantation", libelle: "Plantation des plants forestiers", offsetJours: 0 },
    { type: "protection_gibier", libelle: "Pose des protections (manchons, clôture)", offsetJours: 7 },
    { type: "evaluation", libelle: "Évaluation taux de reprise (1er bilan)", offsetJours: 180 },
    { type: "regarnissage", libelle: "Regarnissage des manquants", offsetJours: 365 },
    { type: "degagement", libelle: "1er dégagement (concurrence herbacée)", offsetJours: 365 },
    { type: "degagement", libelle: "2e dégagement", offsetJours: 730 },
    { type: "elagage_formation", libelle: "Élagage de formation (10 ans)", offsetJours: 3650 },
  ],
  forestier_taillis: [
    { type: "preparation_sol", libelle: "Préparation du sol", offsetJours: -60 },
    { type: "plantation", libelle: "Plantation", offsetJours: 0 },
    { type: "evaluation", libelle: "Évaluation reprise", offsetJours: 180 },
    { type: "regarnissage", libelle: "Regarnissage", offsetJours: 365 },
    { type: "degagement", libelle: "Dégagement", offsetJours: 365 },
  ],
  agroforesterie: [
    { type: "preparation_sol", libelle: "Préparation des lignes d'arbres", offsetJours: -45 },
    { type: "plantation", libelle: "Plantation des arbres", offsetJours: 0 },
    { type: "protection_gibier", libelle: "Pose protections individuelles", offsetJours: 7 },
    { type: "evaluation", libelle: "Évaluation reprise", offsetJours: 180 },
    { type: "regarnissage", libelle: "Regarnissage", offsetJours: 365 },
    { type: "elagage_formation", libelle: "Élagage de formation (3 ans)", offsetJours: 1095 },
  ],
  haie: [
    { type: "preparation_sol", libelle: "Préparation linéaire (sous-solage)", offsetJours: -45 },
    { type: "plantation", libelle: "Plantation de la haie", offsetJours: 0 },
    { type: "protection_gibier", libelle: "Paillage / protection", offsetJours: 7 },
    { type: "arrosage", libelle: "Arrosage premier été", offsetJours: 120 },
    { type: "evaluation", libelle: "Évaluation reprise", offsetJours: 180 },
    { type: "regarnissage", libelle: "Regarnissage", offsetJours: 365 },
  ],
  bosquet: [
    { type: "preparation_sol", libelle: "Préparation du sol", offsetJours: -45 },
    { type: "plantation", libelle: "Plantation", offsetJours: 0 },
    { type: "protection_gibier", libelle: "Protections", offsetJours: 7 },
    { type: "evaluation", libelle: "Évaluation reprise", offsetJours: 180 },
    { type: "regarnissage", libelle: "Regarnissage", offsetJours: 365 },
  ],
  verger: [
    { type: "preparation_sol", libelle: "Préparation des trous de plantation", offsetJours: -15 },
    { type: "plantation", libelle: "Plantation des arbres fruitiers", offsetJours: 0 },
    { type: "protection_gibier", libelle: "Protections gibier / tuteurage", offsetJours: 1 },
    { type: "arrosage", libelle: "Arrosage de plantation", offsetJours: 1 },
    { type: "evaluation", libelle: "Évaluation reprise", offsetJours: 180 },
    { type: "elagage_formation", libelle: "Taille de formation", offsetJours: 365 },
  ],
  miscanthus: [
    { type: "preparation_sol", libelle: "Préparation du sol (labour profond)", offsetJours: -30 },
    { type: "plantation", libelle: "Plantation des rhizomes", offsetJours: 0 },
    { type: "evaluation", libelle: "Évaluation reprise", offsetJours: 180 },
  ],
}

export function getEssencesByType(type: TypeFormation): EssenceForestiere[] {
  switch (type) {
    case "haie":
      return ESSENCES_FORESTIERES.filter((e) => e.usages.includes("haie_brise_vent"))
    case "forestier_futaie":
    case "forestier_taillis":
    case "bosquet":
      return ESSENCES_FORESTIERES.filter((e) =>
        e.usages.some((u) => ["bois_oeuvre", "bois_chauffage"].includes(u))
      )
    case "agroforesterie":
      return ESSENCES_FORESTIERES.filter((e) =>
        e.densitesParHa.agroforesterie !== undefined
      )
    default:
      return ESSENCES_FORESTIERES
  }
}
