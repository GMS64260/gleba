/**
 * Périmètre de « Effacer toutes mes données » (RGPD MC6, phase 1 : cadrage).
 *
 * Source de vérité unique : chaque modèle Prisma y est classé une fois. La
 * phase 2 (route `DELETE /api/user/delete-data`, écran Paramètres, page
 * `/suppression-compte`, sauvegarde) lira cette table au lieu de tenir sa
 * propre liste. Le document `docs/rgpd-perimetre-effacement.md` en est généré
 * (`npx tsx scripts/rgpd/generer-perimetre-effacement.ts`) et un test vérifie
 * qu'il reste identique.
 *
 * Le geste visé garde le compte : il vide les données d'exploitation. Les
 * données du compte lui-même et les contributions communautaires suivent le
 * compte (elles sont classées « conserver », base : exécution du contrat).
 *
 * Règle de prudence : « conserver » exige une base citée (texte + article) et
 * une durée. Sans texte vérifiable, le modèle est proposé « effacer » et la
 * question est posée à Guillaume (`aValider`) : rien n'est inventé.
 *
 * Module pur (aucun import Prisma) : importable par l'écran en phase 2.
 *
 * Schéma complet et schéma public : la table classe les 181 modèles du schéma
 * complet. Dix-neuf d'entre eux (caisse sécurisée, stock physique :
 * `MODELES_ZONE_PRIVEE`) n'existent que dans la zone privée et manquent au
 * schéma public (162 modèles). Le contrôle accepte leur absence seulement
 * quand elle est totale (schéma public) ; une absence partielle reste une
 * anomalie. Le document est le même dans les deux dépôts (livraison du
 * 2026-11-16 : ce module, son test et le document sont publiés).
 */

export type CategorieEffacement = 'effacer' | 'conserver' | 'anonymiser' | 'hors_perimetre'

/** `proprietaire` : ligne portant le tenant ; `parent` : rattachée par clé à
 *  un modèle qui le porte ; `instance` : référentiel ou système partagé ;
 *  `cle` : table technique sans colonne tenant dont certaines lignes sont
 *  propres au compte par le préfixe de leur clé (cache mixte). */
export type Rattachement = 'proprietaire' | 'parent' | 'instance' | 'cle'

export type DomaineEffacement =
  | 'compte'
  | 'support'
  | 'communaute'
  | 'terrain'
  | 'maraichage'
  | 'verger'
  | 'phyto'
  | 'elevage'
  | 'stocks'
  | 'commerce'
  | 'comptabilite'
  | 'banque'
  | 'boutique'
  | 'caisse'
  | 'assistant'
  | 'capteurs'
  | 'referentiel'
  | 'systeme'

export interface BaseLegale {
  texte: string
  article: string
  lien: string
  /** Ce que la base impose ou permet, en une phrase. */
  objet: string
  /** Vérification du texte à la date du cadrage. */
  verification: string
}

const LU_LE = 'Texte lu sur Légifrance le 2026-11-15.'
const NON_RELU = 'Article non relu le 2026-11-15 (page Légifrance tronquée) : durée reprise des notes du projet et de la politique de confidentialité, à confirmer.'
const RELU_ADV = 'Non relu par le développeur (Légifrance refuse l’accès automatisé) ; article relu par la contre-revue du 2026-11-15 (revue-adv-167), durée confirmée.'
const RELU_REVUES = 'Non relu par le développeur (Légifrance refuse l’accès automatisé) ; relu par les revues QA et adverse du 2026-11-15 (revue-qa-166, revue-adv-167).'

export const BASES_LEGALES = {
  COM_L123_22: {
    texte: 'Code de commerce',
    article: 'art. L123-22, al. 2',
    lien: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006219327',
    objet: 'Documents comptables et pièces justificatives conservés dix ans.',
    verification: RELU_ADV,
  },
  LPF_L102B: {
    texte: 'Livre des procédures fiscales',
    article: 'art. L102 B, I',
    lien: 'https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006069583',
    objet: 'Livres, registres, documents et pièces conservés six ans (droit de contrôle fiscal).',
    verification: RELU_ADV,
  },
  CGI_286_I_3BIS: {
    texte: 'Code général des impôts',
    article: 'art. 286, I, 3° bis',
    lien: 'https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006069577',
    objet: 'Logiciel de caisse : inaltérabilité, sécurisation, conservation et archivage des données.',
    verification: NON_RELU,
  },
  BOI_TVA_DECLA_30_10_30: {
    texte: 'BOFiP, BOI-TVA-DECLA-30-10-30',
    article: '§ 155 et § 250 (cités par `src/lib/caisse/conservation.ts`)',
    lien: 'https://bofip.impots.gouv.fr/bofip/10691-PGP.html',
    objet: 'Doctrine : conservation et archivage des données de caisse sur la durée du LPF.',
    verification: 'Non relu le 2026-11-15 : repris du commentaire de `src/lib/caisse/conservation.ts` et de Gleba-caisse-marche (audit ISCA du 2026-11-12).',
  },
  ARRETE_REGISTRE_ELEVAGE: {
    texte: 'Arrêté du 5 juin 2000 relatif au registre d’élevage (NOR AGRG0001128A)',
    article: 'art. 3 à 9 (contenu) et art. 11 (conservation)',
    lien: 'https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000006609266',
    objet: 'Registre (exploitation, encadrement, mouvements, soins, interventions vétérinaires et analyses diagnostiques ou sanitaires (art. 7, 1°), équarrissage, aliments) conservé au moins cinq ans suivant l’année de la dernière information enregistrée ; volailles : trois ans hors ordonnances.',
    verification: `${LU_LE} Art. 7, 1° (analyses) : ${RELU_REVUES}`,
  },
  ARRETE_REGISTRE_ELEVAGE_ANNEXE_I: {
    texte: 'Arrêté du 5 juin 2000 relatif au registre d’élevage (NOR AGRG0001128A)',
    article: 'annexe I, points 6 et 8 (bandes de volailles) et art. 11 (conservation)',
    lien: 'https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000037332816',
    objet: 'Pour les bandes de volailles, le registre porte les performances zootechniques et les quantités d’aliments consommées par type d’aliment ; conservation de l’art. 11.',
    verification: RELU_REVUES,
  },
  UE_2019_6_ART108: {
    texte: 'Règlement (UE) 2019/6 relatif aux médicaments vétérinaires',
    article: 'art. 108',
    lien: 'https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32019R0006',
    objet: 'Détenteurs d’animaux producteurs de denrées : enregistrements des médicaments acquis, détenus et administrés, tenus à disposition au moins cinq ans, sans exception pour les volailles.',
    verification: 'EUR-Lex inaccessible au développeur le 2026-11-15 ; art. 108, § 1 à 5, relu par les revues QA et adverse du 2026-11-15 dans la publication officielle du JOUE reprise par le BOE (https://www.boe.es/buscar/doc.php?id=DOUE-L-2019-80010#art108) : cinq ans, sans exception volailles.',
  },
  ARRETE_PHYTO_20251224: {
    texte: 'Arrêté du 24 décembre 2025 relatif à la tenue des registres d’utilisation des produits phytopharmaceutiques et de leurs adjuvants (NOR AGRG2536515A)',
    article: 'art. 3',
    lien: 'https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000053322873',
    objet: 'Informations du registre conservées au moins cinq ans après leur enregistrement.',
    verification: LU_LE,
  },
  RGPD_6_1_B: {
    texte: 'Règlement (UE) 2016/679 (RGPD)',
    article: 'art. 6, 1, b',
    lien: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=fr',
    objet: 'Exécution du contrat : le compte subsiste après ce geste, ses données le suivent jusqu’à la suppression du compte.',
    verification: 'Base de licéité, pas une obligation de conservation.',
  },
  RGPD_6_1_F: {
    texte: 'Règlement (UE) 2016/679 (RGPD)',
    article: 'art. 6, 1, f',
    lien: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=fr',
    objet: 'Intérêt légitime (sécurité du service, assistance) : durée à proportionner.',
    verification: 'Base de licéité, pas une obligation de conservation.',
  },
  RGPD_7_1: {
    texte: 'Règlement (UE) 2016/679 (RGPD)',
    article: 'art. 7, 1',
    lien: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=fr',
    objet: 'Le responsable doit pouvoir démontrer le consentement recueilli.',
    verification: 'Base de licéité, pas une obligation de conservation.',
  },
} as const satisfies Record<string, BaseLegale>

