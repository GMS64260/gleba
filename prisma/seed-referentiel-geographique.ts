/**
 * Seed « Gleba officiel » du RÉFÉRENTIEL GÉOGRAPHIQUE (référentiel géographique
 * outre-mer). Idempotent — rejouable à chaque démarrage sans effet de bord.
 *
 *   docker compose exec -T app npx tsx prisma/seed-referentiel-geographique.ts
 *
 * Trois volets :
 *   1. BACKFILL besoinFroid des espèces métropolitaines tempérées (source :
 *      prisma/seed-arbres-reference.ts, heures de froid < 7 °C). Pilote
 *      l'avertissement « peu adaptée » quand on les plante en zone tropicale.
 *   2. Familles botaniques tropicales manquantes.
 *   3. Espèces tropicales officielles (userId null) + leurs ITP calés PAR ZONE
 *      sur les saisons locales (attention : hémisphère sud = saisons inversées).
 *
 * Convention prod (cf. migrate-data-v1) : on peuple nom + nomNormalise +
 * uniteRendement + modeSemis. L'id officiel = le nom lisible (rétro-compat FK).
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Clé de déduplication normalisée. Copie autonome de src/lib/normalize.ts :
// l'image de prod (build standalone) n'embarque pas src/lib/, et ce seed doit
// tourner au démarrage du conteneur. Garder les deux en phase.
function normalizeReferentielKey(input: string): string {
  return input
    .normalize('NFC')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

// ── Volet 1 — besoinFroid des espèces métropolitaines ──────────────────────
// Catégories : aucun | faible (<300 h) | modere (300-600 h) | eleve (>600 h).
// Seules modere/eleve déclenchent l'avertissement en zone tropicale. Les
// espèces subtropicales (agrumes, figuier, grenadier, kaki…) restent neutres :
// elles poussent en tropical, pas d'avertissement. Source : seed-arbres-reference.
const BESOIN_FROID_METROPOLE: Record<string, 'aucun' | 'faible' | 'modere' | 'eleve'> = {
  // Rosacées à pépins/noyau nettement tempérées → élevé
  Pommier: 'eleve',       // 800-1600 h
  Poirier: 'eleve',       // 800-1000 h
  Cerisier: 'eleve',      // 800-1500 h
  Prunier: 'eleve',       // 500-800 h (prunier européen : vrai hiver requis)
  Cognassier: 'modere',   // 300-500 h
  Néflier: 'modere',      // 400-600 h
  Amandier: 'modere',     // 200-500 h
  Abricotier: 'modere',   // 300-900 h
  Pêcher: 'modere',       // 400-1100 h (cultivars low-chill en subtropical)
  Noyer: 'eleve',         // 500-1000 h
  Châtaignier: 'eleve',   // 400-700 h (fructification en climat tempéré)
  Kiwi: 'eleve',          // 600-800 h
  Vigne: 'faible',        // 200-400 h (raisin de table cultivé en subtropical)
  Olivier: 'modere',      // 200-600 h (froid nécessaire à l'induction florale)
  Figuier: 'faible',      // ~100 h
  Grenadier: 'faible',    // 100-300 h
  Plaqueminier: 'faible', // 200-400 h
  Feijoa: 'faible',       // 50-100 h
  Citronnier: 'aucun',
  Oranger: 'aucun',
  Mandarinier: 'aucun',
  Kumquat: 'aucun',
  // Petits fruits
  Cassissier: 'eleve',    // 800-1200 h
  Groseillier: 'eleve',   // 800-1000 h
  Framboisier: 'eleve',   // 800-1200 h
  Argousier: 'eleve',     // 400-800 h (plante de climat froid/boréal)
  'Mûrier sans épine': 'modere', // 400-700 h
  'Mûrier platane': 'faible',
  Sureau: 'modere',
}

// ── Volet 2 — familles botaniques (upsert si absentes) ─────────────────────
interface FamilleSeed { id: string; nomFr: string }
const FAMILLES_TROPICALES: FamilleSeed[] = [
  { id: 'Dioscoreaceae', nomFr: 'Dioscoréacées (ignames)' },
  { id: 'Araceae', nomFr: 'Aracées (taros)' },
  { id: 'Musaceae', nomFr: 'Musacées (bananiers)' },
  { id: 'Caricaceae', nomFr: 'Caricacées (papayers)' },
  { id: 'Anacardiaceae', nomFr: 'Anacardiacées (manguiers)' },
  { id: 'Sapindaceae', nomFr: 'Sapindacées (litchis, longanes)' },
  { id: 'Lauraceae', nomFr: 'Lauracées (avocatiers)' },
  { id: 'Bromeliaceae', nomFr: 'Broméliacées (ananas)' },
  { id: 'Annonaceae', nomFr: 'Annonacées (corossols)' },
  { id: 'Passifloraceae', nomFr: 'Passifloracées (fruits de la passion)' },
  { id: 'Zingiberaceae', nomFr: 'Zingibéracées (gingembre, curcuma)' },
  { id: 'Oxalidaceae', nomFr: 'Oxalidacées (caramboles)' },
  { id: 'Euphorbiaceae', nomFr: 'Euphorbiacées (manioc)' },
  { id: 'Malvaceae', nomFr: 'Malvacées (gombo, roselle)' },
  { id: 'Convolvulaceae', nomFr: 'Convolvulacées (patate douce)' },
  { id: 'Cucurbitaceae', nomFr: 'Cucurbitacées' },
  { id: 'Fabaceae', nomFr: 'Fabacées (légumineuses)' },
  { id: 'Solanaceae', nomFr: 'Solanacées' },
  { id: 'Asteraceae', nomFr: 'Astéracées' },
  { id: 'Poaceae', nomFr: 'Poacées (graminées)' },
  { id: 'Myrtaceae', nomFr: 'Myrtacées (goyaviers)' },
  { id: 'Rutaceae', nomFr: 'Rutacées (agrumes)' },
  { id: 'Moraceae', nomFr: 'Moracées (arbres à pain, jacquiers)' },
  { id: 'Arecaceae', nomFr: 'Arécacées (palmiers, cocotier)' },
  { id: 'Malpighiaceae', nomFr: 'Malpighiacées (acérola)' },
  { id: 'Orchidaceae', nomFr: 'Orchidacées (vanille)' },
  { id: 'Amaranthaceae', nomFr: 'Amaranthacées (amarantes)' },
  { id: 'Alliaceae', nomFr: 'Alliacées (aulx, oignons)' },
  { id: 'Rosaceae', nomFr: 'Rosacées' },
]

// ── Volet 3 — espèces tropicales + ITP par zone ────────────────────────────
// Rempli à partir de la recherche agronomique vérifiée (workflow). Voir
// EspeceTropicale plus bas. Les semaines ISP (1-52) sont calées sur la saison
// LOCALE de chaque zone (hémisphère sud : été austral ≈ nov-avr).
interface ItpZone {
  zone: string              // valeur ZONES_CLIMAT
  semaineSemis?: number | null
  semainePlantation?: number | null
  semaineRecolte?: number | null
  dureeRecolte?: number | null
  dureeCulture?: number | null
  espacement?: number | null
  notes?: string | null
}
interface EspeceTropicale {
  nom: string
  nomLatin: string
  famille: string
  type: 'legume' | 'aromatique' | 'arbre_fruitier' | 'petit_fruit'
  vivace?: boolean
  uniteRendement: 'kg_m2' | 'kg_arbre'
  rendement?: number | null
  besoinN?: number | null
  besoinEau?: number | null
  besoinFroid?: 'aucun' | 'faible' | 'modere' | 'eleve'
  modeSemis?: string | null
  couleur?: string | null
  zonesAdaptees: string[]   // zones où l'espèce est cultivable
  itps: ItpZone[]
}

// __ESPECES_TROPICALES__ : injecté ci-dessous.
const ESPECES_TROPICALES: EspeceTropicale[] = [
  {
    nom: 'Arbre à pain', nomLatin: 'Artocarpus altilis', famille: 'Moraceae', type: 'arbre_fruitier',
    vivace: true, uniteRendement: 'kg_arbre', rendement: 150, besoinN: 3, besoinEau: 4,
    besoinFroid: 'aucun', modeSemis: 'bouture', couleur: '#e67e22',
    zonesAdaptees: ['equatorial', 'tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'equatorial', semaineSemis: 15, semainePlantation: 15, semaineRecolte: 6, dureeRecolte: 16, dureeCulture: 1460, espacement: 1000, notes: 'Multiplication par rejets racinaires (cultivars sans graines). Grand arbre : prévoir 10 m. Récolte principale en début d\'année (fév-mai), seconde vague plus faible en cours d\'année. Fruit consommé cuit (féculent). Très p' },
      { zone: 'tropical_antilles', semaineSemis: 25, semaineRecolte: 28, dureeRecolte: 16, dureeCulture: 1460, espacement: 1100, notes: 'Grand arbre à réserver aux grandes parcelles. Récolte principale en hivernage (juillet-octobre, S28-42) + fructification secondaire en carême. Strictement tropical, gélif. Plantation début hivernage.' },
      { zone: 'tropical_austral', semaineSemis: 46, semainePlantation: 46, semaineRecolte: 48, dureeRecolte: 20, dureeCulture: 1460, espacement: 900, notes: 'Saison principale en plein été austral (nov.-avril) avec une seconde production plus faible. Espèce pilier des jardins polynésiens et wallisiens ; plantation par drageons au début des pluies, sols profonds et humides.' }
    ],
  },
  {
    nom: 'Avocatier', nomLatin: 'Persea americana', famille: 'Lauraceae', type: 'arbre_fruitier',
    vivace: true, uniteRendement: 'kg_arbre', rendement: 100, besoinN: 3, besoinEau: 3,
    besoinFroid: 'aucun', modeSemis: 'greffe', couleur: '#e67e22',
    zonesAdaptees: ['equatorial', 'tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'equatorial', semaineSemis: 15, semainePlantation: 15, semaineRecolte: 28, dureeRecolte: 18, dureeCulture: 1095, espacement: 800, notes: 'Utiliser impérativement des variétés de race antillaise (ex. \'Pollock\', \'Simmonds\'), tolérantes à la chaleur et à l\'humidité ; les races mexicaines/guatémaltèques supportent mal le climat équatorial. Récolte principale j' },
      { zone: 'tropical_antilles', semaineSemis: 25, semaineRecolte: 26, dureeRecolte: 16, dureeCulture: 1095, espacement: 700, notes: 'Privilégier la race antillaise (tolérante à la chaleur et à l\'humidité) plutôt que mexicaine. Récolte juin-octobre (S26-42), en hivernage. Plantation début hivernage. Craint l\'asphyxie racinaire : sol drainant.' },
      { zone: 'tropical_austral', semaineSemis: 46, semainePlantation: 46, semaineRecolte: 16, dureeRecolte: 20, dureeCulture: 1460, espacement: 700, notes: 'À la Réunion, la récolte s\'étale sur l\'hiver austral (avril à septembre) selon les variétés, ce qui approvisionne le marché à contre-saison de l\'hémisphère nord. Plantation en début de pluies sur sol drainant, à l\'abri d' }
    ],
  },
  {
    nom: 'Bananier', nomLatin: 'Musa acuminata (AAA)', famille: 'Musaceae', type: 'arbre_fruitier',
    vivace: true, uniteRendement: 'kg_arbre', rendement: 25, besoinN: 5, besoinEau: 5,
    besoinFroid: 'aucun', modeSemis: 'rejet', couleur: '#e67e22',
    zonesAdaptees: ['equatorial'],
    itps: [
      { zone: 'equatorial', semaineSemis: 14, semainePlantation: 14, semaineRecolte: 8, dureeRecolte: 40, dureeCulture: 330, espacement: 280, notes: 'Plantation possible quasi toute l\'année ; caler l\'installation du rejet sur l\'entrée des pluies (avril) pour l\'enracinement. Après établissement, régimes échelonnés toute l\'année. Forte exigence en azote et potasse ; pai' }
    ],
  },
  {
    nom: 'Bananier plantain', nomLatin: 'Musa spp.', famille: 'Musaceae', type: 'arbre_fruitier',
    vivace: true, uniteRendement: 'kg_arbre', rendement: 25, besoinN: 4, besoinEau: 5,
    besoinFroid: 'aucun', modeSemis: 'tubercule', couleur: '#e67e22',
    zonesAdaptees: ['equatorial', 'tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'equatorial', semaineSemis: 14, semainePlantation: 14, semaineRecolte: 20, dureeRecolte: 40, dureeCulture: 390, espacement: 300, notes: 'Installer les rejets à l\'entrée des pluies (sem.14). Écartement plus large que le bananier dessert (pseudo-troncs plus hauts). Récolte du régime au stade \'grain plein\' avant maturité. Cultivars locaux robustes (\'Corne\', ' },
      { zone: 'tropical_antilles', semaineSemis: 24, semaineRecolte: 28, dureeRecolte: 52, dureeCulture: 390, espacement: 250, notes: 'Culture phare Guadeloupe/Martinique. Plantation idéale début hivernage (S24) pour couvrir la phase végétative gourmande en eau. Production continue toute l\'année une fois la bananeraie installée ; rendement indiqué par r' },
      { zone: 'tropical_austral', semaineSemis: 44, semainePlantation: 44, semaineRecolte: 40, dureeRecolte: 52, dureeCulture: 330, espacement: 250, notes: 'Production quasi continue à l\'échelle de la bananeraie : la semaine de récolte indiquée est théorique (10-12 mois après plantation). Plantation idéale en début de saison des pluies pour couvrir la phase de croissance. Fo' }
    ],
  },
  {
    nom: 'Carambole', nomLatin: 'Averrhoa carambola', famille: 'Oxalidaceae', type: 'arbre_fruitier',
    vivace: true, uniteRendement: 'kg_arbre', rendement: 80, besoinN: 3, besoinEau: 4,
    besoinFroid: 'aucun', modeSemis: 'greffe', couleur: '#e67e22',
    zonesAdaptees: ['equatorial', 'tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'equatorial', semaineSemis: 15, semainePlantation: 15, semaineRecolte: 18, dureeRecolte: 30, dureeCulture: 1095, espacement: 550, notes: 'Plusieurs flushes de floraison par an ; récolte étalée avec pics. Arbre très fertile une fois adulte (jusqu\'à 100 kg). Préférer variétés douces greffées. Fruits fragiles à récolter à maturité. Bien tolérant à l\'humidité ' },
      { zone: 'tropical_antilles', semaineSemis: 25, semaineRecolte: 30, dureeRecolte: 24, dureeCulture: 1095, espacement: 600, notes: 'Tropical, plusieurs cycles par an ; récolte étalée avec pics en hivernage. Fruits fragiles à récolter à maturité. Plantation début hivernage. Aime l\'humidité régulière.' },
      { zone: 'tropical_austral', semaineSemis: 46, semainePlantation: 46, semaineRecolte: 6, dureeRecolte: 20, dureeCulture: 900, espacement: 500, notes: 'Grâce à ses floraisons successives, la carambole produit sur une large fenêtre, avec un pic en fin d\'été / automne austral (fév.-mai). À installer à l\'abri du vent, en zone chaude et humide.' }
    ],
  },
  {
    nom: 'Cocotier', nomLatin: 'Cocos nucifera', famille: 'Arecaceae', type: 'arbre_fruitier',
    vivace: true, uniteRendement: 'kg_arbre', rendement: 60, besoinN: 3, besoinEau: 3,
    besoinFroid: 'aucun', modeSemis: 'graine_directe', couleur: '#e67e22',
    zonesAdaptees: ['tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'tropical_antilles', semaineSemis: 25, semaineRecolte: 1, dureeRecolte: 52, dureeCulture: 1825, espacement: 800, notes: 'Palmier littoral tolérant au sel et au vent, production continue (récolte étalée sur 52 semaines). Rendement en noix (~60-80 noix/an) exprimé en kg. Privilégier variétés naines pour l\'eau de coco. Plantation début hivern' },
      { zone: 'tropical_austral', semaineSemis: 46, semainePlantation: 46, semaineRecolte: 44, dureeRecolte: 52, dureeCulture: 2555, espacement: 800, notes: 'Production continue toute l\'année une fois adulte (la semaine de récolte est indicative). Espèce littorale par excellence de Polynésie, Wallis et Mayotte, tolérante au sel et au vent. Mise en place de la noix germée en d' }
    ],
  },
  {
    nom: 'Combava', nomLatin: 'Citrus hystrix', famille: 'Rutaceae', type: 'arbre_fruitier',
    vivace: true, uniteRendement: 'kg_arbre', rendement: 30, besoinN: 3, besoinEau: 3,
    besoinFroid: 'aucun', modeSemis: 'greffe', couleur: '#e67e22',
    zonesAdaptees: ['equatorial', 'tropical_austral'],
    itps: [
      { zone: 'equatorial', semaineSemis: 15, semainePlantation: 15, semaineRecolte: 40, dureeRecolte: 20, dureeCulture: 1095, espacement: 350, notes: 'Cultivé surtout pour ses feuilles bi-lobées et le zeste bosselé, bases de la cuisine créole et asiatique. Feuilles récoltées toute l\'année ; fruits en fin d\'année. Se conduit en arbuste taillé. Bien adapté à l\'humidité, ' },
      { zone: 'tropical_austral', semaineSemis: 46, semainePlantation: 46, semaineRecolte: 10, dureeRecolte: 16, dureeCulture: 900, espacement: 400, notes: 'Fruits surtout en fin d\'été / automne austral (mars-juin), feuilles cueillies toute l\'année. Agrume rustique de basse et moyenne altitude, incontournable à la Réunion et présent à Mayotte et N.-Calédonie.' }
    ],
  },
  {
    nom: 'Corossol', nomLatin: 'Annona muricata', famille: 'Annonaceae', type: 'arbre_fruitier',
    vivace: true, uniteRendement: 'kg_arbre', rendement: 30, besoinN: 3, besoinEau: 4,
    besoinFroid: 'aucun', modeSemis: 'plant_repique', couleur: '#e67e22',
    zonesAdaptees: ['equatorial', 'tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'equatorial', semaineSemis: 15, semainePlantation: 15, semaineRecolte: 26, dureeRecolte: 24, dureeCulture: 1095, espacement: 450, notes: 'L\'Annona la mieux adaptée aux climats chauds et humides (contrairement au cœur de bœuf/pomme-cannelle qui préfèrent une saison sèche). Pollinisation manuelle recommandée. Sensible aux cochenilles et à la foreuse des grai' },
      { zone: 'tropical_antilles', semaineSemis: 25, semaineRecolte: 36, dureeRecolte: 20, dureeCulture: 1095, espacement: 500, notes: 'Strictement tropical, gélif, aime chaleur et humidité constantes. Pic de récolte fin hivernage-carême (S36-4). Sensible aux cochenilles/foreurs. Plantation début hivernage.' },
      { zone: 'tropical_austral', semaineSemis: 44, semainePlantation: 44, semaineRecolte: 2, dureeRecolte: 16, dureeCulture: 1095, espacement: 400, notes: 'Pic de récolte en été austral et début d\'automne (janv.-avril). Vrai tropical frileux : réserver aux zones chaudes de basse altitude (littoral Réunion, Mayotte, N.-Calédonie). Pollinisation à la main recommandée en verge' }
    ],
  },
  {
    nom: 'Goyavier', nomLatin: 'Psidium guajava', famille: 'Myrtaceae', type: 'arbre_fruitier',
    vivace: true, uniteRendement: 'kg_arbre', rendement: 40, besoinN: 3, besoinEau: 3,
    besoinFroid: 'aucun', modeSemis: 'bouture', couleur: '#e67e22',
    zonesAdaptees: ['equatorial', 'tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'equatorial', semaineSemis: 15, semainePlantation: 15, semaineRecolte: 30, dureeRecolte: 20, dureeCulture: 730, espacement: 450, notes: 'Plantation entrée des pluies. Une taille de fructification permet de concentrer la récolte ; sinon production étalée. Pointe principale après la grande saison des pluies (juillet-septembre). Surveiller la mouche des frui' },
      { zone: 'tropical_antilles', semaineSemis: 25, semaineRecolte: 40, dureeRecolte: 12, dureeCulture: 730, espacement: 500, notes: 'Très rustique, tolère sécheresse et sols pauvres, tend à se naturaliser. Pic de récolte souvent en fin d\'hivernage/entrée carême (S40-2). Plantation début hivernage.' },
      { zone: 'tropical_austral', semaineSemis: 44, semainePlantation: 44, semaineRecolte: 20, dureeRecolte: 14, dureeCulture: 730, espacement: 450, notes: 'Récolte principale sur l\'hiver austral (mai-août). Espèce rustique tolérant sécheresse et sols pauvres, mais gourmande en eau pour de gros fruits. Attention au caractère envahissant du goyavier (surtout goyavier de Chine' }
    ],
  },
  {
    nom: 'Jacquier', nomLatin: 'Artocarpus heterophyllus', famille: 'Moraceae', type: 'arbre_fruitier',
    vivace: true, uniteRendement: 'kg_arbre', rendement: 150, besoinN: 3, besoinEau: 4,
    besoinFroid: 'aucun', modeSemis: 'greffe', couleur: '#e67e22',
    zonesAdaptees: ['equatorial'],
    itps: [
      { zone: 'equatorial', semaineSemis: 15, semainePlantation: 15, semaineRecolte: 2, dureeRecolte: 18, dureeCulture: 1825, espacement: 1000, notes: 'Très grand arbre : prévoir 10-12 m et sol profond drainé. Fruits énormes portés sur le tronc, récolte principale déc-avril. Greffage conseillé pour typer la variété et raccourcir la mise à fruit. Bien présent dans les ja' }
    ],
  },
  {
    nom: 'Letchi', nomLatin: 'Litchi chinensis', famille: 'Sapindaceae', type: 'arbre_fruitier',
    vivace: true, uniteRendement: 'kg_arbre', rendement: 80, besoinN: 3, besoinEau: 3,
    besoinFroid: 'modere', modeSemis: 'bouture', couleur: '#e67e22',
    zonesAdaptees: ['tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'tropical_antilles', semaineSemis: 25, semaineRecolte: 22, dureeRecolte: 5, dureeCulture: 1460, espacement: 800, notes: 'Culture marginale/de niche aux Antilles : demande un carême frais (idéalement >300 m) pour fleurir. Récolte courte et concentrée mai-juillet (S20-28). Sensible aux cyclones d\'hivernage.' },
      { zone: 'tropical_austral', semaineSemis: 44, semainePlantation: 44, semaineRecolte: 47, dureeRecolte: 8, dureeCulture: 1825, espacement: 800, notes: 'Fruit emblématique de Noël à La Réunion : récolte concentrée mi-novembre à mi-janvier (pic mi-décembre). Plantation en début de saison des pluies. L\'induction florale dépend d\'un hiver austral bien marqué en fraîcheur — ' }
    ],
  },
  {
    nom: 'Lime de Tahiti', nomLatin: 'Citrus latifolia', famille: 'Rutaceae', type: 'arbre_fruitier',
    vivace: true, uniteRendement: 'kg_arbre', rendement: 40, besoinN: 3, besoinEau: 3,
    besoinFroid: 'aucun', modeSemis: 'greffe', couleur: '#e67e22',
    zonesAdaptees: ['equatorial', 'tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'equatorial', semaineSemis: 15, semainePlantation: 15, semaineRecolte: 22, dureeRecolte: 30, dureeCulture: 1095, espacement: 450, notes: 'Le lime (limettier) est l\'agrume le plus adapté aux basses terres tropicales humides (plus que l\'oranger). Greffer sur porte-greffe résistant à Phytophthora/gommose. Production remontante quasi continue. Surveiller le ch' },
      { zone: 'tropical_antilles', semaineSemis: 25, semaineRecolte: 26, dureeRecolte: 24, dureeCulture: 1095, espacement: 500, notes: 'Agrume tropical sans épines/sans pépins, remontant : production quasi continue, pic en hivernage. Alternative aromatique : le combava (Citrus hystrix) pour la feuille et le zeste. Attention au HLB/greening : plants certi' },
      { zone: 'tropical_austral', semaineSemis: 46, semainePlantation: 46, semaineRecolte: 8, dureeRecolte: 24, dureeCulture: 900, espacement: 500, notes: 'Production étalée sur une large fenêtre grâce à sa remontée, avec un pic en été/automne austral. Agrume tropical de basse altitude, bien adapté aux littoraux de la Réunion, N.-Calédonie et Polynésie.' }
    ],
  },
  {
    nom: 'Longane', nomLatin: 'Dimocarpus longan', famille: 'Sapindaceae', type: 'arbre_fruitier',
    vivace: true, uniteRendement: 'kg_arbre', rendement: 70, besoinN: 3, besoinEau: 3,
    besoinFroid: 'faible', modeSemis: 'bouture', couleur: '#e67e22',
    zonesAdaptees: ['tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'tropical_antilles', semaineSemis: 25, semaineRecolte: 32, dureeRecolte: 6, dureeCulture: 1095, espacement: 800, notes: 'Plus fiable que le letchi en plaine antillaise. Récolte fin d\'hivernage août-septembre (S32-38). Plantation début hivernage. Pluvio 1200-2000 mm.' },
      { zone: 'tropical_austral', semaineSemis: 44, semainePlantation: 44, semaineRecolte: 6, dureeRecolte: 8, dureeCulture: 1825, espacement: 800, notes: 'Récolte juste après le letchi : février-mars (fin d\'été austral), ce qui étale l\'offre de fruits Sapindaceae. Plantation en début de pluies. Bien adapté aux mi-pentes de la Réunion et de N.-Calédonie.' }
    ],
  },
  {
    nom: 'Manguier', nomLatin: 'Mangifera indica', famille: 'Anacardiaceae', type: 'arbre_fruitier',
    vivace: true, uniteRendement: 'kg_arbre', rendement: 80, besoinN: 3, besoinEau: 3,
    besoinFroid: 'faible', modeSemis: 'greffe', couleur: '#e67e22',
    zonesAdaptees: ['equatorial', 'tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'equatorial', semaineSemis: 15, semainePlantation: 15, semaineRecolte: 50, dureeRecolte: 12, dureeCulture: 1095, espacement: 900, notes: 'Plantation début grande saison des pluies (avril, sem.15). Récolte principale novembre-janvier, après floraison de saison sèche. Préférer variétés greffées type \'Julie\', \'Amélie\', \'Cambodgienne\' peu sensibles à l\'anthrac' },
      { zone: 'tropical_antilles', semaineSemis: 25, semaineRecolte: 22, dureeRecolte: 12, dureeCulture: 1095, espacement: 900, notes: 'Zone Antilles (hémisphère NORD, PAS d\'inversion). Plantation en début d\'hivernage (mi-juin, ~S25) pour établissement sous les pluies. Récolte principale juin-août (S22-34) après induction florale du carême. De 0 à 400 m,' },
      { zone: 'tropical_austral', semaineSemis: 46, semainePlantation: 46, semaineRecolte: 48, dureeRecolte: 12, dureeCulture: 1460, espacement: 900, notes: 'Réunion / N.-Calédonie : plantation en début de saison des pluies (novembre). Récolte de plein été austral (fin novembre à février). L\'hiver austral sec et frais déclenche la floraison ; irrigation d\'appoint au grossisse' }
    ],
  },
  {
    nom: 'Papayer', nomLatin: 'Carica papaya', famille: 'Caricaceae', type: 'arbre_fruitier',
    vivace: true, uniteRendement: 'kg_arbre', rendement: 40, besoinN: 4, besoinEau: 4,
    besoinFroid: 'aucun', modeSemis: 'plant_repique', couleur: '#e67e22',
    zonesAdaptees: ['equatorial', 'tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'equatorial', semaineSemis: 8, semainePlantation: 15, semaineRecolte: 46, dureeRecolte: 40, dureeCulture: 270, espacement: 250, notes: 'Semis pépinière fin de petit été de mars (sem.8), repiquage à l\'entrée des grandes pluies (sem.15). Récolte continue à partir de ~9 mois. Très sensible à l\'excès d\'eau au collet (pourritures) : planter sur billon ou butt' },
      { zone: 'tropical_antilles', semaineSemis: 22, semaineRecolte: 10, dureeRecolte: 40, dureeCulture: 300, espacement: 250, notes: 'Semis/repiquage début hivernage (S22) ; premières papayes ~10 mois plus tard, en carême. Cultiver des pieds hermaphrodites ou en mélange pour la pollinisation. Sensible au vent (cyclones) et à l\'excès d\'eau.' },
      { zone: 'tropical_austral', semaineSemis: 36, semainePlantation: 40, semaineRecolte: 27, dureeRecolte: 52, dureeCulture: 300, espacement: 250, notes: 'Semis en fin d\'hiver austral (sept.) pour repiquage au retour des pluies (oct.-nov.) ; premiers fruits l\'été austral suivant, puis récolte continue toute l\'année sur pied en production. Renouveler la parcelle tous les 2-' }
    ],
  },
  {
    nom: 'Ramboutan', nomLatin: 'Nephelium lappaceum', famille: 'Sapindaceae', type: 'arbre_fruitier',
    vivace: true, uniteRendement: 'kg_arbre', rendement: 60, besoinN: 3, besoinEau: 4,
    besoinFroid: 'aucun', modeSemis: 'greffe', couleur: '#e67e22',
    zonesAdaptees: ['equatorial'],
    itps: [
      { zone: 'equatorial', semaineSemis: 15, semainePlantation: 15, semaineRecolte: 48, dureeRecolte: 10, dureeCulture: 1460, espacement: 900, notes: 'Contrairement au letchi et au longane, qui exigent un hiver frais et sec (absent en Guyane) pour fleurir, le ramboutan est un vrai équatorial qui fructifie sans froid : c\'est LE Sapindaceae à privilégier ici. Récolte pri' }
    ],
  },
  {
    nom: 'Tamarinier', nomLatin: 'Tamarindus indica', famille: 'Fabaceae', type: 'arbre_fruitier',
    vivace: true, uniteRendement: 'kg_arbre', rendement: 150, besoinN: 2, besoinEau: 2,
    besoinFroid: 'aucun', modeSemis: 'greffe', couleur: '#e67e22',
    zonesAdaptees: ['tropical_antilles'],
    itps: [
      { zone: 'tropical_antilles', semaineSemis: 25, semaineRecolte: 8, dureeRecolte: 10, dureeCulture: 1460, espacement: 1100, notes: 'Arbre rustique très tolérant à la sécheresse, adapté aux zones sèches sous le vent (Grande-Terre, sud Martinique). Récolte des gousses mûres en plein carême (février-avril, S6-17). Croissance lente. Plantation début hive' }
    ],
  },
  {
    nom: 'Vanille', nomLatin: 'Vanilla planifolia', famille: 'Orchidaceae', type: 'arbre_fruitier',
    vivace: true, uniteRendement: 'kg_arbre', rendement: 0.8, besoinN: 2, besoinEau: 3,
    besoinFroid: 'aucun', modeSemis: 'bouture', couleur: '#e67e22',
    zonesAdaptees: ['tropical_austral'],
    itps: [
      { zone: 'tropical_austral', semaineSemis: 40, semainePlantation: 40, semaineRecolte: 26, dureeRecolte: 8, dureeCulture: 1095, espacement: 150, notes: 'Rendement en gousses vertes par liane. Bouturage au retour des pluies (oct.-nov.), floraison au printemps austral (sept.-nov.) à polliniser à la main, gousses vertes récoltées ~8-9 mois plus tard en hiver austral (juin-a' }
    ],
  },
  {
    nom: 'Acérola (cerise des Antilles)', nomLatin: 'Malpighia emarginata', famille: 'Malpighiaceae', type: 'petit_fruit',
    vivace: true, uniteRendement: 'kg_m2', rendement: 15, besoinN: 2, besoinEau: 3,
    besoinFroid: 'aucun', modeSemis: 'bouture', couleur: '#c0392b',
    zonesAdaptees: ['equatorial'],
    itps: [
      { zone: 'equatorial', semaineSemis: 15, semainePlantation: 15, semaineRecolte: 24, dureeRecolte: 16, dureeCulture: 365, espacement: 300, notes: 'Plaine littorale de Guyane, chaleur et humidité constantes. Plantation de boutures en début des pluies (avril, ~sem. 15). Plusieurs flushs de fructification par an ; pic principal après les fortes pluies (juin-sept.), dé' }
    ],
  },
  {
    nom: 'Ananas', nomLatin: 'Ananas comosus', famille: 'Bromeliaceae', type: 'petit_fruit',
    vivace: true, uniteRendement: 'kg_m2', rendement: 5, besoinN: 3, besoinEau: 2,
    besoinFroid: 'aucun', modeSemis: 'bouture', couleur: '#c0392b',
    zonesAdaptees: ['equatorial', 'tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'equatorial', semaineSemis: 16, semainePlantation: 16, semaineRecolte: 32, dureeRecolte: 6, dureeCulture: 500, espacement: 35, notes: 'Guyane, plaine littorale (0-50 m), sols ferralitiques acides bien drainés, pluvio 2500-3500 mm/an. Plantation des rejets en début de grande saison des pluies (avril, ~sem. 16) pour un bon enracinement. La floraison natur' },
      { zone: 'tropical_antilles', semaineSemis: 24, semainePlantation: 24, semaineRecolte: 26, dureeRecolte: 8, dureeCulture: 600, espacement: 40, notes: 'Plantation des rejets en début d\'hivernage (juin, sem. 24) pour profiter des pluies d\'installation ; enracinement facile sans arrosage lourd. Floraison naturelle pendant le carême frais (déc.-janv.), récolte l\'année suiv' },
      { zone: 'tropical_austral', semaineSemis: 42, semainePlantation: 42, semaineRecolte: 49, dureeRecolte: 6, dureeCulture: 510, espacement: 35, notes: 'Plantation des rejets en début de saison chaude et humide (octobre, S42) pour un enracinement avant les pluies d\'été. Récolte principale de l\'ananas Victoria groupée en été austral (novembre-janvier, pic S49) 15 à 18 moi' }
    ],
  },
  {
    nom: 'Fraise d\'altitude', nomLatin: 'Fragaria x ananassa', famille: 'Rosaceae', type: 'petit_fruit',
    vivace: true, uniteRendement: 'kg_m2', rendement: 0.8, besoinN: 2, besoinEau: 4,
    besoinFroid: 'modere', modeSemis: 'plant_repique', couleur: '#c0392b',
    zonesAdaptees: ['tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'tropical_antilles', semaineSemis: 40, semainePlantation: 40, semaineRecolte: 2, dureeRecolte: 10, dureeCulture: 100, espacement: 30, notes: 'À réserver aux zones d\'altitude (Morne-Rouge / flancs de la Pelée en Martinique, hauteurs de Basse-Terre en Guadeloupe, > 400-500 m). Plantation des plants en début de carême (oct., sem. 40) ; la fructification profite d' },
      { zone: 'tropical_austral', semaineSemis: 14, semainePlantation: 14, semaineRecolte: 38, dureeRecolte: 10, dureeCulture: 150, espacement: 30, notes: 'Plantation des stolons en automne austral (avril, S14), pendant la fraîcheur qui favorise l\'enracinement et l\'induction florale. Récolte au printemps austral (septembre-novembre, pic S38). RÉSERVÉE À L\'ALTITUDE >1000 m (' }
    ],
  },
  {
    nom: 'Fruit de la passion', nomLatin: 'Passiflora edulis', famille: 'Passifloraceae', type: 'petit_fruit',
    vivace: true, uniteRendement: 'kg_m2', rendement: 2.5, besoinN: 3, besoinEau: 4,
    besoinFroid: 'faible', modeSemis: 'plant_repique', couleur: '#c0392b',
    zonesAdaptees: ['equatorial', 'tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'equatorial', semaineSemis: 8, semainePlantation: 15, semaineRecolte: 38, dureeRecolte: 20, dureeCulture: 210, espacement: 300, notes: 'Semis fin de petit été de mars (sem.8), repiquage au pied de la palissade à l\'entrée des pluies. Conduite sur treille/fil de fer. Le maracudja jaune (f. flavicarpa) est le mieux adapté aux basses terres tropicales. Sensi' },
      { zone: 'tropical_antilles', semaineSemis: 22, semaineRecolte: 4, dureeRecolte: 20, dureeCulture: 240, espacement: 300, notes: 'Plantation sur treillage début hivernage (S22). Pic de récolte fin hivernage/carême (S32-4). Rendement indiqué par pied/liane. Renouveler tous les 3-4 ans ; la forme jaune (f. flavicarpa) est la mieux adaptée à la plaine' },
      { zone: 'tropical_austral', semaineSemis: 40, semainePlantation: 44, semaineRecolte: 8, dureeRecolte: 24, dureeCulture: 300, espacement: 250, notes: 'Rendement exprimé par m² de palissage. Plantation au retour des pluies (nov.), premier pic de récolte en fin d\'été / automne austral (fév.-juin). La grenadille pourpre convient aux hauteurs plus fraîches de la Réunion, l' }
    ],
  },
  {
    nom: 'Goyavier de Chine (goyave-fraise)', nomLatin: 'Psidium cattleianum', famille: 'Myrtaceae', type: 'petit_fruit',
    vivace: true, uniteRendement: 'kg_m2', rendement: 2, besoinN: 2, besoinEau: 3,
    besoinFroid: 'faible', modeSemis: 'bouture', couleur: '#c0392b',
    zonesAdaptees: ['equatorial', 'tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'equatorial', semaineSemis: 15, semainePlantation: 15, semaineRecolte: 40, dureeRecolte: 8, dureeCulture: 730, espacement: 250, notes: 'Plaine guyanaise, sols acides humides. Plantation en début de grande saison des pluies (avril, ~sem. 15) pour l\'installation. Fructification principale en fin de saison des pluies / début de saison sèche (sept.-oct., ~se' },
      { zone: 'tropical_antilles', semaineSemis: 24, semainePlantation: 24, semaineRecolte: 34, dureeRecolte: 8, dureeCulture: 730, espacement: 250, notes: 'Plantation des jeunes plants en début d\'hivernage (juin, sem. 24) pour une reprise sous les pluies. Fructification de l\'arbuste établi en pleine saison humide (août-sept., sem. 34) sur les mornes frais et arrosés. Rustiq' },
      { zone: 'tropical_austral', semaineSemis: 42, semainePlantation: 42, semaineRecolte: 20, dureeRecolte: 8, dureeCulture: 365, espacement: 200, notes: 'Plantation en début de saison chaude (octobre, S42) pour profiter des pluies d\'établissement. Récolte de l\'arbuste installé en hiver austral (mai-juillet, S20) — la célèbre saison du "goyavier" des hauts réunionnais. Mi-' }
    ],
  },
  {
    nom: 'Oseille de Guinée (roselle)', nomLatin: 'Hibiscus sabdariffa', famille: 'Malvaceae', type: 'petit_fruit',
    vivace: false, uniteRendement: 'kg_m2', rendement: 0.8, besoinN: 2, besoinEau: 3,
    besoinFroid: 'aucun', modeSemis: 'graine_directe', couleur: '#c0392b',
    zonesAdaptees: ['equatorial', 'tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'equatorial', semaineSemis: 18, semaineRecolte: 46, dureeRecolte: 6, dureeCulture: 185, espacement: 80, notes: 'Culture créole traditionnelle en Guyane. Semis direct en début de grande saison des pluies (mai, ~sem. 18) : la plante fait toute sa croissance végétative pendant l\'hivernage. Floraison de jours courts vers oct.-nov., ré' },
      { zone: 'tropical_antilles', semaineSemis: 26, semaineRecolte: 48, dureeRecolte: 4, dureeCulture: 155, espacement: 90, notes: 'Semis en début d\'hivernage (fin juin-juillet, sem. 26) : la plante bénéficie des pluies pour sa croissance végétative, puis fleurit à l\'entrée du carême quand les jours raccourcissent. Récolte des calices en nov.-déc. (s' },
      { zone: 'tropical_austral', semaineSemis: 46, semaineRecolte: 20, dureeRecolte: 6, dureeCulture: 180, espacement: 90, notes: 'Semis direct en début de saison chaude et pluvieuse (novembre, S46) pour une croissance végétative maximale pendant l\'été austral. La floraison se déclenche naturellement quand les jours raccourcissent (mars-avril) ; réc' }
    ],
  },
  {
    nom: 'Aubergine', nomLatin: 'Solanum melongena', famille: 'Solanaceae', type: 'legume',
    vivace: false, uniteRendement: 'kg_m2', rendement: 3, besoinN: 4, besoinEau: 4,
    besoinFroid: 'aucun', modeSemis: 'plant_repique', couleur: '#27ae60',
    zonesAdaptees: ['tropical_antilles'],
    itps: [
      { zone: 'tropical_antilles', semaineSemis: 6, semaineRecolte: 20, dureeRecolte: 12, dureeCulture: 100, espacement: 60, notes: 'Semis en pépinière en carême, repiquage à l\'entrée des pluies pour une production étalée sur l\'hivernage. Culture gourmande en azote et en eau ; forte pression des ravageurs (doryphore tropical, acariens, mouches) à surv' }
    ],
  },
  {
    nom: 'Brède mafane', nomLatin: 'Acmella oleracea', famille: 'Asteraceae', type: 'legume',
    vivace: false, uniteRendement: 'kg_m2', rendement: 2, besoinN: 3, besoinEau: 3,
    besoinFroid: 'aucun', modeSemis: 'plant_repique', couleur: '#27ae60',
    zonesAdaptees: ['equatorial', 'tropical_austral'],
    itps: [
      { zone: 'equatorial', semaineSemis: 10, semainePlantation: 14, semaineRecolte: 20, dureeRecolte: 8, dureeCulture: 55, espacement: 30, notes: 'Semis/repiquage en saison humide (mars-avril) sur sol frais et riche en matière organique ; besoins en eau réguliers. Cultivable toute l\'année si arrosage. Récolte échelonnée des jeunes feuilles et capitules.' },
      { zone: 'tropical_austral', semaineSemis: 38, semainePlantation: 42, semaineRecolte: 48, dureeRecolte: 4, dureeCulture: 60, espacement: 25, notes: 'Semis quasi toute l\'année en zone chaude ; croissance plus vigoureuse à la saison chaude. Récolte rapide des feuilles et capitules. Aime les sols frais et riches en matière organique ; arroser régulièrement en saison sèc' }
    ],
  },
  {
    nom: 'Brède morelle', nomLatin: 'Solanum americanum', famille: 'Solanaceae', type: 'legume',
    vivace: false, uniteRendement: 'kg_m2', rendement: 2, besoinN: 3, besoinEau: 3,
    besoinFroid: 'aucun', modeSemis: 'graine_directe', couleur: '#27ae60',
    zonesAdaptees: ['tropical_austral'],
    itps: [
      { zone: 'tropical_austral', semaineSemis: 42, semaineRecolte: 50, dureeRecolte: 6, dureeCulture: 50, espacement: 30, notes: 'Semis échelonnés possibles quasi toute l\'année ; démarrage plus rapide en saison chaude. Récolte des feuilles avant montaison ; ne consommer que les feuilles cuites (baies vertes toxiques). Se ressème seule facilement da' }
    ],
  },
  {
    nom: 'Dachine (taro)', nomLatin: 'Colocasia esculenta', famille: 'Araceae', type: 'legume',
    vivace: false, uniteRendement: 'kg_m2', rendement: 2.5, besoinN: 3, besoinEau: 5,
    besoinFroid: 'aucun', modeSemis: 'tubercule', couleur: '#27ae60',
    zonesAdaptees: ['equatorial', 'tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'equatorial', semaineSemis: 14, semainePlantation: 14, semaineRecolte: 50, dureeRecolte: 8, dureeCulture: 245, espacement: 70, notes: 'Plantation à l\'entrée de la grande saison des pluies (avril) pour couvrir les besoins hydriques élevés ; récolte au retour des pluies suivant (décembre). Idéal en bas-fond humide ou bordure de crique. Sans irrigation, év' },
      { zone: 'tropical_antilles', semaineSemis: 22, semaineRecolte: 12, dureeRecolte: 6, dureeCulture: 270, espacement: 70, notes: 'Plantation dès le début de l\'hivernage (juin) pour couvrir les besoins en eau élevés ; récolte en fin d\'hivernage/début carême. Idéal en zone humide de basse et moyenne altitude, sols riches en matière organique. Irrigat' },
      { zone: 'tropical_austral', semaineSemis: 40, semainePlantation: 40, semaineRecolte: 18, dureeRecolte: 8, dureeCulture: 240, espacement: 60, notes: 'Plantation début de saison humide (octobre), récolte en début d\'hiver austral (mai). Exige de l\'eau en permanence : bas-fonds, bord de rivière ou irrigation. Les feuilles servent aussi de brède. Sensible au dépérissement' }
    ],
  },
  {
    nom: 'Épinard pays (amarante)', nomLatin: 'Amaranthus dubius', famille: 'Amaranthaceae', type: 'legume',
    vivace: false, uniteRendement: 'kg_m2', rendement: 2, besoinN: 3, besoinEau: 3,
    besoinFroid: 'aucun', modeSemis: 'graine_directe', couleur: '#27ae60',
    zonesAdaptees: ['equatorial'],
    itps: [
      { zone: 'equatorial', semaineSemis: 4, semainePlantation: 4, semaineRecolte: 10, dureeRecolte: 6, dureeCulture: 40, espacement: 25, notes: 'Semis échelonnés possibles toute l\'année ; en pleine saison des pluies, préférer des planches surélevées pour éviter la fonte des semis. Croissance très rapide sous la chaleur équatoriale. Surveiller les chenilles défoli' }
    ],
  },
  {
    nom: 'Giraumon', nomLatin: 'Cucurbita moschata', famille: 'Cucurbitaceae', type: 'legume',
    vivace: false, uniteRendement: 'kg_m2', rendement: 2, besoinN: 3, besoinEau: 3,
    besoinFroid: 'aucun', modeSemis: 'graine_directe', couleur: '#27ae60',
    zonesAdaptees: ['equatorial', 'tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'equatorial', semaineSemis: 48, semainePlantation: 48, semaineRecolte: 12, dureeRecolte: 6, dureeCulture: 110, espacement: 180, notes: 'Semis au retour des pluies (début novembre) ; les lianes couvrent le sol pendant la période humide et les fruits mûrissent vers le petit été de mars (février), plus sec, favorable à la conservation. Prévoir de grands éca' },
      { zone: 'tropical_antilles', semaineSemis: 16, semaineRecolte: 30, dureeRecolte: 4, dureeCulture: 100, espacement: 150, notes: 'Semis en fin de carême / début hivernage pour que floraison et nouaison précèdent les pluies les plus fortes (limite la pourriture des fruits). Ménager de larges espacements ; paillage pour garder les fruits propres.' },
      { zone: 'tropical_austral', semaineSemis: 46, semaineRecolte: 12, dureeRecolte: 4, dureeCulture: 130, espacement: 150, notes: 'Semis en début de saison des pluies (octobre), récolte en fin d\'été austral (mars). Prévoir 2-3 m² par pied (plante coureuse). Résiste mieux aux maladies que les courges tempérées. Les fruits mûrs se conservent plusieurs' }
    ],
  },
  {
    nom: 'Gombo', nomLatin: 'Abelmoschus esculentus', famille: 'Malvaceae', type: 'legume',
    vivace: false, uniteRendement: 'kg_m2', rendement: 1.2, besoinN: 3, besoinEau: 3,
    besoinFroid: 'aucun', modeSemis: 'graine_directe', couleur: '#27ae60',
    zonesAdaptees: ['equatorial', 'tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'equatorial', semaineSemis: 1, semainePlantation: 1, semaineRecolte: 10, dureeRecolte: 10, dureeCulture: 60, espacement: 50, notes: 'Semis en saison des pluies (janvier) pour une croissance vigoureuse ; récolte étalée à partir de mars. Cultivable quasiment toute l\'année sous irrigation. Récolter les capsules jeunes (8-10 cm) pour éviter la fibrosité.' },
      { zone: 'tropical_antilles', semaineSemis: 22, semaineRecolte: 32, dureeRecolte: 10, dureeCulture: 70, espacement: 50, notes: 'Semis à l\'entrée de l\'hivernage : chaleur et pluies favorisent une croissance rapide et une longue période de cueillette. Sensible aux nématodes (rotation) ; cueillette rapprochée obligatoire.' },
      { zone: 'tropical_austral', semaineSemis: 46, semaineRecolte: 4, dureeRecolte: 10, dureeCulture: 60, espacement: 50, notes: 'Semis en début d\'été austral (novembre) sur sol réchauffé, récolte à partir de janvier et durant tout l\'été. Cueillette tous les 2-3 jours des capsules de 6-8 cm (durcissent vite). Exige chaleur soutenue ; peu productif ' }
    ],
  },
  {
    nom: 'Igname', nomLatin: 'Dioscorea alata', famille: 'Dioscoreaceae', type: 'legume',
    vivace: false, uniteRendement: 'kg_m2', rendement: 2.5, besoinN: 2, besoinEau: 3,
    besoinFroid: 'aucun', modeSemis: 'tubercule', couleur: '#27ae60',
    zonesAdaptees: ['tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'tropical_antilles', semaineSemis: 12, semaineRecolte: 2, dureeRecolte: 4, dureeCulture: 285, espacement: 80, notes: 'Plantation en fin de carême (mars-avril) pour profiter de tout l\'hivernage en végétation ; récolte en saison sèche de fin d\'année quand le feuillage jaunit. Sols profonds, meubles et drainés (mornes, jardins créoles). Cr' },
      { zone: 'tropical_austral', semaineSemis: 39, semainePlantation: 39, semaineRecolte: 28, dureeRecolte: 6, dureeCulture: 270, espacement: 100, notes: 'Plantation en fin septembre-octobre, au démarrage des pluies de l\'été austral. Récolte en hiver austral sec (juin-août) quand les fanes ont séché. Buttes ou billons + tuteur/treillage indispensables. Convient jusqu\'à 600' }
    ],
  },
  {
    nom: 'Igname couche-couche', nomLatin: 'Dioscorea trifida', famille: 'Dioscoreaceae', type: 'legume',
    vivace: false, uniteRendement: 'kg_m2', rendement: 2, besoinN: 3, besoinEau: 3,
    besoinFroid: 'aucun', modeSemis: 'tubercule', couleur: '#27ae60',
    zonesAdaptees: ['equatorial'],
    itps: [
      { zone: 'equatorial', semaineSemis: 48, semainePlantation: 48, semaineRecolte: 38, dureeRecolte: 8, dureeCulture: 270, espacement: 80, notes: 'Plantation au retour des pluies (décembre) pour que la liane s\'installe pendant la grande saison des pluies. Récolte en saison sèche (septembre-octobre) après jaunissement du feuillage. Sols meubles et bien drainés en bu' }
    ],
  },
  {
    nom: 'Madère (tania)', nomLatin: 'Xanthosoma sagittifolium', famille: 'Araceae', type: 'legume',
    vivace: false, uniteRendement: 'kg_m2', rendement: 3, besoinN: 3, besoinEau: 4,
    besoinFroid: 'aucun', modeSemis: 'tubercule', couleur: '#27ae60',
    zonesAdaptees: ['equatorial', 'tropical_antilles'],
    itps: [
      { zone: 'equatorial', semaineSemis: 48, semainePlantation: 48, semaineRecolte: 44, dureeRecolte: 10, dureeCulture: 305, espacement: 100, notes: 'Plantation au retour des pluies (décembre), croissance sur toute la saison humide, récolte en fin de saison sèche (octobre-novembre). Contrairement au taro, supporte les terres hautes de savane ou de barre du littoral sa' },
      { zone: 'tropical_antilles', semaineSemis: 24, semaineRecolte: 18, dureeRecolte: 6, dureeCulture: 300, espacement: 80, notes: 'Plantation à l\'entrée de l\'hivernage ; récolte en carême quand le feuillage dépérit. Supporte mieux le ressuyage que la dachine, donc adapté aux terres de mi-pente. Buttage pour favoriser les cormeaux.' }
    ],
  },
  {
    nom: 'Manioc', nomLatin: 'Manihot esculenta', famille: 'Euphorbiaceae', type: 'legume',
    vivace: false, uniteRendement: 'kg_m2', rendement: 3, besoinN: 1, besoinEau: 2,
    besoinFroid: 'aucun', modeSemis: 'bouture', couleur: '#27ae60',
    zonesAdaptees: ['equatorial', 'tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'equatorial', semaineSemis: 47, semainePlantation: 47, semaineRecolte: 40, dureeRecolte: 16, dureeCulture: 305, espacement: 100, notes: 'Plantation des boutures au retour des pluies (fin novembre-décembre) sur les sols bien drainés du littoral (2500-3500 mm/an). Récolte échelonnée à partir d\'octobre, en saison sèche, quand le sol se travaille facilement. ' },
      { zone: 'tropical_antilles', semaineSemis: 24, semaineRecolte: 16, dureeRecolte: 8, dureeCulture: 300, espacement: 100, notes: 'Bouturage à l\'entrée de l\'hivernage (juin) pour un enracinement sous les pluies ; récolte en carême suivant, sol sec plus facile à arracher. Extrêmement tolérant à la sécheresse une fois établi, valorise les sols pauvres' },
      { zone: 'tropical_austral', semaineSemis: 46, semainePlantation: 46, semaineRecolte: 40, dureeRecolte: 12, dureeCulture: 330, espacement: 100, notes: 'Boutures plantées en début de saison des pluies (novembre-décembre). Récolte échelonnée à partir de 10-11 mois ; les racines se conservent en terre. Variétés douces pour consommation directe, amères à détoxifier. Peu exi' }
    ],
  },
  {
    nom: 'Margose (concombre amer)', nomLatin: 'Momordica charantia', famille: 'Cucurbitaceae', type: 'legume',
    vivace: false, uniteRendement: 'kg_m2', rendement: 1.8, besoinN: 3, besoinEau: 3,
    besoinFroid: 'aucun', modeSemis: 'graine_directe', couleur: '#27ae60',
    zonesAdaptees: ['equatorial', 'tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'equatorial', semaineSemis: 6, semainePlantation: 6, semaineRecolte: 16, dureeRecolte: 8, dureeCulture: 65, espacement: 80, notes: 'Semis en saison des pluies (février) et palissage sur treillage pour aérer le feuillage et limiter les maladies fongiques favorisées par l\'humidité. Cultivable toute l\'année sous irrigation. Récolter les fruits jeunes et' },
      { zone: 'tropical_antilles', semaineSemis: 20, semaineRecolte: 30, dureeRecolte: 10, dureeCulture: 70, espacement: 80, notes: 'Semis en entrée d\'hivernage sous treillage pour aérer le feuillage et limiter les maladies fongiques favorisées par l\'humidité. Sensible aux mouches des fruits (ensachage/pièges). Possible aussi en carême sous irrigation' },
      { zone: 'tropical_austral', semaineSemis: 44, semaineRecolte: 2, dureeRecolte: 8, dureeCulture: 70, espacement: 80, notes: 'Semis en début d\'été austral (novembre), récolte de janvier à mars. Treillage vertical obligatoire. Récolter les fruits encore verts (moins amers). Chaleur et humidité de l\'été austral idéales ; sensible aux mouches des ' }
    ],
  },
  {
    nom: 'Patate douce', nomLatin: 'Ipomoea batatas', famille: 'Convolvulaceae', type: 'legume',
    vivace: false, uniteRendement: 'kg_m2', rendement: 2.5, besoinN: 1, besoinEau: 2,
    besoinFroid: 'aucun', modeSemis: 'bouture', couleur: '#27ae60',
    zonesAdaptees: ['equatorial', 'tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'equatorial', semaineSemis: 22, semainePlantation: 22, semaineRecolte: 40, dureeRecolte: 6, dureeCulture: 130, espacement: 40, notes: 'Plantation en fin de grande saison des pluies (fin mai-juin) pour que la tubérisation se fasse en conditions plus sèches (récolte en octobre, saison sèche). Un excès d\'azote ou d\'eau favorise le feuillage au détriment de' },
      { zone: 'tropical_antilles', semaineSemis: 38, semaineRecolte: 4, dureeRecolte: 4, dureeCulture: 135, espacement: 35, notes: 'Bouturage en fin d\'hivernage (septembre) : la culture profite de l\'humidité résiduelle puis grossit et se récolte en carême, où les tubercules se conservent mieux (moins de pourriture). Éviter les excès d\'azote qui font ' },
      { zone: 'tropical_austral', semaineSemis: 45, semainePlantation: 45, semaineRecolte: 13, dureeRecolte: 6, dureeCulture: 140, espacement: 35, notes: 'Boutures plantées en début d\'été austral (novembre), récolte en fin d\'été (mars-avril). Éviter l\'excès d\'azote qui favorise les fanes au détriment des tubercules. Rustique, tolère la sécheresse une fois installée. Feuill' }
    ],
  },
  {
    nom: 'Piment antillais', nomLatin: 'Capsicum chinense', famille: 'Solanaceae', type: 'legume',
    vivace: true, uniteRendement: 'kg_m2', rendement: 2, besoinN: 3, besoinEau: 3,
    besoinFroid: 'aucun', modeSemis: 'plant_repique', couleur: '#27ae60',
    zonesAdaptees: ['equatorial', 'tropical_antilles'],
    itps: [
      { zone: 'equatorial', semaineSemis: 6, semainePlantation: 12, semaineRecolte: 25, dureeRecolte: 30, dureeCulture: 100, espacement: 60, notes: 'Semis en pépinière en février, repiquage vers mars sur sol drainant ; récolte étalée à partir de mai et sur plus de six mois, la plante restant productive plusieurs saisons. Surveiller la mouche des fruits et les puceron' },
      { zone: 'tropical_antilles', semaineSemis: 6, semaineRecolte: 24, dureeRecolte: 20, dureeCulture: 120, espacement: 60, notes: 'Semis en pépinière en carême (février), repiquage après les premières pluies ; production longue s\'étendant sur l\'hivernage et au-delà. Surveiller mouches des fruits et anthracnose en saison humide.' }
    ],
  },
  {
    nom: 'Pois d\'Angole', nomLatin: 'Cajanus cajan', famille: 'Fabaceae', type: 'legume',
    vivace: true, uniteRendement: 'kg_m2', rendement: 1, besoinN: 1, besoinEau: 2,
    besoinFroid: 'aucun', modeSemis: 'graine_directe', couleur: '#27ae60',
    zonesAdaptees: ['equatorial', 'tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'equatorial', semaineSemis: 48, semainePlantation: 48, semaineRecolte: 30, dureeRecolte: 12, dureeCulture: 230, espacement: 100, notes: 'Semis au retour des pluies (décembre) ; floraison puis récolte des gousses vertes vers juillet-août, la maturation des graines profitant du temps plus sec. Rustique, tolère la sécheresse et les sols pauvres ; peut être r' },
      { zone: 'tropical_antilles', semaineSemis: 26, semaineRecolte: 2, dureeRecolte: 8, dureeCulture: 200, espacement: 100, notes: 'Semis en hivernage (juillet) pour un développement végétatif sous les pluies ; floraison et gousses en carême (récolte de Noël/janvier, période traditionnelle). Légumineuse fixatrice, peu exigeante, idéale en bordure et ' },
      { zone: 'tropical_austral', semaineSemis: 48, semaineRecolte: 24, dureeRecolte: 10, dureeCulture: 180, espacement: 100, notes: 'Semis en été austral (novembre-décembre). Floraison en jours courts : récolte des pois frais en hiver austral (juin-août). Légumineuse qui enrichit le sol et sert de haie/brise-vent. Rabattre après récolte pour relancer ' }
    ],
  },
  {
    nom: 'Cive', nomLatin: 'Allium fistulosum', famille: 'Alliaceae', type: 'aromatique',
    vivace: true, uniteRendement: 'kg_m2', rendement: 1.5, besoinN: 3, besoinEau: 3,
    besoinFroid: 'aucun', modeSemis: 'plant_repique', couleur: '#16a085',
    zonesAdaptees: ['equatorial', 'tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'equatorial', semaineSemis: 44, semainePlantation: 44, semaineRecolte: 4, dureeRecolte: 20, dureeCulture: 80, espacement: 15, notes: 'Plantation d\'éclats au retour des pluies (novembre) sur sol bien drainé et riche ; coupes régulières ensuite. Ne forme pas de bulbe en zone équatoriale (photopériode insuffisante) : cultivée pour son feuillage aromatique' },
      { zone: 'tropical_antilles', semaineSemis: 4, semaineRecolte: 13, dureeRecolte: 12, dureeCulture: 75, espacement: 20, notes: 'Installation possible toute l\'année ; le créneau de carême (sous irrigation) réduit la pression des maladies foliaires liées à l\'humidité. Diviser les touffes régulièrement pour relancer la production.' },
      { zone: 'tropical_austral', semaineSemis: 20, semainePlantation: 20, semaineRecolte: 32, dureeRecolte: 20, dureeCulture: 80, espacement: 20, notes: 'Division/plantation de préférence en début d\'hiver austral (mai-juin), saison plus fraîche qui limite la montaison et les maladies. Récolte continue en coupant les feuilles, la souche repartant. Bien drainer : pourrit en' }
    ],
  },
  {
    nom: 'Curcuma (safran-pays)', nomLatin: 'Curcuma longa', famille: 'Zingiberaceae', type: 'aromatique',
    vivace: true, uniteRendement: 'kg_m2', rendement: 2.5, besoinN: 3, besoinEau: 4,
    besoinFroid: 'aucun', modeSemis: 'tubercule', couleur: '#16a085',
    zonesAdaptees: ['tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'tropical_antilles', semaineSemis: 16, semaineRecolte: 6, dureeRecolte: 4, dureeCulture: 285, espacement: 30, notes: 'Plantation aux premières pluies (avril-mai), grossissement sur l\'hivernage, récolte en carême. Sols riches et frais, mi-ombre. Même itinéraire que le gingembre, souvent associés au jardin.' },
      { zone: 'tropical_austral', semaineSemis: 40, semainePlantation: 40, semaineRecolte: 26, dureeRecolte: 6, dureeCulture: 270, espacement: 30, notes: 'Plantation en début de saison humide (octobre), récolte quand le feuillage sèche en hiver austral (juin-juillet). Sol riche, meuble et humide durant la croissance ; assèchement en fin de cycle. Ombrage léger toléré. Se c' }
    ],
  },
  {
    nom: 'Gingembre', nomLatin: 'Zingiber officinale', famille: 'Zingiberaceae', type: 'aromatique',
    vivace: true, uniteRendement: 'kg_m2', rendement: 2.5, besoinN: 3, besoinEau: 4,
    besoinFroid: 'aucun', modeSemis: 'tubercule', couleur: '#16a085',
    zonesAdaptees: ['equatorial', 'tropical_antilles', 'tropical_austral'],
    itps: [
      { zone: 'equatorial', semaineSemis: 48, semainePlantation: 48, semaineRecolte: 40, dureeRecolte: 6, dureeCulture: 285, espacement: 30, notes: 'Plantation des rhizomes au retour des pluies (décembre) sur sol riche, meuble et bien drainé ; croissance sur toute la saison humide et récolte en saison sèche (octobre) au dessèchement du feuillage. Un ombrage léger et ' },
      { zone: 'tropical_antilles', semaineSemis: 16, semaineRecolte: 4, dureeRecolte: 4, dureeCulture: 270, espacement: 30, notes: 'Plantation aux premières pluies (avril-mai) : la croissance des rhizomes couvre tout l\'hivernage humide, récolte en carême (décembre-janvier) quand le feuillage jaunit. Sols riches, meubles, mi-ombre ; buttage.' },
      { zone: 'tropical_austral', semaineSemis: 38, semainePlantation: 38, semaineRecolte: 26, dureeRecolte: 8, dureeCulture: 250, espacement: 30, notes: 'Plantation des rhizomes en début de saison des pluies (septembre-octobre), récolte quand les feuilles jaunissent en hiver austral (juin-juillet). Apprécie l\'ombrage léger et un sol riche et bien drainé. Rhizome jeune réc' }
    ],
  },
]

async function backfillBesoinFroid(): Promise<number> {
  let n = 0
  for (const [nom, besoin] of Object.entries(BESOIN_FROID_METROPOLE)) {
    // Ne touche QUE besoin_froid, sur l'entrée officielle (userId null). On
    // n'écrase aucune autre donnée agronomique.
    const res = await prisma.espece.updateMany({
      where: { id: nom, userId: null },
      data: { besoinFroid: besoin },
    })
    n += res.count
  }
  return n
}

async function seedFamilles(): Promise<void> {
  for (const f of FAMILLES_TROPICALES) {
    await prisma.famille.upsert({
      where: { id: f.id },
      update: { nomFr: f.nomFr },
      create: { id: f.id, nomFr: f.nomFr },
    })
  }
}

async function seedEspecesTropicales(): Promise<{ especes: number; itps: number }> {
  let nbEspeces = 0
  let nbItps = 0
  for (const e of ESPECES_TROPICALES) {
    const zonesCsv = e.zonesAdaptees.join(',')
    const existing = await prisma.espece.findUnique({ where: { id: e.nom }, select: { id: true } })

    if (existing) {
      // Espèce DÉJÀ au catalogue métropolitain (ex : Patate douce, Aubergine) :
      // elle pousse à la fois en métropole ET en tropical. On NE touche PAS à
      // son espece (surtout pas zonesAdaptees : la restreindre aux zones
      // tropicales la ferait passer « peu adaptée » en métropole — régression).
      // On se contente d'ajouter son ITP calé sur la zone tropicale (plus bas).
    } else {
      await prisma.espece.create({
        data: {
          id: e.nom,
          nom: e.nom,
          nomNormalise: normalizeReferentielKey(e.nom),
          type: e.type,
          familleId: e.famille,
          nomLatin: e.nomLatin,
          uniteRendement: e.uniteRendement,
          rendement: e.rendement ?? null,
          vivace: e.vivace ?? false,
          besoinN: e.besoinN ?? null,
          besoinEau: e.besoinEau ?? null,
          besoinFroid: e.besoinFroid ?? 'aucun',
          modeSemis: e.modeSemis ?? null,
          couleur: e.couleur ?? null,
          zonesAdaptees: zonesCsv,
          userId: null,
          partageCommunaute: false,
        },
      })
      nbEspeces++
    }

    // ITP par zone (id = « <espèce> — <libellé zone court> »).
    for (const itp of e.itps) {
      const suffixe = itp.zone.replace('tropical_', '').replace('_', ' ')
      const itpId = `${e.nom} — ${suffixe}`
      // Espèces pérennes (arbres, fruitiers vivaces) : la « semaine de semis »
      // fournie est en réalité la fenêtre de PLANTATION (la récolte survient des
      // années plus tard, pas dans le cycle semis→récolte). On la range donc dans
      // semainePlantation et on laisse semaineSemis nul — ce qui reflète la
      // réalité agronomique ET évite le trigger DB enforce_itp_dates() qui exige
      // ≥ 4 semaines entre semis et récolte (règle valable pour les annuelles).
      const perenne = e.vivace
      const semaineSemis = perenne ? null : (itp.semaineSemis ?? null)
      const semainePlantation = perenne
        ? (itp.semainePlantation ?? itp.semaineSemis ?? null)
        : (itp.semainePlantation ?? null)
      const dataItp = {
        especeId: e.nom,
        semaineSemis,
        semainePlantation,
        semaineRecolte: itp.semaineRecolte ?? null,
        dureeRecolte: itp.dureeRecolte ?? null,
        dureeCulture: itp.dureeCulture ?? null,
        espacement: itp.espacement ?? null,
        notes: itp.notes ?? null,
        zoneClimat: itp.zone,
      }
      await prisma.iTP.upsert({
        where: { id: itpId },
        update: dataItp,
        create: {
          id: itpId,
          nom: itpId,
          nomNormalise: normalizeReferentielKey(itpId),
          userId: null,
          partageCommunaute: false,
          ...dataItp,
        },
      })
      nbItps++
    }
  }
  return { especes: nbEspeces, itps: nbItps }
}

async function main() {
  const nbFroid = await backfillBesoinFroid()
  console.log(`✓ besoinFroid backfillé sur ${nbFroid} espèces métropolitaines`)

  await seedFamilles()
  console.log(`✓ ${FAMILLES_TROPICALES.length} familles botaniques vérifiées`)

  const { especes, itps } = await seedEspecesTropicales()
  console.log(`✓ ${especes} espèces tropicales créées, ${itps} ITP par zone upsertés (sur ${ESPECES_TROPICALES.length} espèces)`)
}

main()
  .catch((err) => {
    console.error('Seed référentiel géographique échec :', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
