/**
 * Catalogue des dispositifs d'aide à la plantation forestière, verger,
 * maraîchage et conversion AB en France.
 *
 * Données éditoriales, à mettre à jour régulièrement (les conditions évoluent).
 *
 * Sources :
 *   - Ministère de l'Agriculture (PCAE, CAB/MAB, Plan Bio) — https://agriculture.gouv.fr
 *   - Agence Bio (CAB/MAB, Crédit d'impôt Bio) — https://www.agencebio.org
 *   - Code général des impôts art. 244 quater L (Crédit d'impôt Bio)
 *   - Règlement (UE) 2021/2115 — PAC 2023-2027 (Éco-régime, BCAE)
 *   - FranceAgriMer — programmes verger & Plan Bio
 *   - France Bois Forêt, ADEME, Conseils régionaux pour les dispositifs forestiers.
 *
 * PROMPT 13 : ajout PCAE, CAB, MAB, Crédit d'impôt Bio, Plan Bio FAM, Éco-régime PAC.
 */

export interface DispositifAide {
  id: string
  nom: string
  organisme: string
  niveau: "national" | "regional" | "europeen" | "departemental"
  typesEligibles: string[] // "forestier_futaie", "forestier_taillis", "agroforesterie", "haie", "verger", "bosquet", "maraichage", "polyculture"
  publicCible: string // "particuliers", "agriculteurs", "collectivites", "tous"
  description: string
  conditions: string[]
  tauxAide?: string // ex: "Jusqu'à 60% du coût HT"
  plafond?: string
  url: string
  actif: boolean
  // PROMPT 13 — Cumul AB et filtres avancés.
  cumulAB?: boolean             // true = cumulable avec conversion/maintien AB
  abCompatible?: boolean        // true = spécifiquement orienté AB ou favorise AB
  regions?: string[]            // [] = national ; sinon liste de régions ("Bretagne","Normandie","AURA"…)
  piecesAFournir?: string[]     // liste indicative des pièces du dossier
  echeance?: string             // ex: "Dépôt avant 31 mars"
  montantIndicatif?: string     // libellé monétaire alternatif à tauxAide
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

  // ============ PROMPT 13 — AIDES AB & PCAE ============

  // Source : portails Régions + FranceAgriMer (volet végétal du PCAE).
  // Le PCAE (Plan de Compétitivité et d'Adaptation des Exploitations) est piloté
  // en région ; ses volets diffèrent. Ici on liste le tronc commun "végétal".
  {
    id: "pcae-vegetal",
    nom: "PCAE — volet végétal",
    organisme: "Conseil Régional + FEADER",
    niveau: "regional",
    typesEligibles: ["verger", "maraichage", "agroforesterie", "polyculture"],
    publicCible: "agriculteurs",
    description:
      "Aide à l'investissement productif : protection cultures (filets paragrêle, anti-insectes, anti-pluie), irrigation économe, palissage, matériel mécanique de désherbage, serres et tunnels, équipements post-récolte.",
    conditions: [
      "Exploitation agricole (SIRET + MSA)",
      "Investissement amortissable > 4 000 € HT (seuils variables selon région)",
      "Dossier déposé via portail régional (appels à projets)",
      "Maintien de l'investissement 5 ans",
    ],
    tauxAide: "30 à 50 % du coût HT (bonus jusqu'à 60 % en AB / JA / zone montagne)",
    plafond: "Variable selon volet et région (plafond moyen 40 000 à 80 000 € d'aide)",
    url: "https://agriculture.gouv.fr/le-plan-de-competitivite-et-dadaptation-des-exploitations-agricoles-pcae",
    actif: true,
    cumulAB: true,
    abCompatible: true,
    echeance: "Appels à projets régionaux (souvent 2 fenêtres : printemps + automne)",
    piecesAFournir: [
      "Devis détaillé des investissements",
      "Plan de financement",
      "Justificatif statut agricole (MSA, SIRET)",
      "Attestation organisme certificateur AB (si bonus AB demandé)",
    ],
    montantIndicatif: "30-60 % HT, plafond ~80 k€",
  },