export type CleBaseLegale = keyof typeof BASES_LEGALES

export interface ClassementModele {
  domaine: DomaineEffacement
  categorie: CategorieEffacement
  rattachement: Rattachement
  /** Modèle porteur du tenant, pour `rattachement: 'parent'`. */
  parent?: string
  /** Pourquoi cette catégorie. */
  motif: string
  /** Portée partielle ou contrainte de mise en œuvre (phase 2). */
  condition?: string
  /** Obligatoire pour « conserver ». */
  duree?: string
  /** Obligatoire pour « conserver ». */
  bases?: readonly CleBaseLegale[]
  /** Fichiers hors base rattachés au modèle. */
  fichiers?: string
  /** Question ouverte pour Guillaume : la catégorie n'est qu'une proposition. */
  aValider?: string
}

// ─── Durées et bases partagées ─────────────────────────────────────────────

const COMPTE = {
  categorie: 'conserver',
  rattachement: 'proprietaire',
  duree: 'Tant que le compte existe ; effacé à la suppression du compte.',
  bases: ['RGPD_6_1_B'],
} as const

const COMPTA = {
  categorie: 'conserver',
  rattachement: 'proprietaire',
  duree: 'Dix ans à compter de la clôture de l’exercice (C. com.) ; six ans au titre du contrôle fiscal (LPF), absorbés par les dix ans.',
  bases: ['COM_L123_22', 'LPF_L102B'],
} as const

const CAISSE = {
  domaine: 'caisse',
  categorie: 'conserver',
  rattachement: 'proprietaire',
  duree: 'Six ans après le dernier fait de caisse réel (règle déjà appliquée par `refusConservationCaisse`).',
  bases: ['CGI_286_I_3BIS', 'LPF_L102B', 'BOI_TVA_DECLA_30_10_30'],
  condition: 'Faits réels seulement ; les données d’entraînement sont purgées (`caisse_purger_entrainement`). Clés `ON DELETE RESTRICT` vers `users`.',
} as const

// Deux obligations distinctes : l'arrêté du 5 juin 2000 (registre général,
// exception de trois ans pour les volailles hors ordonnances, art. 11) et le
// règlement (UE) 2019/6 (enregistrements médicamenteux, cinq ans sans
// exception volailles, art. 108). Une donnée soumise aux deux suit la plus
// longue échéance : l'exception volailles ne s'applique jamais à elle.
export const DUREE_REGISTRE_ELEVAGE = 'Cinq ans suivant l’année de la dernière information enregistrée (art. 11) ; bande de volailles : trois ans hors ordonnances. Une ligne nécessaire pour lire un enregistrement médicamenteux (animal ou lot traité) suit la durée médicamenteuse, plus longue pour les volailles.'
export const DUREE_MEDICAMENTS_ELEVAGE = 'Cinq ans au moins suivant l’année de la dernière information enregistrée, toutes espèces, volailles comprises (règl. 2019/6, art. 108, et arrêté du 5 juin 2000, art. 11 : la plus longue échéance s’applique).'

const REGISTRE_ELEVAGE = {
  domaine: 'elevage',
  categorie: 'conserver',
  rattachement: 'proprietaire',
  duree: DUREE_REGISTRE_ELEVAGE,
  bases: ['ARRETE_REGISTRE_ELEVAGE'],
} as const

const MEDICAMENTS_ELEVAGE = {
  ...REGISTRE_ELEVAGE,
  duree: DUREE_MEDICAMENTS_ELEVAGE,
  bases: ['ARRETE_REGISTRE_ELEVAGE', 'UE_2019_6_ART108'],
} as const

/** Mesures datées d'une bande de volailles (annexe I, points 6 et 8). */
const MESURE_BANDE = {
  ...REGISTRE_ELEVAGE,
  duree: 'Trois ans suivant l’année de la dernière information enregistrée pour une bande de volailles (art. 11) ; mesure conservée par prudence (espèce indéterminée) : cinq ans, durée générale.',
  bases: ['ARRETE_REGISTRE_ELEVAGE_ANNEXE_I'],
} as const
const PERIMETRE_BANDE = 'Conservation conditionnelle : seules les mesures d’une bande de volailles (lot ou animal dont l’espèce relève des volailles : `type = volaille` ou catégorie réglementaire « volaille… ») sont conservées. Espèce inconnue, mesure sans lot ni animal (référence mise à nul) : conservée par prudence, son rattachement à une bande ne peut être exclu. Les mesures d’autres espèces sont effacées.'

const PHYTO = {
  domaine: 'phyto',
  categorie: 'conserver',
  rattachement: 'proprietaire',
  duree: 'Cinq ans au moins après l’enregistrement.',
  bases: ['ARRETE_PHYTO_20251224'],
} as const

