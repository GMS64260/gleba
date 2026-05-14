/**
 * Donnees de reference agronomiques pour les especes d'arbres fruitiers en France.
 *
 * Sources principales :
 *   - Wikipedia FR (articles agronomiques)
 *   - INRAE / CTIFL (besoins en froid, fiches techniques)
 *   - Chambres d'agriculture (fiches cultures)
 *   - gerbeaud.com, aujardin.info, jardiner-malin.fr
 *   - Yara France (agronomie fruits a noyau / pepins)
 *   - AFIDOL (olivier)
 *   - SENURA (noyer)
 *   - Bio-Provence / ITAB (fiches arbo bio)
 *   - pepinieredesfruitiers.com, promessedefleurs.com
 *
 * Toutes les valeurs numeriques sont des moyennes d'espece ; elles varient
 * fortement selon la variete, le porte-greffe, le sol et le climat local.
 * Les champs marques "null" n'ont pas pu etre trouves de source fiable.
 */

export interface ArbreReferenceData {
  espece: string;                       // Nom commun francais
  nomLatin: string;                     // Nom latin
  type: 'arbre_fruitier' | 'petit_fruit' | 'liane';

  // --- Production ---
  rendementKg: string;                  // kg/arbre adulte (ou kg/m lineaire pour petits fruits)
  distancePlantation: string;           // metres entre arbres
  distanceRangs: string;                // metres entre rangs
  miseFruit: string;                    // annees avant premiere recolte
  dureeVieProductive: string;           // annees

  // --- Climat ---
  besoinEau: string;                    // Faible/Moyen/Eleve + mm/an si connu
  besoinFroidHeures: string;            // heures < 7 degC
  temperatureMin: string;               // degC
  zoneUSDA: string;                     // zone USDA
  exposition: string;                   // Plein soleil, Mi-ombre, etc.

  // --- Sol ---
  phSolOptimal: string;                 // plage de pH
  typeSol: string;                      // description

  // --- Dimensions ---
  hauteurAdulte: string;                // metres
  envergureAdulte: string;              // metres

  // --- Phytosanitaire ---
  maladiesPrincipales: string[];
  ravageursPrincipaux: string[];

  // --- Porte-greffes ---
  porteGreffes: string[];
}