  // Source : Agence Bio + DRAAF. CAB = aide à la conversion (C1-C2-C3).
  {
    id: "cab",
    nom: "CAB — Aide à la Conversion en Agriculture Biologique",
    organisme: "DRAAF / Agence Bio (FEADER)",
    niveau: "national",
    typesEligibles: ["verger", "maraichage", "agroforesterie", "polyculture", "haie"],
    publicCible: "agriculteurs",
    description:
      "Aide annuelle pendant les 5 années de conversion (couvre période C1 à C3 + 2 ans post-conversion). Versée à l'hectare, par catégorie de culture. Demande dans la PAC.",
    conditions: [
      "Notification engagement bio à l'Agence Bio",
      "Contrôle annuel par organisme certificateur agréé",
      "Engagement de 5 ans",
      "Soumis aux plafonds de minimis dans certains cas",
    ],
    tauxAide: "300 à 900 €/ha/an selon catégorie (maraîchage ~ 350 €, arbo ~ 900 €, PPAM ~ 350 €)",
    plafond: "Pas de plafond strict mais dégressivité possible si surface importante",
    url: "https://www.agencebio.org/vos-outils/financements-aides-fiscalite/aides-bio/",
    actif: true,
    cumulAB: true,
    abCompatible: true,
    echeance: "Déclaration dans la PAC (TéléPAC), avant 15 mai chaque année",
    piecesAFournir: [
      "Notification d'engagement Agence Bio",
      "Certificat de conformité bio (organisme certificateur)",
      "Déclaration PAC complétée",
      "Plan parcellaire à jour",
    ],
  },

  // Source : Agence Bio + DRAAF. MAB = aide au maintien (post-conversion).
  // Note : MAB supprimée à l'échelle nationale par PAC 2023-2027 dans la plupart
  // des régions, mais subsiste sous d'autres formes (Éco-régime, aides régionales).
  {
    id: "mab",
    nom: "MAB — Aide au Maintien en Agriculture Biologique",
    organisme: "Conseil Régional (variable) / FEADER",
    niveau: "regional",
    typesEligibles: ["verger", "maraichage", "agroforesterie", "polyculture", "haie"],
    publicCible: "agriculteurs",
    description:
      "Aide annuelle au maintien après les 5 années de conversion CAB. Statut variable selon les régions depuis la PAC 2023-2027 : certaines régions la maintiennent (PACA, Occitanie partielle), d'autres l'ont remplacée par l'Éco-régime PAC.",
    conditions: [
      "Exploitation déjà certifiée AB",
      "Engagement 5 ans renouvelable",
      "Contrôle annuel certificateur",
      "Variable selon politique régionale",
    ],
    tauxAide: "150 à 600 €/ha/an (variable, souvent inférieur à la CAB)",
    url: "https://www.agencebio.org/vos-outils/financements-aides-fiscalite/aides-bio/",
    actif: true,
    cumulAB: true,
    abCompatible: true,
    echeance: "PAC — TéléPAC, avant 15 mai",
    piecesAFournir: ["Certificat AB", "Déclaration PAC"],
  },