const COMMUNAUTE = {
  ...COMPTE,
  domaine: 'communaute',
  aValider: 'Contributions communautaires : ce geste vide l’exploitation et laisse le compte ; faut-il aussi y effacer forum, avis, propositions et référentiels privés ? (la page Paramètres annonce « Les référentiels sont conservés »)',
} as const

const LIEN_LIVRAISON = 'Une ligne référencée par un mouvement de livraison (`MouvementStockCommercial`, clé NO ACTION) ne peut pas partir tant que la pièce est conservée : la route actuelle refuse alors tout l’effacement (409).'
const QUESTION_TRACABILITE = 'Traçabilité alimentaire (règl. (CE) 178/2002, art. 18, sans durée fixée par le texte) : faut-il conserver les lots livrés à des professionnels au-delà de la pièce comptable, et combien de temps ?'
const SANS_CLE = 'Porte `user_id` sans clé étrangère : aucune cascade ne l’emporte (déjà traité à la suppression du compte par `supprimerDonneesSansCleEtrangere`).'

const instance = (domaine: DomaineEffacement, motif: string, extra: Partial<ClassementModele> = {}): ClassementModele => ({
  domaine, categorie: 'hors_perimetre', rattachement: 'instance', motif, ...extra,
})
const effacer = (domaine: DomaineEffacement, motif: string, extra: Partial<ClassementModele> = {}): ClassementModele => ({
  domaine, categorie: 'effacer', rattachement: 'proprietaire', motif, ...extra,
})

// ─── Classification : un modèle Prisma par clé ─────────────────────────────