export const ARBRES_REFERENCE: ArbreReferenceData[] = [
  // ============================================================
  // 1. POMMIER
  // ============================================================
  {
    espece: 'Pommier',
    nomLatin: 'Malus domestica',
    type: 'arbre_fruitier',
    rendementKg: '30-60 kg/arbre adulte (haute-tige); 15-30 kg (basse-tige/gobelet)',
    distancePlantation: '3-4 m (gobelet/fuseau) ; 7-10 m (haute-tige)',
    distanceRangs: '4-5 m (intensif) ; 8-10 m (extensif)',
    miseFruit: '2-3 ans (M9/M27) ; 4-6 ans (M106) ; 6-8 ans (franc)',
    dureeVieProductive: '25-30 ans (nanifiant) ; 50 ans (semi-vigoureux) ; 80-100 ans (franc)',
    besoinEau: 'Moyen - 600 mm du debourrement a la chute des feuilles',
    besoinFroidHeures: '800-1600 h (selon variete ; moyenne ~1000 h)',
    temperatureMin: '-30 degC (bois) ; -2 degC (fleurs)',
    zoneUSDA: '3-9 (selon variete)',
    exposition: 'Plein soleil',
    phSolOptimal: '6.0-6.5',
    typeSol: 'Profond, riche en matiere organique, bien draine, consistant. Eviter les sols trop calcaires.',
    hauteurAdulte: '4-7 m (gobelet) ; 8-10 m (haute-tige/franc)',
    envergureAdulte: '4-7 m (gobelet) ; 8-10 m (haute-tige)',
    maladiesPrincipales: [
      'Tavelure (Venturia inaequalis)',
      'Oidium (Podosphaera leucotricha)',
      'Feu bacterien (Erwinia amylovora)',
      'Chancre europeen (Neonectria ditissima)',
      'Moniliose (Monilinia fructigena)',
    ],
    ravageursPrincipaux: [
      'Carpocapse (Cydia pomonella)',
      'Pucerons (cendre, lanigere, vert)',
      'Hoplocampe du pommier',
      'Araignee rouge',
      'Anthonome du pommier',
      'Zeuzere du poirier',
    ],
    porteGreffes: [
      'M9 (nanifiant, mise a fruit rapide 2 ans, hauteur 2-3 m)',
      'M26 (semi-nanifiant, 3-4 m)',
      'M106 (semi-vigoureux, 4-6 m, tolere sols humides)',
      'MM111 (vigoureux, 5-7 m, bonne ancrage)',
      'M25 / Franc (tres vigoureux, 8-10 m, longue duree de vie)',
    ],
  },

  // ============================================================
  // 2. POIRIER
  // ============================================================
  {
    espece: 'Poirier',
    nomLatin: 'Pyrus communis',
    type: 'arbre_fruitier',
    rendementKg: '30-60 kg/arbre adulte (haute-tige) ; 15-30 kg (gobelet)',
    distancePlantation: '4-5 m (cognassier) ; 6-7 m (BA29) ; 8-10 m (franc)',
    distanceRangs: '3.5-4 m (intensif) ; 8-12 m (extensif)',
    miseFruit: '3-4 ans (cognassier) ; 4-5 ans (BA29) ; 6-8 ans (franc)',
    dureeVieProductive: '30-40 ans (cognassier) ; 60-80 ans (franc)',
    besoinEau: 'Moyen a Eleve - 850 mm/an bien repartis',
    besoinFroidHeures: '800-1000 h',
    temperatureMin: '-20 degC (bois) ; -2 a -3 degC (fleurs)',
    zoneUSDA: '4-9',
    exposition: 'Plein soleil, abrite du vent',
    phSolOptimal: '6.0-7.5 (tolere legerement calcaire, pH < 8)',
    typeSol: 'Consistant, argileux, riche, frais mais permeable. Eviter les sols secs et sableux.',
    hauteurAdulte: '5-8 m (gobelet) ; 10-15 m (haute-tige)',
    envergureAdulte: '4-6 m (gobelet) ; 8-10 m (haute-tige)',
    maladiesPrincipales: [
      'Tavelure (Venturia pirina)',
      'Feu bacterien (Erwinia amylovora)',
      'Entomosporiose',
      'Moniliose',
      'Rouille grillagee du poirier',
    ],
    ravageursPrincipaux: [
      'Psylle du poirier (Cacopsylla pyri)',
      'Carpocapse (Cydia pomonella)',
      'Hoplocampe du poirier',
      'Pucerons (cendre, mauve)',
      'Phytopte du poirier',
    ],
    porteGreffes: [
      'Cognassier (faible vigueur, mise a fruit 3-4 ans, 3-5 m)',
      'BA29 - Cognassier de Provence (vigueur moyenne, 4-6 m, tres repandu en pro)',
      'Cognassier d\'Angers (vigueur moderee)',
      'Franc (Pyrus communis) (vigoureux, 8-15 m, longue duree de vie)',
      'OHxF (serie americaine, bonne compatibilite)',
    ],
  },

  // ============================================================
  // 3. CERISIER
  // ============================================================
  {
    espece: 'Cerisier',
    nomLatin: 'Prunus avium (doux) / Prunus cerasus (acide)',
    type: 'arbre_fruitier',
    rendementKg: '50-70 kg/arbre adulte (haute-tige) ; 15-30 kg (gobelet)',
    distancePlantation: '4-5 m (gobelet) ; 6-8 m (demi-tige) ; 8-12 m (haute-tige)',
    distanceRangs: '5-6 m (intensif) ; 8-12 m (extensif)',
    miseFruit: '3-5 ans (Gisela/Colt) ; 6-8 ans (merisier franc)',
    dureeVieProductive: '30-50 ans (porte-greffe nanifiant) ; 60-100 ans (franc)',
    besoinEau: 'Faible a Moyen - 500-600 mm/an ; pas d\'arrosage sauf secheresse',
    besoinFroidHeures: '800-1500 h (selon variete)',
    temperatureMin: '-25 degC (bois) ; -3 degC (fleurs)',
    zoneUSDA: '4-8',
    exposition: 'Plein soleil, abrite des vents froids',
    phSolOptimal: '6.5-7.5 (tolere le calcaire)',
    typeSol: 'Tous sols sauf argileux impermeables. Tolere le calcaire. Bien draine, profond.',
    hauteurAdulte: '6-10 m (haute-tige) ; 3-5 m (gobelet sur Gisela)',
    envergureAdulte: '5-8 m',
    maladiesPrincipales: [
      'Moniliose (Monilinia laxa)',
      'Cylindrosporiose',
      'Chancre bacterien (Pseudomonas syringae)',
      'Gommose',
      'Pourridie',
    ],
    ravageursPrincipaux: [
      'Mouche de la cerise (Rhagoletis cerasi)',
      'Drosophila suzukii',
      'Pucerons noirs du cerisier',
      'Cochenilles',
      'Cossus gate-bois',
    ],
    porteGreffes: [
      'Merisier (Prunus avium) franc - vigoureux, 8-12 m, longue duree de vie',
      'Sainte-Lucie (Prunus mahaleb) - semi-vigoureux, sols secs et calcaires',
      'SL 64 (selection INRA) - semi-vigoureux, tous sols sauf humides',
      'Colt - vigueur moyenne, tolere sols lourds et asphyxie racinaire',
      'Gisela 5/6 - nanifiant, mise a fruit rapide 2-3 ans, 3-4 m',
      'Maxma 14 - semi-nanifiant, bonne adaptation',
    ],
  },

  // ============================================================
  // 4. PRUNIER
  // ============================================================
  {
    espece: 'Prunier',
    nomLatin: 'Prunus domestica',
    type: 'arbre_fruitier',
    rendementKg: '20-60 kg/arbre adulte (haute-tige) ; jusqu\'a 120 kg pour gros sujets',
    distancePlantation: '3-4 m (gobelet) ; 7-8 m (haute-tige)',
    distanceRangs: '4-5 m (intensif) ; 7-8 m (extensif)',
    miseFruit: '3-5 ans (St Julien) ; 6-7 ans (myrobolan)',
    dureeVieProductive: '30-50 ans (demi-tige) ; 60-100 ans (haute-tige)',
    besoinEau: 'Moyen - 500-650 mm/an ; arrosage avant maturation des fruits',
    besoinFroidHeures: '500-800 h',
    temperatureMin: '-17 a -25 degC (bois selon variete) ; -2 degC (fleurs)',
    zoneUSDA: '4-9',
    exposition: 'Plein soleil, abrite du vent',
    phSolOptimal: '5.5-6.5 (legerement acide a neutre)',
    typeSol: 'Riche, profond, bien draine. Tolere sols argileux et calcaires (myrobolan).',
    hauteurAdulte: '4-6 m (gobelet) ; 6-10 m (haute-tige)',
    envergureAdulte: '4-6 m (gobelet) ; 6-8 m (haute-tige)',
    maladiesPrincipales: [
      'Moniliose (Monilinia laxa / fructigena)',
      'Rouille du prunier (Tranzschelia pruni-spinosae)',
      'Sharka (virus PPV)',
      'Gommose',
      'Pourriture brune',
    ],
    ravageursPrincipaux: [
      'Carpocapse des prunes (Grapholita funebrana)',
      'Hoplocampe du prunier',
      'Pucerons (farineux, vert)',
      'Araignee rouge',
      'Cochenilles',
    ],
    porteGreffes: [
      'Myrobolan (Prunus cerasifera) - tres vigoureux, tous sols y compris humides et calcaires, longue duree de vie',
      'Saint-Julien (Prunus insititia) - semi-vigoureux, sols peu profonds et frais (Nord de la Loire)',
      'Prunier de Damas - vigueur moyenne',
      'Mariana GF 8-1 - sol humide, eviter sols calcaires',
      'Pixy - nanifiant, 2-3 m, sols fertiles et irrigues',
    ],
  },

  // ============================================================
  // 5. PECHER
  // ============================================================
  {
    espece: 'Pecher',
    nomLatin: 'Prunus persica',
    type: 'arbre_fruitier',
    rendementKg: '30-50 kg/arbre en plein vent ; 15-25 kg en palissade',
    distancePlantation: '4-5 m (gobelet) ; 5-6 m (plein vent)',
    distanceRangs: '4-5 m',
    miseFruit: '2-3 ans (pecher franc) ; 3-4 ans (St Julien)',
    dureeVieProductive: '15-25 ans (courte duree de vie comparee aux autres fruitiers)',
    besoinEau: 'Moyen a Eleve - 650-700 mm du printemps a l\'automne',
    besoinFroidHeures: '400-1100 h (tres variable selon variete)',
    temperatureMin: '-15 a -20 degC (bois) ; -2.5 degC (fleurs, floraison precoce)',
    zoneUSDA: '5-9',
    exposition: 'Plein soleil, situation abritee (moitie sud France ideale)',
    phSolOptimal: '6.0-7.0 (eviter calcaire actif)',
    typeSol: 'Leger, bien draine, profond. Eviter sols lourds, asphyxiants et tres calcaires.',
    hauteurAdulte: '3-5 m (gobelet) ; 5-7 m (plein vent)',
    envergureAdulte: '3-5 m',
    maladiesPrincipales: [
      'Cloque du pecher (Taphrina deformans)',
      'Moniliose (Monilinia laxa)',
      'Oidium',
      'Coryneum (criblure)',
      'Chancre a Fusicoccum',
    ],
    ravageursPrincipaux: [
      'Pucerons verts et noirs du pecher',
      'Tordeuse orientale (Cydia molesta)',
      'Mouche mediterraneenne (Ceratitis capitata)',
      'Cochenilles',
      'Thrips',
    ],
    porteGreffes: [
      'Pecher franc (Prunus persica) - vigoureux, sols legers et drainants',
      'GF 305 - vigoureux, sols non chlorosants',
      'Saint-Julien (Prunus insititia) - semi-vigoureux, sols peu profonds, frais, Nord de la Loire',
      'Amandier (Prunus dulcis) - sols calcaires et secs (Sud)',
      'Prunier myrobolan - sols lourds et humides',
      'Cadaman / Barrier (hybrides) - resistance nematodes',
    ],
  },

  // ============================================================
  // 6. ABRICOTIER
  // ============================================================
  {
    espece: 'Abricotier',
    nomLatin: 'Prunus armeniaca',
    type: 'arbre_fruitier',
    rendementKg: '30-60 kg/arbre adulte (tres variable : 0 a 200 kg selon alternance)',
    distancePlantation: '3.5-4 m (gobelet) ; 5-6 m (plein vent)',
    distanceRangs: '4-5 m',
    miseFruit: '3-4 ans (myrobolan) ; 4-5 ans (franc)',
    dureeVieProductive: '25-40 ans',
    besoinEau: 'Faible a Moyen - ~530 mm/an ; tolere la secheresse. Eviter exces eau.',
    besoinFroidHeures: '300-900 h (selon variete ; ex: Bergeron ~600 h)',
    temperatureMin: '-25 a -27 degC (bois) ; -2 degC (fleurs, floraison tres precoce)',
    zoneUSDA: '5-9 (zone confort 7-9)',
    exposition: 'Plein soleil, abrite du vent froid et gelees printanieres',
    phSolOptimal: '6.0-7.5 (eviter sols tres acides ou tres alcalins)',
    typeSol: 'Bien draine, profond, pas trop humide. Tolere le calcaire (avec myrobolan ou amandier).',
    hauteurAdulte: '4-6 m (gobelet) ; 6-9 m (plein vent)',
    envergureAdulte: '4-7 m',
    maladiesPrincipales: [
      'Moniliose (Monilinia laxa) - maladie principale',
      'Cloque (Taphrina deformans)',
      'Bacterial canker (Pseudomonas syringae)',
      'Sharka (virus PPV)',
      'Coryneum (criblure)',
      'Gommose',
    ],
    ravageursPrincipaux: [
      'Pucerons (farineux, vert)',
      'Tordeuse orientale (Cydia molesta)',
      'Forficules',
      'Cochenilles',
      'Acariens',
    ],
    porteGreffes: [
      'Prunier Myrobolan (Prunus cerasifera) - le plus courant, tous sols, resiste secheresse et asphyxie',
      'Amandier (Prunus dulcis) - sols secs et calcaires (Sud)',
      'Pecher franc - sols legers et drainants',
      'Abricotier franc - sols profonds',
      'Rubira / Montclar (hybrides pecher) - resistance nematodes',
    ],
  },

  // ============================================================
  // 7. OLIVIER
  // ============================================================
  {
    espece: 'Olivier',
    nomLatin: 'Olea europaea',
    type: 'arbre_fruitier',
    rendementKg: '15-50 kg olives/arbre (selon age, irrigation, conduite) ; atteint plein potentiel entre 10-15 ans',
    distancePlantation: '6-8 m (traditionnel) ; 3-4 m (intensif) ; 1-1.5 m (super-intensif)',
    distanceRangs: '6-8 m (traditionnel) ; 3-4 m (intensif)',
    miseFruit: '5-8 ans (premiere production significative) ; potentiel max 10-15 ans',
    dureeVieProductive: '100+ ans (certains oliviers produisent depuis des siecles)',
    besoinEau: 'Faible - 450-600 mm/an bien repartis ; craint l\'exces d\'eau',
    besoinFroidHeures: '200-600 h (faible besoin, mais le froid ameliore la fructification)',
    temperatureMin: '-12 degC (moyenne) ; -18 degC (variete Bouteillan) ; feuillage endommage des -5 degC',
    zoneUSDA: '8-11',
    exposition: 'Plein soleil, situation abritee du vent froid',
    phSolOptimal: '7.0-8.5 (tolere tres bien le calcaire)',
    typeSol: 'Bien draine, supporte sols pauvres, caillouteux, calcaires. Craint les sols lourds et gorges d\'eau.',
    hauteurAdulte: '6-10 m (en culture) ; 10-15 m (en liberte)',
    envergureAdulte: '6-10 m',
    maladiesPrincipales: [
      'Oeil de paon (Cycloconium oleaginum) - maladie principale',
      'Dalmaticose (Botryosphaeria dothidea)',
      'Verticilliose (Verticillium dahliae)',
      'Fumagine',
      'Tuberculose (Pseudomonas savastanoi)',
    ],
    ravageursPrincipaux: [
      'Mouche de l\'olive (Bactrocera oleae) - ravageur principal',
      'Teigne de l\'olivier (Prays oleae)',
      'Cochenille noire (Saissetia oleae)',
      'Scolyte de l\'olivier (Phloeotribus scarabaeoides)',
      'Pyrale du jasmin',
    ],
    porteGreffes: [
      'Oleastre (olivier sauvage) - porte-greffe traditionnel, adapte localement',
      'Franc de semis (Olea europaea) - bon ancrage, adaptation sol/climat',
      'Bouture directe - methode la plus courante en France (pas de porte-greffe)',
    ],
  },

  // ============================================================
  // 8. FIGUIER
  // ============================================================
  {
    espece: 'Figuier',
    nomLatin: 'Ficus carica',
    type: 'arbre_fruitier',
    rendementKg: '20-30 kg/arbre (moyenne) ; 15-80 kg selon age et conditions',
    distancePlantation: '4-6 m',
    distanceRangs: '4-6 m',
    miseFruit: '2-3 ans',
    dureeVieProductive: '50-100+ ans',
    besoinEau: 'Faible a Moyen - tolere bien la secheresse une fois etabli ; ~400-500 mm/an',
    besoinFroidHeures: '~100 h (tres faible besoin en froid)',
    temperatureMin: '-12 a -15 degC (bois adulte) ; parties aeriennes detruites a -10 degC puis repart du pied',
    zoneUSDA: '7-10',
    exposition: 'Plein soleil, situation chaude et abritee (ideal pied d\'un mur expose sud)',
    phSolOptimal: '6.0-7.0',
    typeSol: 'Tous sols, prefere limono-argileux et frais. Tolere sols pauvres, sableux, caillouteux. Bien draine.',
    hauteurAdulte: '3-5 m (en culture) ; jusqu\'a 10 m en climat favorable',
    envergureAdulte: '4-6 m',
    maladiesPrincipales: [
      'Virus de la mosaique du figuier (FMV)',
      'Chancre (Phomopsis fici)',
      'Rouille du figuier',
      'Botrytis (pourriture grise)',
      'Cerco­sporiose',
    ],
    ravageursPrincipaux: [
      'Mouche noire du figuier (Silba adipata)',
      'Mouche mediterraneenne (Ceratitis capitata)',
      'Teigne du figuier',
      'Psylle du figuier',
      'Acarien Aceria ficus (vecteur du virus mosaique)',
    ],
    porteGreffes: [
      'Le figuier est generalement multiplie par bouturage (pas de porte-greffe)',
      'Greffe en chip budding possible sur Ficus carica franc pour changer de variete',
    ],
  },

  // ============================================================
  // 9. NOYER
  // ============================================================
  {
    espece: 'Noyer',
    nomLatin: 'Juglans regia',
    type: 'arbre_fruitier',
    rendementKg: '30-70 kg noix/arbre adulte ; ~6 000 kg/ha (70-100 arbres/ha)',
    distancePlantation: '10-12 m (AOP Noix de Grenoble : min 10x10 m)',
    distanceRangs: '10-12 m',
    miseFruit: '7-10 ans (Franquette) ; 4-6 ans (varietes precoces type Lara)',
    dureeVieProductive: '70-200+ ans (certains noyers multi-centenaires)',
    besoinEau: 'Moyen a Eleve - 700-1200 mm/an bien repartis (optimum 1000-1200 mm)',
    besoinFroidHeures: '500-1000 h',
    temperatureMin: '-25 a -30 degC (bois) ; sensible aux gelees printanieres sur jeunes pousses',
    zoneUSDA: '4-9',
    exposition: 'Plein soleil',
    phSolOptimal: '6.5-7.5 (eviter pH < 6.5)',
    typeSol: 'Profond (>1 m), riche, bien draine. Eviter sols superficiels et gorges d\'eau. Tolere moderement le calcaire.',
    hauteurAdulte: '15-25 m',
    envergureAdulte: '10-18 m',
    maladiesPrincipales: [
      'Bacteriose (Xanthomonas arboricola pv. juglandis) - cause principale de pertes en France',
      'Anthracnose (Gnomonia leptostyla)',
      'Maladie de l\'encre (Phytophthora)',
      'Pourridies (Armillaria)',
    ],
    ravageursPrincipaux: [
      'Carpocapse du noyer (Cydia pomonella)',
      'Mouche du brou (Rhagoletis completa)',
      'Zeuzere du poirier',
      'Pucerons',
      'Acariens',
    ],
    porteGreffes: [
      'Noyer commun franc (Juglans regia) - porte-greffe standard, greffe en fente Cadillac',
      'Noyer noir (Juglans nigra) - vigoureux, utilise en combinaison fruit/bois',
      'MJ 209 (J. nigra x J. regia) - hybride vigoureux',
    ],
  },

  // ============================================================
  // 10. CHATAIGNIER
  // ============================================================
  {
    espece: 'Chataignier',
    nomLatin: 'Castanea sativa',
    type: 'arbre_fruitier',
    rendementKg: '15-25 kg/arbre (verger agroforestier) ; jusqu\'a 100 kg (max AOP Chataigne d\'Ardeche)',
    distancePlantation: '8-10 m (production fruitiere)',
    distanceRangs: '8-10 m',
    miseFruit: '5-8 ans apres greffe (8+ ans apres plantation de franc)',
    dureeVieProductive: '100+ ans (longevite exceptionnelle, certains > 1000 ans)',
    besoinEau: 'Moyen - 800-1500 mm/an, sols profonds et frais',
    besoinFroidHeures: '400-700 h',
    temperatureMin: '-20 a -25 degC (bois)',
    zoneUSDA: '5-9',
    exposition: 'Plein soleil a mi-ombre legere',
    phSolOptimal: '5.5-7.0 (acide a neutre ; craint le calcaire actif)',
    typeSol: 'Profond, frais, acide, sableux ou siliceux, permeable. Ne supporte PAS le calcaire actif.',
    hauteurAdulte: '20-30 m',
    envergureAdulte: '10-20 m',
    maladiesPrincipales: [
      'Maladie de l\'encre (Phytophthora cambivora / cinnamomi) - principale menace',
      'Chancre de l\'ecorce (Cryphonectria parasitica)',
      'Pourridies (Armillaria mellea)',
    ],
    ravageursPrincipaux: [
      'Cynips du chataignier (Dryocosmus kuriphilus) - insecte de quarantaine',
      'Balanin des chataignes (Curculio elephas)',
      'Carpocapse du chataignier (Cydia splendana)',
      'Zeuzere du poirier',
    ],
    porteGreffes: [
      'Chataignier franc (Castanea sativa) - standard, greffage en ecussonnage ou couronne',
      'Hybrides resistants a l\'encre (Castanea crenata x sativa) - Bouche de Betizac, Marigoule',
      'Chataignier du Japon (Castanea crenata) - resistance a l\'encre',
    ],
  },

  // ============================================================
  // 11. VIGNE
  // ============================================================
  {
    espece: 'Vigne',
    nomLatin: 'Vitis vinifera',
    type: 'liane',
    rendementKg: '1.5-3 kg/pied (raisin de table) ; ~7.5 t/ha (moyenne France viticole, ~57 hL/ha)',
    distancePlantation: '1-1.5 m entre pieds dans le rang',
    distanceRangs: '1.5-2.5 m (densite 3000-5000 pieds/ha typique en France)',
    miseFruit: '3-4 ans (premiere recolte significative)',
    dureeVieProductive: '30-50 ans (viticulture) ; 100+ ans (vieilles vignes)',
    besoinEau: 'Faible a Moyen - 350-500 mm/an en periode vegetative ; culture seche possible',
    besoinFroidHeures: '200-400 h (faible besoin)',
    temperatureMin: '-15 a -18 degC (bois) ; bourgeons sensibles aux gelees printanieres',
    zoneUSDA: '5-10 (selon cepage)',
    exposition: 'Plein soleil, sol retenant la chaleur, pente exposee sud ideale',
    phSolOptimal: '5.5-7.5 (selon porte-greffe)',
    typeSol: 'Bien draine, meme pauvre et caillouteux. Tolere de nombreux types de sol. Eviter les sols trop humides.',
    hauteurAdulte: '1.5-2 m (palissage viticole) ; grimpante jusqu\'a 15 m en liberte',
    envergureAdulte: '1-2 m (conduite palissee)',
    maladiesPrincipales: [
      'Mildiou (Plasmopara viticola)',
      'Oidium (Uncinula necator)',
      'Botrytis (pourriture grise)',
      'Black-rot',
      'Esca / BDA (maladies du bois)',
      'Excoriose',
    ],
    ravageursPrincipaux: [
      'Eudémis / Cochylis (tordeuses de la grappe)',
      'Cicadelle de la flavescence doree',
      'Acariens (erinose)',
      'Cochenilles',
      'Phylloxera (sur racines Vitis vinifera non greffee)',
    ],
    porteGreffes: [
      'SO4 (Selection Oppenheim 4) - vigoureux, tolere humidite, tres repandu',
      '3309C (Couderc) - vigueur moyenne, bon enracinement',
      '41B (Millardet et Grasset) - resistant au calcaire actif',
      'Fercal - tres resistant a la chlorose, sols calcaires',
      '110R (Richter) - resistant a la secheresse, sols chauds',
      '161-49C (Couderc) - vigueur faible, sols calcaires',
      '1103P (Paulsen) - resistant a la secheresse et au calcaire',
    ],
  },

  // ============================================================
  // 12. CITRONNIER
  // ============================================================
  {
    espece: 'Citronnier',
    nomLatin: 'Citrus limon',
    type: 'arbre_fruitier',
    rendementKg: '50-100 kg/arbre adulte en pleine terre (200-600 fruits/an)',
    distancePlantation: '4-5 m',
    distanceRangs: '5-6 m',
    miseFruit: '4-5 ans (production croissante jusqu\'a 15 ans)',
    dureeVieProductive: '30-50 ans',
    besoinEau: 'Eleve - 800-1200 mm/an ; arrosage regulier obligatoire',
    besoinFroidHeures: '0 h (aucun besoin de froid, arbre sempervirent)',
    temperatureMin: '-3 a -5 degC (feuillage detruit a -3 degC ; mort de l\'arbre a -7/-8 degC)',
    zoneUSDA: '9-11',
    exposition: 'Plein soleil, situation tres abritee en France (Cote d\'Azur, Corse)',
    phSolOptimal: '5.5-6.5 (sols non calcaires)',
    typeSol: 'Leger, bien draine, riche en matiere organique. Eviter le calcaire (chlorose).',
    hauteurAdulte: '3-5 m (en culture)',
    envergureAdulte: '3-4 m',
    maladiesPrincipales: [
      'Gommose (Phytophthora)',
      'Mal secco (Phoma tracheiphila)',
      'Fumagine',
      'Tristeza (virus CTV)',
    ],
    ravageursPrincipaux: [
      'Cochenille farineuse (Planococcus citri)',
      'Cochenille a bouclier (Icerya purchasi)',
      'Aleurodes (mouche blanche)',
      'Pucerons',
      'Mineuse des agrumes (Phyllocnistis citrella)',
    ],
    porteGreffes: [
      'Poncirus trifoliata - le plus rustique (-20 degC), nanifiant, sols non calcaires',
      'Citrange Carrizo - vigoureux, resistant Tristeza, sols legers',
      'Citrange Troyer - similaire a Carrizo',
      'Bigaradier (Citrus aurantium) - traditionnel mais sensible Tristeza',
      'Volkameriana - vigoureux, resistant secheresse et froid modere',
    ],
  },

  // ============================================================
  // 13. ORANGER
  // ============================================================
  {
    espece: 'Oranger',
    nomLatin: 'Citrus sinensis',
    type: 'arbre_fruitier',
    rendementKg: '50-150 kg/arbre adulte ; ~40 t/ha en verger intensif',
    distancePlantation: '4-6 m (intensif) ; 6-9 m (traditionnel)',
    distanceRangs: '5-6 m (intensif) ; 6-9 m (traditionnel)',
    miseFruit: '4-5 ans (production croissante jusqu\'a 15 ans)',
    dureeVieProductive: '40-80 ans',
    besoinEau: 'Eleve - 900-1200 mm/an',
    besoinFroidHeures: '0 h (pas de besoin de froid)',
    temperatureMin: '-5 a -9 degC (tronc a -9 degC ; feuillage abime des -3 degC)',
    zoneUSDA: '9-11',
    exposition: 'Plein soleil, situation chaude et abritee',
    phSolOptimal: '5.5-7.5',
    typeSol: 'Bien draine, profond, riche. Eviter sols trop sableux et trop calcaires.',
    hauteurAdulte: '4-8 m (en culture) ; 10-12 m (en liberte)',
    envergureAdulte: '4-6 m',
    maladiesPrincipales: [
      'Tristeza (virus CTV) - tres devastateur',
      'Gommose (Phytophthora)',
      'Fumagine',
      'Greening (Huanglongbing)',
    ],
    ravageursPrincipaux: [
      'Cochenille de l\'oranger (Planococcus citri)',
      'Pou de Californie (Aonidiella aurantii)',
      'Mouche mediterraneenne (Ceratitis capitata)',
      'Aleurodes',
      'Mineuse des agrumes (Phyllocnistis citrella)',
    ],
    porteGreffes: [
      'Citrange Carrizo - vigoureux, resistant Tristeza, le plus utilise actuellement',
      'Citrange Troyer - similaire a Carrizo',
      'Poncirus trifoliata - tres rustique, nanifiant',
      'Bigaradier (Citrus aurantium) - traditionnel, SENSIBLE Tristeza, a eviter en zone Tristeza',
      'Volkameriana - vigoureux, resistant secheresse',
    ],
  },

  // ============================================================
  // 14. COGNASSIER
  // ============================================================
  {
    espece: 'Cognassier',
    nomLatin: 'Cydonia oblonga',
    type: 'arbre_fruitier',
    rendementKg: '20-40 kg/arbre adulte ; ~20-25 t/ha en verger',
    distancePlantation: '4-7 m (production fruitiere) ; 2.5 m (haie)',
    distanceRangs: '4-5 m',
    miseFruit: '3-5 ans',
    dureeVieProductive: '30-60 ans',
    besoinEau: 'Moyen - 600-800 mm/an ; tolere sols frais et humides',
    besoinFroidHeures: '300-500 h',
    temperatureMin: '-25 degC (bois)',
    zoneUSDA: '4-9',
    exposition: 'Plein soleil a mi-ombre legere',
    phSolOptimal: '6.0-7.0 (neutre a legerement acide ; max 7-8% de calcaire)',
    typeSol: 'Frais, riche, bien draine. Tolere sols humides. Eviter exces de calcaire.',
    hauteurAdulte: '5-8 m',
    envergureAdulte: '4-6 m',
    maladiesPrincipales: [
      'Entomosporiose (Diplocarpon mespili) - maladie principale',
      'Moniliose des fruits',
      'Feu bacterien (Erwinia amylovora)',
      'Oidium',
    ],
    ravageursPrincipaux: [
      'Carpocapse (Cydia pomonella)',
      'Pucerons',
      'Cochenilles',
      'Hoplocampe',
    ],
    porteGreffes: [
      'Cognassier franc - standard, bonne vigueur',
      'Cognassier de Provence BA29 - selection INRA, semi-vigoureux, le plus utilise en pro',
      'Cognassier d\'Angers - vigueur moderee',
      'Cognassier EMC - nanifiant (East Malling)',
    ],
  },

  // ============================================================
  // 15. NEFLIER
  // ============================================================
  {
    espece: 'Neflier',
    nomLatin: 'Mespilus germanica',
    type: 'arbre_fruitier',
    rendementKg: '15-30 kg/arbre adulte (jusqu\'a 90 kg pour grands sujets)',
    distancePlantation: '6-8 m',
    distanceRangs: '6-8 m',
    miseFruit: '3-5 ans (sur aubepine) ; 5-7 ans (sur franc)',
    dureeVieProductive: '40-80 ans',
    besoinEau: 'Moyen - 600-800 mm/an ; maintenir sol humide sans exces',
    besoinFroidHeures: '400-600 h (recolte apres gelees pour bletissement)',
    temperatureMin: '-20 degC',
    zoneUSDA: '4-8',
    exposition: 'Plein soleil a ombre legere',
    phSolOptimal: '5.5-7.0 (legerement acide a neutre)',
    typeSol: 'Profond, bien draine, riche en humus. Accepte a peu pres tous les sols draines.',
    hauteurAdulte: '4-6 m',
    envergureAdulte: '4-6 m (port buissonnant etale)',
    maladiesPrincipales: [
      'Feu bacterien (Erwinia amylovora)',
      'Entomosporiose',
      'Moniliose',
      'Mildiou',
      'Oidium',
    ],
    ravageursPrincipaux: [
      'Carpocapse',
      'Pucerons verts',
      'Cochenilles',
      'Zeuzere',
    ],
    porteGreffes: [
      'Aubepine (Crataegus) - le plus courant en pepiniere, fructification precoce, longue duree de vie',
      'Poirier franc - bonne compatibilite',
      'Cognassier - compatible',
      'Sorbier (Sorbus) - pour sols acides',
      'Neflier franc (semis) - vigoureux mais mise a fruit lente',
    ],
  },

  // ============================================================
  // 16. KIWI
  // ============================================================
  {
    espece: 'Kiwi',
    nomLatin: 'Actinidia deliciosa / A. chinensis',
    type: 'liane',
    rendementKg: '20-50 kg/pied femelle adulte ; 15-25 t/ha',
    distancePlantation: '4.5-5 m entre pieds (1 male pour 6-7 femelles)',
    distanceRangs: '5-6 m',
    miseFruit: '3-5 ans',
    dureeVieProductive: '30-50 ans',
    besoinEau: 'Eleve - 800-1200 mm/an ; arrosage regulier indispensable (goutte a goutte)',
    besoinFroidHeures: '600-800 h (besoin marque de froid hivernal)',
    temperatureMin: '-15 a -20 degC (bois dormant) ; sensible au gel automne et printemps sur jeunes pousses',
    zoneUSDA: '7-9',
    exposition: 'Plein soleil a mi-ombre ; abrite du vent (feuilles fragiles)',
    phSolOptimal: '5.5-6.5 (acide a legerement acide ; ne tolere PAS le calcaire)',
    typeSol: 'Riche en humus, frais, limoneux, bien draine. Eviter sols calcaires et asphyxiants.',
    hauteurAdulte: '6-10 m (liane necessitant palissage/pergola)',
    envergureAdulte: '4-6 m (sous pergola) ; un pied couvre 20-25 m2',
    maladiesPrincipales: [
      'Chancre bacterien PSA (Pseudomonas syringae pv. actinidiae) - tres destructeur',
      'Botrytis (pourriture grise)',
      'Sclerotinia',
      'Pourridies (Armillaria)',
    ],
    ravageursPrincipaux: [
      'Metcalfa pruinosa (cicadelle)',
      'Cochenilles',
      'Nematodes',
      'Campagnols (rongeurs de racines)',
    ],
    porteGreffes: [
      'Le kiwi n\'est generalement pas greffe en France',
      'Multiplication par bouturage herbace ou semi-ligneux',
      'Greffage possible sur Actinidia chinensis franc pour varietes specifiques',
    ],
  },

  // ============================================================
  // 17. GRENADIER
  // ============================================================
  {
    espece: 'Grenadier',
    nomLatin: 'Punica granatum',
    type: 'arbre_fruitier',
    rendementKg: '15-50 kg/arbre adulte (optimal en climat mediterraneen)',
    distancePlantation: '4-5 m',
    distanceRangs: '4-5 m',
    miseFruit: '3-5 ans',
    dureeVieProductive: '40-100+ ans',
    besoinEau: 'Faible a Moyen - tolere bien la secheresse ; ~400-600 mm/an',
    besoinFroidHeures: '100-300 h (faible besoin)',
    temperatureMin: '-12 a -15 degC (bois)',
    zoneUSDA: '7-10',
    exposition: 'Plein soleil (6-8 h/jour minimum), abrite du vent',
    phSolOptimal: '5.5-7.5 (tolere sols calcaires et salins)',
    typeSol: 'Bien draine, tolere sols pauvres, calcaires, salins. Prefere sols riches et limoneux.',
    hauteurAdulte: '5-8 m',
    envergureAdulte: '3-5 m',
    maladiesPrincipales: [
      'Botrytis (pourriture des fruits)',
      'Cercosporiose',
      'Chancre (Phomopsis)',
      'Arbre generalement peu sensible aux maladies',
    ],
    ravageursPrincipaux: [
      'Pucerons',
      'Cochenilles',
      'Acariens',
      'Mouche mediterraneenne (Ceratitis capitata)',
    ],
    porteGreffes: [
      'Le grenadier est generalement multiplie par bouturage (methode principale)',
      'Greffe sur Punica granatum franc possible pour varietes specifiques',
    ],
  },

  // ============================================================
  // 18. PLAQUEMINIER (KAKI)
  // ============================================================
  {
    espece: 'Plaqueminier',
    nomLatin: 'Diospyros kaki',
    type: 'arbre_fruitier',
    rendementKg: '30-50 kg/arbre (10 ans) ; 80-100+ kg/arbre en pleine production',
    distancePlantation: '5-6 m (classique) ; 2.5-5 m (intensif)',
    distanceRangs: '5-6 m',
    miseFruit: '3-5 ans apres greffe',
    dureeVieProductive: '50-100+ ans',
    besoinEau: 'Moyen - 600-800 mm/an ; arrosage en ete si necessaire',
    besoinFroidHeures: '200-400 h (faible besoin)',
    temperatureMin: '-15 a -20 degC (bois selon variete et porte-greffe)',
    zoneUSDA: '7-10',
    exposition: 'Plein soleil, situation abritee des vents froids',
    phSolOptimal: '6.0-7.0 (legerement acide a neutre)',
    typeSol: 'Bien draine, riche en matiere organique. Eviter sols argileux et gorges d\'eau.',
    hauteurAdulte: '6-10 m (jusqu\'a 12 m en liberte)',
    envergureAdulte: '5-8 m',
    maladiesPrincipales: [
      'Anthracnose (taches brunes sur feuilles et fruits)',
      'Arbre peu sensible aux maladies sous nos latitudes',
      'Pourriture des racines (en sol trop humide)',
    ],
    ravageursPrincipaux: [
      'Psylle du plaqueminier',
      'Pucerons',
      'Cochenilles',
      'Tetranyques',
      'Mouche mediterraneenne (Ceratitis capitata)',
    ],
    porteGreffes: [
      'Diospyros lotus - porte-greffe principal en France, vigueur moyenne, adaptation sols humides',
      'Diospyros virginiana - systeme racinaire en pivot, 50% moins de besoin eau, tres rustique (-30 degC)',
      'Diospyros kaki franc - compatible mais moins utilise',
    ],
  },

  // ============================================================
  // 19. FRAMBOISIER
  // ============================================================
  {
    espece: 'Framboisier',
    nomLatin: 'Rubus idaeus',
    type: 'petit_fruit',
    rendementKg: '0.8-1.5 kg/m lineaire (non remontant) ; 3-5 kg/m de haie (bien conduit) ; 3-4 kg/pied',
    distancePlantation: '0.5-0.6 m entre pieds dans le rang',
    distanceRangs: '1.5-2.5 m entre rangs (2.2-2.5 m en pro)',
    miseFruit: '1-2 ans apres plantation',
    dureeVieProductive: '8-12 ans (renouveler tous les 5-7 ans pour maintenir le rendement)',
    besoinEau: 'Moyen a Eleve - 600-800 mm/an ; sol frais en permanence',
    besoinFroidHeures: '800-1200 h (varietes remontantes : 400-600 h)',
    temperatureMin: '-25 a -30 degC (tres rustique)',
    zoneUSDA: '3-8',
    exposition: 'Plein soleil a mi-ombre ; eviter expositions sud brulantes en zone chaude',
    phSolOptimal: '6.0-6.5 (legerement acide)',
    typeSol: 'Frais, riche, humifere, bien draine. Sols legerement acides. Eviter calcaire et sols lourds.',
    hauteurAdulte: '1.2-2 m',
    envergureAdulte: '0.5-1 m par pied (forme haie par drageonnage)',
    maladiesPrincipales: [
      'Botrytis (pourriture grise) - maladie principale',
      'Anthracnose',
      'Oidium (Sphaerotheca macularis)',
      'Didymella applanata (brunissement des tiges)',
      'Phytophthora fragariae var. rubi (pourridie)',
    ],
    ravageursPrincipaux: [
      'Ver des framboises (Byturus tomentosus)',
      'Tetranyque tisserand',
      'Pucerons',
      'Anthonome du framboisier',
      'Tenthredes',
    ],
    porteGreffes: [
      'Pas de porte-greffe - multiplication par drageons ou bouturage de racines',
    ],
  },

  // ============================================================
  // 20. GROSEILLIER
  // ============================================================
  {
    espece: 'Groseillier',
    nomLatin: 'Ribes rubrum (grappes) / Ribes uva-crispa (maquereau)',
    type: 'petit_fruit',
    rendementKg: '2-4 kg/arbuste adulte (groseillier a grappes) ; 3-5 kg (groseillier a maquereau)',
    distancePlantation: '1-1.2 m (grappes) ; 0.8-1 m (maquereau)',
    distanceRangs: '1.5-2 m',
    miseFruit: '1-2 ans apres plantation',
    dureeVieProductive: '12-15 ans',
    besoinEau: 'Moyen - 500-700 mm/an ; sol frais',
    besoinFroidHeures: '800-1000 h',
    temperatureMin: '-25 a -30 degC (tres rustique)',
    zoneUSDA: '3-7',
    exposition: 'Plein soleil a mi-ombre (tolere ombre partielle)',
    phSolOptimal: '6.0-6.5 (eviter sols calcaires - risque de chlorose)',
    typeSol: 'Frais, meuble, silico-argileux, fertile, bien draine. Eviter sols trop calcaires.',
    hauteurAdulte: '1-1.5 m',
    envergureAdulte: '1-1.5 m',
    maladiesPrincipales: [
      'Oidium blanc (Microsphaera grossulariae)',
      'Oidium brun (Podosphaera mors-uvae) - surtout groseillier a maquereau',
      'Anthracnose (Drepanopeziza ribis)',
      'Rouille a colonnes (Cronartium ribicola)',
    ],
    ravageursPrincipaux: [
      'Phytopte du cassissier (Cecidophyopsis ribis)',
      'Tetranyque tisserand',
      'Pucerons',
      'Tenthredes du groseillier (Nematus ribesii)',
    ],
    porteGreffes: [
      'Pas de porte-greffe habituel - multiplication par bouturage ligneux ou marcottage',
      'Greffage possible sur Ribes aureum pour formes sur tige',
    ],
  },

  // ============================================================
  // 21. CASSISSIER
  // ============================================================
  {
    espece: 'Cassissier',
    nomLatin: 'Ribes nigrum',
    type: 'petit_fruit',
    rendementKg: '1-4 kg/arbuste adulte',
    distancePlantation: '1.2-1.5 m entre pieds',
    distanceRangs: '1.5-2 m',
    miseFruit: '1-2 ans apres plantation',
    dureeVieProductive: '12-15 ans',
    besoinEau: 'Moyen - 500-700 mm/an ; sol frais',
    besoinFroidHeures: '800-1200 h',
    temperatureMin: '-25 a -30 degC (tres rustique)',
    zoneUSDA: '3-7',
    exposition: 'Plein soleil a mi-ombre (tolere bien la mi-ombre)',
    phSolOptimal: '6.0-6.5 (legerement acide)',
    typeSol: 'Frais, meuble, riche, bien draine. Tolere sols argileux. Eviter sols secs et calcaires.',
    hauteurAdulte: '1-1.5 m',
    envergureAdulte: '1-1.5 m',
    maladiesPrincipales: [
      'Oidium (Sphaerotheca mors-uvae)',
      'Anthracnose (Drepanopeziza ribis)',
      'Rouille a colonnes (Cronartium ribicola)',
      'Reversion du cassissier (virus)',
    ],
    ravageursPrincipaux: [
      'Phytopte du cassissier (Cecidophyopsis ribis) - provoque le big bud et transmet le virus de reversion',
      'Tetranyque tisserand',
      'Pucerons',
      'Tenthredes',
    ],
    porteGreffes: [
      'Pas de porte-greffe - multiplication par bouturage ligneux (automne/hiver)',
    ],
  },

  // ============================================================
  // 22. MURIER SANS EPINE
  // ============================================================
  {
    espece: 'Murier sans epine',
    nomLatin: 'Rubus fruticosus (cultivars thornless)',
    type: 'petit_fruit',
    rendementKg: '3-5 kg/pied a partir de la 2e annee',
    distancePlantation: '2-3 m entre pieds (les tiges s\'etalent)',
    distanceRangs: '2-3 m',
    miseFruit: '2 ans (fructification sur tiges de 2e annee)',
    dureeVieProductive: '15-20 ans (renouvellement continu des tiges bisannuelles)',
    besoinEau: 'Faible a Moyen - 500-700 mm/an ; tolere la secheresse une fois etabli',
    besoinFroidHeures: '400-700 h',
    temperatureMin: '-15 a -25 degC (selon variete ; Black Satin -15 degC ; Triple Crown -25 degC)',
    zoneUSDA: '5-9',
    exposition: 'Plein soleil a mi-ombre ; ideal au pied d\'un mur expose sud',
    phSolOptimal: '5.5-6.5 (legerement acide)',
    typeSol: 'Leger, drainant, humifere, legerement acide. S\'adapte a tous types de sol.',
    hauteurAdulte: '2-5 m (palisse) ; tiges sarmenteuses retombantes',
    envergureAdulte: '3-5 m (etalement des tiges)',
    maladiesPrincipales: [
      'Anthracnose (perte de rendement jusqu\'a 30%)',
      'Botrytis (pourriture grise)',
      'Rouille du murier',
      'Oidium',
    ],
    ravageursPrincipaux: [
      'Ver des framboises (Byturus tomentosus)',
      'Phytopte de la ronce',
      'Pucerons',
      'Drosophila suzukii',
    ],
    porteGreffes: [
      'Pas de porte-greffe - multiplication par bouturage de tiges ou marcottage',
    ],
  },

  // ============================================================
  // 23. ARGOUSIER
  // ============================================================
  {
    espece: 'Argousier',
    nomLatin: 'Hippophae rhamnoides',
    type: 'petit_fruit',
    rendementKg: '5-15 kg/arbuste adulte (rendement max apres 7-8 ans)',
    distancePlantation: '1.5-2.5 m (1 male pour 5-6 femelles, espece dioique)',
    distanceRangs: '3-4 m',
    miseFruit: '3-4 ans (rendement max 7-8 ans)',
    dureeVieProductive: '20-30 ans (productif) ; longevite arbuste jusqu\'a 80 ans',
    besoinEau: 'Faible - tres resistant a la secheresse ; 300-500 mm/an',
    besoinFroidHeures: '400-800 h (a confirmer selon cultivar et origine geographique)',
    temperatureMin: '-30 a -33 degC (extremement rustique)',
    zoneUSDA: '3-7',
    exposition: 'Plein soleil (tres heliophile, ne tolere pas l\'ombre)',
    phSolOptimal: '6.0-7.0 (s\'adapte aussi aux sols acides et alcalins)',
    typeSol: 'Bien draine, tolere sols pauvres, sableux, caillouteux. Fixe l\'azote (Frankia). Ideal sols limono-sableux.',
    hauteurAdulte: '3-5 m',
    envergureAdulte: '2-4 m',
    maladiesPrincipales: [
      'Fletrissement (Verticillium / Fusarium) - maladie principale en verger',
      'Argousier generalement peu sensible aux maladies',
    ],
    ravageursPrincipaux: [
      'Mouche de l\'argousier (Rhagoletis batava)',
      'Pucerons',
      'Arbre generalement peu attaque par les ravageurs',
    ],
    porteGreffes: [
      'Pas de porte-greffe - multiplication par bouturage herbace, marcottage, ou semis',
      'Greffage possible sur Hippophae rhamnoides franc pour varietes specifiques',
    ],
  },
];

// ============================================================
// TABLEAU RECAPITULATIF COMPACT (pour affichage dans l'application)
// ============================================================

export const ARBRES_REFERENCE_COMPACT = ARBRES_REFERENCE.map((a) => ({
  espece: a.espece,
  nomLatin: a.nomLatin,
  type: a.type,
  rendementKg: a.rendementKg,
  distancePlantation: a.distancePlantation,
  distanceRangs: a.distanceRangs,
  miseFruit: a.miseFruit,
  dureeVie: a.dureeVieProductive,
  besoinEau: a.besoinEau,
  besoinFroid: a.besoinFroidHeures,
  tempMin: a.temperatureMin,
  zoneUSDA: a.zoneUSDA,
  pH: a.phSolOptimal,
  sol: a.typeSol,
  exposition: a.exposition,
  hauteur: a.hauteurAdulte,
  envergure: a.envergureAdulte,
  maladies: a.maladiesPrincipales.join(', '),
  ravageurs: a.ravageursPrincipaux.join(', '),
  porteGreffes: a.porteGreffes.join(', '),
}));
