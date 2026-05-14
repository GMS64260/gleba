/**
 * Catalogue des dispositifs d'aide à la plantation forestière en France.
 * Données éditoriales, à mettre à jour régulièrement (les conditions évoluent).
 *
 * Sources : Ministère de l'Agriculture, France Bois Forêt, ADEME, Conseils régionaux.
 */

export interface DispositifAide {
  id: string
  nom: string
  organisme: string
  niveau: "national" | "regional" | "europeen" | "departemental"
  typesEligibles: string[] // "forestier_futaie", "forestier_taillis", "agroforesterie", "haie", "verger", "bosquet"
  publicCible: string // "particuliers", "agriculteurs", "collectivites", "tous"
  description: string
  conditions: string[]
  tauxAide?: string // ex: "Jusqu'à 60% du coût HT"
  plafond?: string
  url: string
  actif: boolean
}

export const AIDES_PLANTATION: DispositifAide[] = [
  // ============ AIDES NATIONALES ============
  {
    id: "defi_foret",
    nom: "DEFI Forêt",
    organisme: "Direction Générale des Finances Publiques",
    niveau: "national",
    typesEligibles: ["forestier_futaie", "forestier_taillis", "bosquet"],
    publicCible: "particuliers",
    description:
      "Crédit d'impôt sur le revenu pour les travaux forestiers réalisés par des propriétaires de forêts (DEFI Travaux). Couvre plantation, reboisement, dégagement, élagage.",
    conditions: [
      "Propriété forestière de 10 ha minimum (ou regroupement)",
      "Plan Simple de Gestion ou DGD ou équivalent",
      "Travaux réalisés par un professionnel ou ETF",
      "Engagement de gestion durable",
    ],
    tauxAide: "25% (porté à 76% sous conditions de groupement et de label)",
    plafond: "6 250 € / an (12 500 € en couple)",
    url: "https://www.impots.gouv.fr/particulier/questions/quelles-sont-les-depenses-relatives-aux-investissements-forestiers",
    actif: true,
  },
  {
    id: "france_2030_renouvellement_forestier",
    nom: "France 2030 - Renouvellement Forestier",
    organisme: "DRAAF / Préfecture de région",
    niveau: "national",
    typesEligibles: ["forestier_futaie", "forestier_taillis"],
    publicCible: "tous",
    description:
      "Aide à l'adaptation et la résilience des forêts face au changement climatique. Cible le reboisement après crise sanitaire (scolytes, sécheresse) et l'amélioration des peuplements.",
    conditions: [
      "Surface minimum 1 ha d'un seul tenant (ou 4 ha en regroupement)",
      "Plants en provenance MFR contrôlée",
      "Diversification des essences",
      "Engagement de gestion 30 ans",
    ],
    tauxAide: "Jusqu'à 80% pour reboisement post-crise, 60% pour amélioration",
    url: "https://agriculture.gouv.fr/france-2030-renouvellement-forestier",
    actif: true,
  },
  {
    id: "label_bas_carbone_foret",
    nom: "Label Bas-Carbone (méthodes forestières)",
    organisme: "Ministère de la Transition écologique",
    niveau: "national",
    typesEligibles: ["forestier_futaie", "forestier_taillis", "bosquet"],
    publicCible: "tous",
    description:
      "Permet de vendre des crédits carbone générés par votre projet de boisement ou reboisement à des entreprises souhaitant compenser leurs émissions.",
    conditions: [
      "Méthodes labellisées : Boisement, Reconstitution post-tempête, Balivage",
      "Vérification par un tiers",
      "Surface minimum variable selon la méthode",
    ],
    tauxAide: "Valorisation des tonnes CO2 séquestrées (30-50€/t CO2)",
    url: "https://www.ecologie.gouv.fr/label-bas-carbone",
    actif: true,
  },
  // ============ AGROFORESTERIE & HAIES ============
  {
    id: "plan_haies",
    nom: "Plan National Haies",
    organisme: "Ministère de l'Agriculture",
    niveau: "national",
    typesEligibles: ["haie", "agroforesterie", "bosquet"],
    publicCible: "agriculteurs",
    description:
      "Programme de plantation de haies bocagères. Objectif national : +50 000 km de haies d'ici 2030. Financement plantation, protection, entretien des 3 premières années.",
    conditions: [
      "Exploitation agricole",
      "Diagnostic préalable",
      "Plants locaux (label Végétal Local recommandé)",
      "Engagement d'entretien 5 ans minimum",
    ],
    tauxAide: "70 à 100% selon région",
    url: "https://agriculture.gouv.fr/le-plan-national-en-faveur-des-haies",
    actif: true,
  },
  {
    id: "maec_agroforesterie",
    nom: "MAEC - Mesures Agro-Environnementales et Climatiques",
    organisme: "PAC / DRAAF",
    niveau: "europeen",
    typesEligibles: ["agroforesterie", "haie"],
    publicCible: "agriculteurs",
    description:
      "Aide annuelle pour l'entretien d'éléments arborés (haies, arbres isolés, alignements). S'inscrit dans la PAC.",
    conditions: [
      "Exploitation agricole déclarée PAC",
      "Engagement de 5 ans",
      "Cahier des charges régional",
    ],
    tauxAide: "Forfait à l'hectare ou au mètre linéaire selon zone",
    url: "https://agriculture.gouv.fr/les-mesures-agroenvironnementales-et-climatiques-maec",
    actif: true,
  },
  // ============ AIDES REGIONALES (exemples) ============
  {
    id: "region_bretagne_breizh_bocage",
    nom: "Breizh Bocage",
    organisme: "Région Bretagne",
    niveau: "regional",
    typesEligibles: ["haie", "agroforesterie"],
    publicCible: "tous",
    description:
      "Programme régional breton de reconquête bocagère. Plantation, regarnissage, restauration de haies et talus.",
    conditions: [
      "Projet situé en Bretagne",
      "Portage par une collectivité ou structure intermédiaire",
      "Plants d'origine locale",
    ],
    tauxAide: "Jusqu'à 100% pour particuliers via collectivités",
    url: "https://www.bretagne.bzh/aides/fiches/breizh-bocage/",
    actif: true,
  },
  {
    id: "region_normandie_plantons",
    nom: "Plantons en Normandie",
    organisme: "Région Normandie",
    niveau: "regional",
    typesEligibles: ["forestier_futaie", "haie", "agroforesterie", "verger"],
    publicCible: "tous",
    description:
      "Aide régionale à la plantation : haies, vergers, agroforesterie, boisement. Cumul possible avec aides nationales.",
    conditions: [
      "Projet en Normandie",
      "Devis détaillé",
      "Essences validées",
    ],
    tauxAide: "Variable selon le type (souvent 40-80%)",
    url: "https://aides.normandie.fr/plantons-en-normandie",
    actif: true,
  },
  {
    id: "region_aura_sylvaccess",
    nom: "Sylv'ACCTES",
    organisme: "Région Auvergne-Rhône-Alpes",
    niveau: "regional",
    typesEligibles: ["forestier_futaie", "forestier_taillis"],
    publicCible: "tous",
    description:
      "Aide à la sylviculture durable en AURA. Plantation, irrégularisation, mélange d'essences.",
    conditions: ["Projet en région AURA", "Itinéraire sylvicole labellisé"],
    tauxAide: "40 à 80% selon itinéraire",
    url: "https://www.sylvacctes.org/",
    actif: true,
  },
  // ============ VERGERS ============
  {
    id: "fam_vergers",
    nom: "Aide à la rénovation des vergers (FranceAgriMer)",
    organisme: "FranceAgriMer",
    niveau: "national",
    typesEligibles: ["verger"],
    publicCible: "agriculteurs",
    description:
      "Soutien à l'arrachage et à la replantation de vergers (pommiers, poiriers, abricotiers, cerisiers, pêchers, etc.).",
    conditions: [
      "Producteur professionnel",
      "Variétés inscrites au cahier des charges",
      "Densité minimale exigée",
    ],
    tauxAide: "Forfait à l'hectare selon espèce",
    url: "https://www.franceagrimer.fr/",
    actif: true,
  },
  // ============ EUROPEEN ============
  {
    id: "feader_boisement",
    nom: "FEADER - Boisement de terres agricoles",
    organisme: "Union européenne / Conseil régional",
    niveau: "europeen",
    typesEligibles: ["forestier_futaie", "agroforesterie"],
    publicCible: "agriculteurs",
    description:
      "Aide européenne au boisement de terres agricoles. Couvre frais d'installation et compensation manque à gagner.",
    conditions: [
      "Terres en SAU depuis 3 ans minimum",
      "Surface minimum (variable selon région)",
      "Engagement long terme (15-20 ans)",
    ],
    tauxAide: "Jusqu'à 100% des frais + prime annuelle",
    url: "https://agriculture.gouv.fr/feader-fonds-europeen-agricole-pour-le-developpement-rural",
    actif: true,
  },
]

export function getAidesByType(typeFormation: string): DispositifAide[] {
  return AIDES_PLANTATION.filter(
    (aide) => aide.actif && aide.typesEligibles.includes(typeFormation)
  )
}

export const NIVEAU_LIBELLE: Record<DispositifAide["niveau"], string> = {
  national: "Aide nationale",
  regional: "Aide régionale",
  europeen: "Aide européenne",
  departemental: "Aide départementale",
}