export const PERIMETRE_EFFACEMENT = {
  // Compte (le geste garde le compte)
  User: { ...COMPTE, domaine: 'compte', motif: 'Le compte lui-même : ce geste le garde.', condition: 'Champs d’exploitation éventuels sur la ligne (aucun identifié) à revoir en phase 2.' },
  MembreExploitation: { ...COMPTE, domaine: 'compte', motif: 'Accès des membres invités à l’exploitation.', aValider: 'Vider les données doit-il aussi retirer les membres invités et les invitations en cours ?' },
  PushSubscription: { ...COMPTE, domaine: 'compte', motif: 'Abonnement aux notifications du navigateur.' },
  CookieConsent: { ...COMPTE, domaine: 'compte', bases: ['RGPD_7_1'], duree: 'Treize mois au plus (politique de confidentialité, § 6).', motif: 'Preuve du consentement aux cookies.' },
  LoginLog: { ...COMPTE, domaine: 'compte', bases: ['RGPD_6_1_F'], duree: 'Douze mois (politique de confidentialité, § 6).', motif: 'Journal de connexion (sécurité).', aValider: '`/suppression-compte` présente les douze mois comme « imposés par la réglementation » : quel texte ? Sans texte, la base est l’intérêt légitime.' },
  ImpersonationGrant: { ...COMPTE, domaine: 'compte', bases: ['RGPD_6_1_F'], duree: 'Proposée : tant que l’accès est en cours, puis douze mois après sa fin, comme le journal de connexion (même finalité de sécurité, intérêt légitime) ; effacé à la suppression du compte.', motif: 'Audit des accès administrateur au compte (`targetId`, sans clé étrangère).', aValider: 'Durée proposée pour l’audit des accès administrateur : douze mois après la fin de l’accès, alignée sur le journal de connexion. La valider ou en fixer une autre.' },
  ActivityDay: { ...COMPTE, domaine: 'compte', bases: ['RGPD_6_1_F'], motif: 'Jours d’activité du compte (pilotage du service).' },
  Session: { ...COMPTE, domaine: 'compte', motif: 'Session Auth.js.' },
  Account: { ...COMPTE, domaine: 'compte', motif: 'Liaison de connexion externe (Auth.js).' },
  UserPreference: { ...COMPTE, domaine: 'compte', motif: 'Préférences d’interface du compte.', aValider: 'Certaines préférences décrivent l’exploitation (modules actifs, unités) : les remettre à zéro avec les données ?' },
  Exploitation: { ...COMPTE, domaine: 'compte', bases: ['RGPD_6_1_B', 'COM_L123_22'], motif: 'Identité légale de l’émetteur (factures, FEC, registres).', condition: 'Reste nécessaire tant que des pièces comptables, de caisse ou des registres sont conservés.' },
  AbonnementGleba: { ...COMPTE, domaine: 'compte', motif: 'Contrat du service Gleba avec le producteur.' },

  // Support et retours (suivent le compte)
  FeedbackToken: { ...COMPTE, domaine: 'support', bases: ['RGPD_6_1_F'], motif: 'Lien de retour adressé au compte.' },
  FeedbackResponse: { ...COMPTE, domaine: 'support', bases: ['RGPD_6_1_F'], motif: 'Réponse au questionnaire de retour.' },
  GrowthCampaignContact: { ...COMPTE, domaine: 'support', bases: ['RGPD_6_1_F'], motif: 'Journal anti-doublon des envois (sans courriel ni contenu).' },
  BugReport: { ...COMPTE, domaine: 'support', bases: ['RGPD_6_1_F'], motif: 'Signalements envoyés par le widget (assistance).' },
  BugStatusLog: { ...COMPTE, domaine: 'support', rattachement: 'parent', parent: 'BugReport', bases: ['RGPD_6_1_F'], motif: 'Historique de statut d’un signalement (`changedBy` = administrateur, SET NULL).' },

  // Communauté et référentiels contribués (suivent le compte)
  Espece: { ...COMMUNAUTE, motif: 'Entrées de référentiel créées par le compte (`userId` nul = référentiel officiel).', condition: 'À la suppression du compte : privées effacées, partagées reprises par « Communauté Gleba » (`reprendreReferentielCommunaute`).' },
  PorteGreffe: { ...COMMUNAUTE, motif: 'Entrées de référentiel créées par le compte.', condition: 'Même reprise communautaire que les espèces.' },
  EssenceBocagere: { ...COMMUNAUTE, motif: 'Entrées de référentiel créées par le compte.', condition: 'Même reprise communautaire que les espèces.' },
  EssenceForestiere: { ...COMMUNAUTE, motif: 'Entrées de référentiel créées par le compte.', condition: 'Même reprise communautaire que les espèces.' },
  Variete: { ...COMMUNAUTE, motif: 'Entrées de référentiel créées par le compte.', condition: 'Même reprise communautaire que les espèces.' },
  ITP: { ...COMMUNAUTE, motif: 'Itinéraires techniques créés par le compte.', condition: 'Même reprise communautaire que les espèces.' },
  EspeceAnimale: { ...COMMUNAUTE, motif: 'Entrées de référentiel animal créées par le compte.', condition: 'Même reprise communautaire que les espèces.' },
  RaceAnimale: { ...COMMUNAUTE, motif: 'Races créées par le compte.', condition: 'Même reprise communautaire que les espèces.' },
  MediaReferentiel: { ...COMMUNAUTE, motif: 'Médias proposés au référentiel (`contributeur` SET NULL).', fichiers: '`public/uploads/referentiel/…` (dossier partagé, pas par compte).' },
  Avis: { ...COMMUNAUTE, motif: 'Avis publiés sur des fiches du référentiel.' },
  PhotoAvis: { ...COMMUNAUTE, rattachement: 'parent', parent: 'Avis', motif: 'Photos d’un avis ou d’un témoignage (octets en base).', condition: 'Celles d’un `TemoignageRecolte` partent avec lui (cascade).' },
  Signalement: { ...COMMUNAUTE, motif: 'Signalements de contenus communautaires.' },
  Evolution: { ...COMMUNAUTE, motif: 'Demandes d’évolution publiées.' },
  EvolutionVote: { ...COMMUNAUTE, motif: 'Votes sur les demandes d’évolution.' },
  ContributionEncyclopedie: { ...COMMUNAUTE, motif: 'Propositions documentaires.' },
  RevisionEncyclopedie: { ...COMMUNAUTE, motif: 'Versions publiées (`author` SET NULL : signature « Ancien membre » à la suppression du compte).' },
  DiscussionEncyclopedie: { ...COMMUNAUTE, motif: 'Sujets du forum des fiches.' },
  ReponseEncyclopedie: { ...COMMUNAUTE, motif: 'Réponses du forum des fiches.' },

  // Terrain et maraîchage
  Planche: effacer('terrain', 'Planches de culture.', { aValider: 'Les traitements saisis avant le figeage C4 relisent culture, planche et parcelle sur les fiches courantes : effacer ces fiches appauvrit le registre phyto conservé. Conserver les fiches référencées par un traitement conservé ?' }),
  FondPlan: effacer('terrain', 'Fond de plan du jardin.', { fichiers: '`storage/plan-fonds/<userId>/`' }),
  ParcelleGeo: effacer('terrain', 'Parcelles géoréférencées.', { condition: 'Référencée par `Intervention`/`ObservationSante` en SET NULL : la localisation figée (`localisationRegistre`) reste sur le traitement.', aValider: 'Même question que `Planche` pour les traitements antérieurs au figeage C4.' }),
  ObjetJardin: effacer('terrain', 'Objets du plan (allées, serres…).'),
  Note: effacer('terrain', 'Notes générales.'),
  AnalyseSol: effacer('maraichage', 'Analyses de sol.'),
  Culture: effacer('maraichage', 'Cultures (semis, plantations).', { aValider: 'Même question que `Planche` pour les traitements antérieurs au figeage C4.' }),
  Recolte: effacer('maraichage', 'Récoltes.', { condition: LIEN_LIVRAISON, aValider: QUESTION_TRACABILITE }),
  IrrigationPlanifiee: effacer('maraichage', 'Irrigations planifiées.'),
  Consommation: effacer('maraichage', 'Sorties de stock internes.'),
  Fertilisation: effacer('maraichage', 'Apports de fertilisants.', { aValider: 'Zones vulnérables (directive nitrates) : le cahier d’enregistrement des pratiques de fertilisation impose-t-il une conservation à Gleba ? Texte et durée à fournir, sinon effacer.' }),

  // Verger
  Arbre: effacer('verger', 'Arbres et arbustes.', { condition: '`OperationArbre` et `ObservationSante` partent en CASCADE avec l’arbre : un arbre portant un traitement conservé doit rester.' }),
  LotArbres: effacer('verger', 'Groupes d’arbres suivis par effectif.'),
  RecolteArbre: effacer('verger', 'Récoltes du verger.', { condition: LIEN_LIVRAISON, aValider: QUESTION_TRACABILITE }),
  ProductionBois: effacer('verger', 'Production de bois.', { condition: LIEN_LIVRAISON }),
  ZoneVerger: effacer('verger', 'Zones de verger.'),
  PollinisationArbre: effacer('verger', 'Compatibilités de pollinisation entre arbres du compte.', { rattachement: 'parent', parent: 'Arbre' }),
  CampagnePlantation: effacer('verger', 'Campagnes de plantation.'),
  EtapeCampagne: effacer('verger', 'Étapes de campagne.'),
  ObservationCampagne: effacer('verger', 'Observations de campagne.'),
  SequenceLotVerger: effacer('verger', 'Compteur de numéros de lots du verger.', { condition: 'Garder le compteur tant qu’un lot numéroté est conservé (numéro non réutilisable).' }),

  // Registre phytopharmaceutique
  Intervention: { ...PHYTO, motif: 'Traitements phytopharmaceutiques réalisés (registre).', condition: 'Seuls les traitements réalisés relèvent du registre ; les autres interventions (travaux, prévisions) sont effacées.' },
  OperationArbre: { ...PHYTO, motif: 'Traitements réalisés sur les arbres (registre).', condition: 'Seuls les traitements réalisés ; les autres opérations sont effacées. CASCADE depuis `Arbre`.' },
  ObservationSante: { ...PHYTO, motif: 'Observations de santé portant un traitement réalisé (registre).', condition: 'Seules celles qui portent un traitement ; les autres sont effacées. CASCADE depuis `Arbre`.', fichiers: '`photoUrl` sous `public/uploads/<userId>/`.' },
  RegistrePhytoHistorique: { ...PHYTO, motif: 'Historique en ajout seul des traitements modifiés ou supprimés.' },

  // Élevage : registre d'élevage
  Animal: { ...REGISTRE_ELEVAGE, motif: 'Identification, entrées et sorties des animaux (art. 6).', fichiers: 'Photos éventuelles sous `public/uploads/<userId>/`.' },
  LotAnimaux: { ...REGISTRE_ELEVAGE, motif: 'Groupes d’animaux auxquels se rattachent mouvements et soins (art. 6 et 7).' },
  HistoriqueLotAnimal: { ...MEDICAMENTS_ELEVAGE, motif: 'Composition d’un lot à la date d’un soin ou d’un mouvement : identifie les animaux traités.', condition: SANS_CLE },
  NaissanceAnimale: { ...REGISTRE_ELEVAGE, motif: 'Naissances (art. 6).' },
  PetitNaissance: { ...REGISTRE_ELEVAGE, motif: 'Détail des petits d’une naissance (art. 6).' },
  Abattage: { ...REGISTRE_ELEVAGE, motif: 'Sorties par abattage, dont abattage à la ferme (art. 6).', condition: 'Son miroir comptable (`VenteManuelle`, `sourceType = abattage`) est conservé à part : l’effacement d’une source ne doit pas supprimer le miroir.' },
  SoinAnimal: { ...MEDICAMENTS_ELEVAGE, motif: 'Soins et médicaments administrés (art. 7 et 9).' },
  InjectionSoin: { ...MEDICAMENTS_ELEVAGE, motif: 'Administrations d’un soin en plusieurs injections.' },
  AnnulationSoinAnimal: { ...MEDICAMENTS_ELEVAGE, motif: 'Trace en ajout seul d’un soin administré annulé.' },
  ProphylaxieElevage: { ...MEDICAMENTS_ELEVAGE, motif: 'Prophylaxies, vaccinations, dépistages et visites réglementaires (art. 7 et 9) : une vaccination est une administration de médicament.', condition: SANS_CLE },
  StockMedicamentElevage: { ...MEDICAMENTS_ELEVAGE, bases: ['UE_2019_6_ART108'], motif: 'Médicaments acquis et détenus (lots de la pharmacie).' },
  JustificatifAlimentElevage: { ...REGISTRE_ELEVAGE, motif: 'Étiquettes et bons de livraison des aliments (art. 7).', fichiers: '`storage/justificatifs/<userId>/`' },
  JustificatifEquarrissageElevage: { ...REGISTRE_ELEVAGE, motif: 'Bons d’enlèvement de l’équarrissage (art. 6).', fichiers: '`storage/justificatifs/<userId>/`' },
  JustificatifEquarrissageAnimal: { ...REGISTRE_ELEVAGE, rattachement: 'parent', parent: 'JustificatifEquarrissageElevage', motif: 'Animaux couverts par un bon d’équarrissage.' },
  ArchiveRegistreElevage: { ...MEDICAMENTS_ELEVAGE, motif: 'Archives figées du registre avec manifeste et empreintes.', condition: 'Une archive peut contenir des soins et des médicaments : elle suit la plus longue échéance des données qu’elle contient, jamais l’exception volailles de trois ans.', fichiers: '`storage/registres/<userId>/`' },
  LieuDetentionElevage: { ...REGISTRE_ELEVAGE, rattachement: 'parent', parent: 'Exploitation', motif: 'Lieux de détention de la fiche d’exploitation (art. 4).' },
  IntervenantElevage: { ...REGISTRE_ELEVAGE, rattachement: 'parent', parent: 'Exploitation', motif: 'Encadrement zootechnique et sanitaire, vétérinaires (art. 5).' },

  // Élevage : le reste
  VenteProduit: effacer('elevage', 'Ventes de produits animaux.', { condition: 'Le miroir comptable (`VenteManuelle`, `sourceType = vente_produit`) est conservé à part. Les sorties d’animaux vivants restent au registre par `Animal`.', aValider: 'Une vente d’animaux vivants est une sortie du registre (art. 6) : la conserver comme pièce du registre plutôt que par la seule fiche `Animal` ?' }),
  ProductionOeuf: { ...MESURE_BANDE, motif: 'Pontes : performance zootechnique d’une bande de pondeuses (annexe I, point 6).', condition: `${PERIMETRE_BANDE} ${LIEN_LIVRAISON}` },
  MouvementStockOeuf: effacer('elevage', 'Sorties de lots de ponte.', { condition: LIEN_LIVRAISON }),
  ProductionRuche: effacer('elevage', 'Récoltes de la ruche.', { condition: LIEN_LIVRAISON }),
  MouvementStockRuche: effacer('elevage', 'Sorties des produits de la ruche.', { condition: LIEN_LIVRAISON }),
  ConsommationAliment: { ...MESURE_BANDE, motif: 'Consommations d’aliments : quantités par type d’aliment d’une bande de volailles (annexe I, point 8).', condition: `${PERIMETRE_BANDE} L’aliment référencé (\`Aliment\`, clé RESTRICT) est gardé tant qu’une consommation conservée le cite.` },
  SequenceLotFromage: effacer('elevage', 'Compteur de numéros de lots de fromage.', { condition: 'Garder le compteur tant qu’un lot numéroté est conservé.' }),
  MaladieElevage: effacer('elevage', 'Maladies personnalisées du compte (`userId` nul = référentiel officiel, hors périmètre).', { condition: 'Une maladie citée par un statut sanitaire conservé (`StatutSanitaireElevage`, clé RESTRICT) est gardée avec lui jusqu’à son échéance.' }),
  StatutSanitaireElevage: { ...REGISTRE_ELEVAGE, motif: 'Résultat d’un contrôle sanitaire (statut, date, laboratoire, numéro d’analyse) : analyse diagnostique ou sanitaire du registre (art. 7, 1°). La saisie n’en crée aucune copie dans un soin, une prophylaxie ou une archive : cette ligne peut être la seule trace du résultat.', condition: 'Conservation conditionnelle : toute ligne portant un résultat (statut autre que « inconnu », date de contrôle, laboratoire ou numéro d’analyse) est conservée ; une ligne « inconnu » sans aucune de ces données est effacée. Aucune copie réglementaire n’est supposée exister ailleurs. La maladie référencée (`MaladieElevage`, clé RESTRICT) est gardée tant qu’un statut conservé la cite. Clés CASCADE depuis `Animal` et `LotAnimaux`, eux-mêmes conservés.' },
  TacheTerrainElevage: effacer('elevage', 'Modèles de tâches de tournée.', { condition: SANS_CLE }),
  RealisationTacheElevage: effacer('elevage', 'Acquittements de tâches de tournée.', { condition: SANS_CLE }),
  ReservationElevage: effacer('elevage', 'Réservations avec coordonnées des acquéreurs.', { condition: SANS_CLE }),
  TestSanteElevage: { ...REGISTRE_ELEVAGE, motif: 'Tests de santé et génétiques des reproducteurs (résultat, laboratoire, référence) : analyse diagnostique ou sanitaire (art. 7, 1°).', condition: `Conservation conditionnelle : tout test portant un résultat, un laboratoire ou une référence est conservé, quelle que soit la filière de l’animal (la route accepte tout animal du tenant) ; un test vide est effacé. Aucune copie réglementaire n’est supposée exister ailleurs. ${SANS_CLE}`, aValider: 'Les tests génétiques et de dépistage des animaux de compagnie (dysplasie, ADN) relèvent-ils d’un registre à conserver ? Proposé : conservés comme les autres, faute de texte qui les exclue.' },
  PedigreeElevage: effacer('elevage', 'Pedigrees.', { condition: SANS_CLE }),
  PlanRation: effacer('elevage', 'Plans de ration.', { condition: SANS_CLE }),
  Pesee: { ...MESURE_BANDE, motif: 'Pesées : mesure de croissance, performance zootechnique d’une bande de volailles (annexe I, point 6).', condition: `${PERIMETRE_BANDE} La pesée ne porte qu’un \`animalId\` : l’espèce se lit sur l’animal. ${SANS_CLE}` },
  MouvementCheptel: effacer('elevage', 'Déplacements entre parcelles (pâturage tournant).', { aValider: 'Les mouvements entre lieux de détention relèvent-ils du registre (art. 6 vise entrées et sorties de l’exploitation) ?' }),
  DeclarationReglementaireSuivi: effacer('elevage', 'Preuve de transmission et instantané d’une déclaration.', { aValider: 'Conserver la preuve des notifications d’identification ? Texte et durée à fournir, sinon effacer.' }),
  DeclarationReglementaireEvenement: effacer('elevage', 'Journal en ajout seul des statuts de déclaration.', { aValider: 'Même question que `DeclarationReglementaireSuivi`.' }),
  PreparationDocumentCirculation: effacer('elevage', 'Préparation d’un document de circulation (ni document officiel ni preuve).'),
  Saillie: effacer('elevage', 'Saillies et inséminations.', { aValider: 'Le schéma décrit un « carnet de saillies exigible en contrôle bovin » : texte et durée ? Sans eux, effacer.' }),
  CampagneReproduction: effacer('elevage', 'Campagnes de reproduction.'),
  CollecteLait: effacer('elevage', 'Collectes de lait.'),
  LotFromage: effacer('elevage', 'Lots de fabrication fromage.', { condition: LIEN_LIVRAISON, aValider: 'Hygiène et traçabilité des lots transformés (paquet hygiène) : durée de conservation exigée ?' }),
  MouvementFromage: effacer('elevage', 'Sorties de cave.', { condition: LIEN_LIVRAISON }),
  LivraisonLait: effacer('elevage', 'Livraisons de lait à un collecteur.'),
  PaieLait: effacer('elevage', 'Relevés de paie du lait.', { aValider: 'Le relevé de paie du collecteur est une pièce justificative de recette : la conserver dix ans comme pièce comptable ?' }),
  ContratElevage: effacer('elevage', 'Contrats commerciaux des productions animales.', { aValider: 'Conserver les contrats commerciaux (prescription, intégration) ? Sans obligation citée, effacer.' }),
  EcheanceAdministrativeElevage: effacer('elevage', 'Échéances déclaratives et aides.'),

  // Stocks
  UserStockVariete: effacer('stocks', 'Stock de semences et plants.'),
  UserStockFertilisant: effacer('stocks', 'Stock de fertilisants.'),
  UserStockAliment: effacer('stocks', 'Stock d’aliments.'),
  UserStockEspece: effacer('stocks', 'Stock de récoltes par espèce.'),
  JournalStockPhysique: effacer('stocks', 'Journal des comptages et variations de stock boutique.', { condition: SANS_CLE, aValider: 'Lié aux ventes de caisse : à conserver avec la caisse réelle (la route actuelle annonce « recettes, stocks et pièces liées ») ?' }),
  MouvementSourceStockRecolte: effacer('stocks', 'Transferts de source d’une récolte (hors boutique / boutique).', { condition: SANS_CLE, aValider: 'Même question que `JournalStockPhysique`.' }),
  CaisseVerrouStockNet: effacer('stocks', 'Ligne de sérialisation du plafond de stock, sans donnée métier.'),

  // Commerce et comptabilité
  Client: { ...COMPTA, domaine: 'commerce', motif: 'Acheteurs mentionnés sur les pièces.', condition: 'Seules les fiches liées à une pièce conservée ; les autres sont effacées. Clé SET NULL depuis les pièces, mais ville, pays et courriel de l’acheteur sont encore relus sur la fiche.', aValider: 'Quand l’instantané acheteur sera complet sur la pièce, effacer toutes les fiches clients ?' },
  Facture: { ...COMPTA, domaine: 'comptabilite', motif: 'Factures, avoirs et acomptes émis.' },
  LigneFacture: { ...COMPTA, domaine: 'comptabilite', rattachement: 'parent', parent: 'Facture', motif: 'Lignes de facture.' },
  SequenceFacture: { ...COMPTA, domaine: 'comptabilite', motif: 'Numérotation continue des pièces (absence de saut).' },
  DocumentCommercial: { ...COMPTA, domaine: 'commerce', motif: 'Bons de livraison et devis acceptés.', condition: 'Devis brouillons, refusés ou expirés : proposés à l’effacement.', aValider: 'Un devis non accepté est-il une pièce à conserver ?' },
  LigneDocumentCommercial: { ...COMPTA, domaine: 'commerce', rattachement: 'parent', parent: 'DocumentCommercial', motif: 'Lignes de devis et de BL.' },
  MouvementStockCommercial: { ...COMPTA, domaine: 'commerce', motif: 'Sorties liées aux BL et factures, et leurs retours.', condition: 'Seuls les mouvements de livraison et leurs retours ; les autres (pertes, usages internes) sont effacés, comme aujourd’hui.' },
  LotTransforme: effacer('commerce', 'Produits transformés issus du verger.', { condition: LIEN_LIVRAISON }),
  EnvoiCommercial: effacer('commerce', 'Traces des envois SMTP de pièces (destinataire, statut).', { aValider: 'Conserver la preuve d’envoi d’une facture avec la facture ?' }),
  VenteManuelle: { ...COMPTA, domaine: 'comptabilite', motif: 'Recettes et miroirs de vente (source du FEC).', fichiers: 'Pièce jointe `pjUrl` sous `storage/justificatifs/<userId>/`.' },
  DepenseManuelle: { ...COMPTA, domaine: 'comptabilite', motif: 'Dépenses et miroirs de dépense (source du FEC).', fichiers: 'Pièce jointe `pjUrl` sous `storage/justificatifs/<userId>/`.' },
  DossierReglement: { ...COMPTA, domaine: 'comptabilite', motif: 'Journal des règlements (justification des encaissements).' },
  CibleReglement: { ...COMPTA, domaine: 'comptabilite', motif: 'Pièces visées par un règlement.' },
  Reglement: { ...COMPTA, domaine: 'comptabilite', motif: 'Règlements reçus ou versés.' },

  // Banque
  CompteBancaire: { ...COMPTA, domaine: 'banque', motif: 'Comptes auxquels se rattachent les opérations conservées.', condition: 'Seulement s’il porte des opérations conservées.' },
  OperationBancaire: { ...COMPTA, domaine: 'banque', motif: 'Lignes de relevés bancaires (pièces justificatives).' },
  VirementBancaire: { ...COMPTA, domaine: 'banque', motif: 'Rapprochement de deux opérations bancaires (virement interne).' },
  TentativeImportReleve: effacer('banque', 'Fichiers de relevés importés, gardés pour l’assistance.', { condition: 'Déjà purgés après trente jours.' }),
  ConnexionStripe: effacer('banque', 'Connexion Stripe du producteur (encaissements boutique).', { condition: 'Révoquer la connexion chez Stripe avant d’effacer la ligne.' }),
  EtatConnexionStripe: effacer('banque', 'État de synchronisation de la connexion Stripe.'),

  // Boutique
  Boutique: effacer('boutique', 'Vitrine publique.', { condition: 'Les commandes conservées partent en CASCADE avec la boutique : la garder (dépubliée) tant qu’une commande est conservée.' }),
  ProduitBoutique: effacer('boutique', 'Produits présentés.', { condition: 'Référencé par les lignes de commande (`produitUnite` NO ACTION) : détacher ou garder la référence des commandes conservées.', fichiers: 'Images sous `public/uploads/<userId>/`.' }),
  CommandeBoutique: { ...COMPTA, domaine: 'boutique', motif: 'Commandes payées ou liées à une vente ou une facture (bons de commande).', condition: 'Les commandes jamais payées ni facturées sont effacées.', aValider: 'Commande en ligne payée : pièce justificative à conserver dix ans, avec les coordonnées complètes de l’acheteur particulier ?' },
  LigneCommandeBoutique: { ...COMPTA, domaine: 'boutique', rattachement: 'parent', parent: 'CommandeBoutique', motif: 'Lignes de commande.' },

  // Caisse sécurisée
  CaisseMarche: { ...CAISSE, motif: 'Marchés et points de vente de la caisse.' },
  CaisseVendeur: { ...CAISSE, motif: 'Vendeurs identifiés dans les faits de caisse.' },
  CaisseRevisionDroits: { ...CAISSE, motif: 'Révisions des droits des vendeurs.' },
  CaisseSession: { ...CAISSE, motif: 'Sessions de caisse.' },
  CaisseAffectation: { ...CAISSE, motif: 'Stocks affectés à une session.' },
  CaisseLot: { ...CAISSE, motif: 'Lots réellement emportés.' },
  CaisseEvenement: { ...CAISSE, motif: 'Journal des événements de vente.' },
  CaisseAutorisationArchivee: { ...CAISSE, motif: 'Autorisations émises.' },
  CaisseReception: { ...CAISSE, motif: 'Faits reçus, même sans vente aboutie.' },
  CaisseOperationReception: { ...CAISSE, motif: 'Journal financier des réceptions.' },
  CaisseAppareil: { ...CAISSE, motif: 'Registre des caisses de l’exploitation.' },
  CaisseRegistre: { ...CAISSE, motif: 'Registre fiscal chaîné et signé.' },
  CaisseCloture: { ...CAISSE, motif: 'Clôtures et grands totaux.' },
  CaisseArchive: { ...CAISSE, motif: 'Archives fiscales.' },
  CaisseAncrage: { ...CAISSE, motif: 'Ancrages de la chaîne signée.' },

  // Assistant IA
  Conversation: effacer('assistant', 'Conversations avec l’assistant (contiennent des données de l’exploitation).', { condition: 'Les sessions du moteur externe ont leur propre purge à trente jours.' }),
  ChatMessage: effacer('assistant', 'Messages d’une conversation.', { rattachement: 'parent', parent: 'Conversation' }),

  // Capteurs et météo
  StationMeteo: effacer('capteurs', 'Stations météo personnelles.'),
  ConnecteurCapteurs: effacer('capteurs', 'Connecteurs de capteurs (jeton haché).'),
  Capteur: effacer('capteurs', 'Capteurs rattachés.'),
  MesureCapteur: effacer('capteurs', 'Mesures brutes.', { rattachement: 'parent', parent: 'Capteur', condition: 'Supprimées par lots avant la transaction (`supprimerMesuresBrutesDuCompte`).' }),
  MesureCapteurJour: effacer('capteurs', 'Agrégats journaliers.', { rattachement: 'parent', parent: 'Capteur' }),

  // Terrain : enfant non classé ailleurs
  // eslint-disable-next-line no-restricted-syntax -- Identifiant technique exact du modèle Prisma parent.
  TemoignageRecolte: effacer('communaute', 'Publication volontaire d’une récolte.', { rattachement: 'parent', parent: 'Recolte', condition: 'Part en CASCADE avec la récolte ou l’avis source.' }),

  // Référentiels et système (sans tenant)
  Famille: instance('referentiel', 'Familles botaniques.'),
  Fournisseur: instance('referentiel', 'Fournisseurs du catalogue partagé (sans propriétaire).', { aValider: 'Table partagée portant IBAN, courriel et téléphone sans propriétaire : qui l’alimente, et doit-elle rester sans tenant ?' }),
  Destination: instance('referentiel', 'Destinations des récoltes.'),
  Fertilisant: instance('referentiel', 'Catalogue des fertilisants.'),
  PorteGreffeEspece: instance('referentiel', 'Jointure porte-greffes ↔ espèces.'),
  Bioagresseur: instance('referentiel', 'Catalogue des bioagresseurs.'),
  BioagresseurEspece: instance('referentiel', 'Jointure bioagresseurs ↔ espèces.'),
  Rotation: instance('referentiel', 'Plans de rotation (sans propriétaire).'),
  RotationDetail: instance('referentiel', 'Années d’un plan de rotation.'),
  Association: instance('referentiel', 'Associations de cultures.'),
  AssociationDetail: instance('referentiel', 'Détails des associations.'),
  Aliment: effacer('elevage', 'Aliments privés du compte (`ownerUserId`) ; le catalogue partagé (`ownerUserId` nul) est hors périmètre.', { condition: 'Clé `ownerUserId` sans relation : un aliment encore consommé (RESTRICT) est laissé, comme à la suppression du compte ; il est gardé tant qu’une consommation conservée (bande de volailles) le cite.' }),
  ProduitVeterinaire: instance('referentiel', 'Catalogue partagé des produits vétérinaires.'),
  ProduitVeterinaireEspece: instance('referentiel', 'Matrice produits vétérinaires ↔ espèces.'),
  ProduitPhyto: instance('referentiel', 'Catalogue partagé des produits phytopharmaceutiques.'),
  Parametre: instance('systeme', 'Réglages de l’instance.'),
  GenericCache: effacer('systeme', 'Cache technique mixte : caches partagés (météo par coordonnées arrondies, Hub’Eau, SoilGrids, alertes du journal d’erreurs) et traces d’envoi des notifications propres au compte.', { rattachement: 'cle', condition: 'Seules les clés `notif:envoyee:<userId>:…` (traces d’envoi d’alertes, qui peuvent citer une planche ou une culture ; expiration à la fin du jour d’alerte, sinon sept jours) sont propres au compte : la phase 2 les sélectionne par ce préfixe et les efface avec les données. Les autres clés sont partagées entre comptes, hors périmètre, et expirent seules (`purgeExpired`).' }),
  MeteoCache: instance('systeme', 'Cache météo par coordonnées.'),
  ApiError: instance('systeme', 'Journal des erreurs serveur (purge vers trente jours).', { aValider: 'Les messages d’erreur peuvent contenir des données saisies : purge à trente jours suffisante ?' }),
  EvenementAbonnement: instance('systeme', 'File des événements Stripe de l’abonnement Gleba.'),
  CaisseCle: instance('caisse', 'Clés publiques de signature du registre (propres à l’instance).'),
} as const satisfies Record<string, ClassementModele>