  // Source : Article 244 quater L du CGI (Code Général des Impôts).
  // Reconduit dans la LF 2023 pour la période 2023-2027.
  {
    id: "credit-impot-bio",
    nom: "Crédit d'impôt Bio (CIBio)",
    organisme: "Direction Générale des Finances Publiques",
    niveau: "national",
    typesEligibles: ["verger", "maraichage", "agroforesterie", "polyculture", "haie"],
    publicCible: "agriculteurs",
    description:
      "Crédit d'impôt forfaitaire de 4 500 €/an (porté à 4 500 € depuis la LF 2023) pour les exploitations agricoles dont au moins 40 % du CA provient de l'AB. Compatible avec CAB/MAB sous plafond de cumul.",
    conditions: [
      "CA AB ≥ 40 % du CA total de l'exploitation",
      "Cumul autorisé avec CAB/MAB dans la limite de 5 000 €/an",
      "Forme sociétaire : crédit majoré pour GAEC (max 4 associés)",
      "Cadre : article 244 quater L du CGI",
    ],
    tauxAide: "4 500 € forfaitaires par an (5 000 € avec cumul aides bio)",
    plafond: "4 500 €/an (× nb associés GAEC, plafond 18 000 € pour 4 associés)",
    url: "https://www.impots.gouv.fr/professionnel/credit-dimpot-en-faveur-de-lagriculture-biologique",
    actif: true,
    cumulAB: true,
    abCompatible: true,
    echeance: "Déclaration des revenus / IS (calendrier annuel)",
    piecesAFournir: [
      "Attestation de certification AB",
      "Bilan / compte de résultat justifiant les 40 % CA AB",
      "Formulaire fiscal n°2079-BIO-SD",
    ],
  },

  // Source : FranceAgriMer (Plan Bio + Plan Ambition Bio).
  {
    id: "plan-bio-fam",
    nom: "Plan Bio FranceAgriMer",
    organisme: "FranceAgriMer (Ministère de l'Agriculture)",
    niveau: "national",
    typesEligibles: ["verger", "maraichage", "polyculture"],
    publicCible: "agriculteurs",
    description:
      "Appels à projets spécifiques filière bio : structuration aval (transformation, logistique, conditionnement), promotion, innovation, soutien à la conversion sur filières prioritaires (céréales, fruits, légumes).",
    conditions: [
      "Filière bio ou conversion engagée",
      "Projet collectif ou structurant",
      "Dossier sur portail FranceAgriMer",
    ],
    tauxAide: "30 à 80 % selon appel à projets",
    url: "https://www.franceagrimer.fr/Accompagner/Plan-de-souverainete-Fruits-et-Legumes",
    actif: true,
    cumulAB: true,
    abCompatible: true,
    echeance: "Appels à projets ponctuels — consulter le site FAM",
    piecesAFournir: ["Mémoire technique", "Budget prévisionnel", "Statut juridique"],
  },

  // Source : Règlement (UE) 2021/2115 (PAC 2023-2027) — éco-régime (BCAE).
  // 3 niveaux : standard / supérieur / spécifique AB.
  {
    id: "eco-regime-pac",
    nom: "Éco-régime PAC (1er pilier)",
    organisme: "DDT(M) — Ministère de l'Agriculture",
    niveau: "europeen",
    typesEligibles: ["verger", "maraichage", "agroforesterie", "polyculture", "haie"],
    publicCible: "agriculteurs",
    description:
      "Paiement annuel à l'hectare au titre du 1er pilier de la PAC, conditionné au respect de pratiques bénéfiques pour l'environnement. 3 voies d'accès : pratiques (couverture sols, diversification), certification (AB, HVE), infrastructures agro-écologiques (IAE).",
    conditions: [
      "Voie certification : engagement AB ou HVE3",
      "Voie pratiques : couverture des sols intermédiaire, diversification cultures",
      "Voie IAE : > 7 % de surface en éléments favorables à la biodiversité",
      "Déclaration PAC (TéléPAC)",
    ],
    tauxAide: "Niveau base : ~ 60 €/ha — Niveau supérieur : ~ 82 €/ha — Spécifique AB : ~ 110 €/ha",
    url: "https://agriculture.gouv.fr/leco-regime-de-la-pac-2023-2027",
    actif: true,
    cumulAB: true,
    abCompatible: true,
    echeance: "PAC — TéléPAC, avant 15 mai chaque année",
    piecesAFournir: ["Déclaration PAC", "Certificat AB ou HVE3 (voie certification)"],
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