export type ModeleClasse = keyof typeof PERIMETRE_EFFACEMENT

/**
 * Modèles de la zone privée (caisse sécurisée, stock physique), absents du
 * schéma public. Classés comme les autres ; le contrôle n'accepte leur absence
 * que si AUCUN d'eux n'est dans le schéma (schéma public).
 */
export const MODELES_ZONE_PRIVEE = [
  'JournalStockPhysique', 'MouvementSourceStockRecolte', 'CaisseVerrouStockNet',
  'CaisseMarche', 'CaisseVendeur', 'CaisseRevisionDroits', 'CaisseSession', 'CaisseAffectation', 'CaisseLot',
  'CaisseEvenement', 'CaisseAutorisationArchivee', 'CaisseReception', 'CaisseOperationReception', 'CaisseAppareil',
  'CaisseRegistre', 'CaisseCloture', 'CaisseArchive', 'CaisseAncrage', 'CaisseCle',
] as const

export function estModeleZonePrivee(nom: string): boolean {
  return (MODELES_ZONE_PRIVEE as readonly string[]).includes(nom)
}

/** Vrai si le schéma ne porte aucun modèle de la zone privée (schéma public). */
export function schemaSansZonePrivee(modeles: readonly { name: string }[]): boolean {
  return !modeles.some((m) => estModeleZonePrivee(m.name))
}

// ─── Contrôle contre le schéma (DMMF) ──────────────────────────────────────

/** Sous-ensemble du DMMF Prisma utile au contrôle (pas d'import Prisma ici). */
export interface ChampDmmf {
  name: string
  kind: string
  type: string
  isList?: boolean
  relationFromFields?: readonly string[]
  relationOnDelete?: string
}
export interface ModeleDmmf {
  name: string
  fields: readonly ChampDmmf[]
}

/** Champs scalaires qui portent le tenant (ou un utilisateur) dans le schéma. */
export const CHAMPS_PROPRIETAIRE = ['userId', 'ownerId', 'ownerUserId', 'proprietaireId'] as const

/** Un modèle porte un propriétaire s'il a un champ tenant ou une relation vers `User`. */
export function portePropriete(modele: ModeleDmmf): boolean {
  return modele.fields.some(
    (champ) => (CHAMPS_PROPRIETAIRE as readonly string[]).includes(champ.name) || (champ.kind === 'object' && champ.type === 'User'),
  )
}

/** Une durée qui annonce son absence n'est pas une durée. */
const DUREE_ABSENTE = /^\s*(non fix|à (définir|fixer|préciser)|inconnu|indéterminé)/i

export interface AnomaliePerimetre {
  modele: string
  probleme: string
}

/**
 * Compare la classification au schéma. Vide = exhaustive et cohérente.
 * Échoue si un modèle n'est pas classé, si un classement vise un modèle
 * disparu, si un modèle portant un propriétaire est déclaré hors périmètre, ou
 * si une conservation n'a ni base ni durée. Les modèles de la zone privée
 * peuvent manquer ensemble (schéma public), jamais un par un ; chacun doit
 * rester classé.
 */
export function controlerPerimetre(
  modeles: readonly ModeleDmmf[],
  perimetre: Readonly<Record<string, ClassementModele>> = PERIMETRE_EFFACEMENT,
): AnomaliePerimetre[] {
  const anomalies: AnomaliePerimetre[] = []
  const noms = new Set(modeles.map((m) => m.name))
  const schemaPublic = schemaSansZonePrivee(modeles)
  for (const modele of modeles) {
    const classement = perimetre[modele.name]
    if (!classement) {
      anomalies.push({ modele: modele.name, probleme: portePropriete(modele) ? 'porte un propriétaire et n’est pas classé' : 'n’est pas classé' })
      continue
    }
    if (portePropriete(modele) && (classement.categorie === 'hors_perimetre' || classement.rattachement === 'instance')) {
      anomalies.push({ modele: modele.name, probleme: 'porte un propriétaire mais est déclaré hors périmètre' })
    }
  }
  for (const [nom, classement] of Object.entries(perimetre)) {
    if (!noms.has(nom) && !(schemaPublic && estModeleZonePrivee(nom))) anomalies.push({ modele: nom, probleme: 'classé mais absent du schéma' })
    if (classement.categorie === 'conserver' && (!classement.bases?.length || !classement.duree || DUREE_ABSENTE.test(classement.duree))) {
      anomalies.push({ modele: nom, probleme: 'conservation sans base légale ou sans durée' })
    }
    if (classement.categorie === 'hors_perimetre' && classement.rattachement !== 'instance') {
      anomalies.push({ modele: nom, probleme: 'hors périmètre alors qu’il est rattaché au tenant' })
    }
    if (classement.rattachement === 'parent' && (!classement.parent || !(classement.parent in perimetre))) {
      anomalies.push({ modele: nom, probleme: 'rattaché à un parent inconnu' })
    }
  }
  for (const nom of MODELES_ZONE_PRIVEE) {
    if (!(nom in perimetre)) anomalies.push({ modele: nom, probleme: 'modèle de la zone privée non classé' })
  }
  return anomalies
}
