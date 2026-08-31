/**
 * Mapping des categories et noms d'especes vers emojis botaniques
 *
 * Les clés de CATEGORIES_EMOJIS sont les valeurs RÉELLES de `especes.categorie`
 * en base (racine, bulbe, feuille, fleur, fruit_legume, grain, petit_fruit,
 * fruit, fruitier, agrume, engrais_vert, mellifere, bois, arbre, ornement),
 * plus quelques variantes tolérées venant des types d'espèces. Une clé
 * inventée ici ne matchera jamais rien : vérifier en base avant d'ajouter.
 */

export const CATEGORIES_EMOJIS: Record<string, string> = {
  // Valeurs de `especes.categorie` en base
  'racine': '🥕',
  'bulbe': '🧅',
  'feuille': '🥗',
  'fleur': '🌸',
  'fruit_legume': '🍆',
  'grain': '🌽',
  'petit_fruit': '🍓',
  'fruit': '🍎',
  'fruitier': '🍎',
  'agrume': '🍊',
  'engrais_vert': '🟩',
  'mellifere': '🐝',
  'bois': '🪵',
  'arbre': '🌳',
  'ornement': '🌺',
  // Variantes tolérées (types d'espèces, libellés avec espace)
  'vivace': '🌿',
  'arbre fruitier': '🍎',
  'arbre_fruitier': '🍎',
  'aromatique': '🌿',
  'legume': '🥬',
  'légume': '🥬',
  'petit fruit': '🍓',
  'engrais vert': '🟩',
}

/**
 * Clés multi-mots : cherchées par inclusion dans le nom complet, les plus
 * longues d'abord (« pomme de terre » avant que « pomme » ne puisse matcher).
 */
const NOMS_COMPOSES_EMOJIS: [string, string][] = [
  ['pomme de terre', '🥔'],
  ['patate douce', '🍠'],
  ['fruit de la passion', '🥭'],
]

/**
 * Clés à un mot : matchées sur un MOT ENTIER du nom, jamais par inclusion.
 * « Poireau » contient « poire » mais n'en est pas un — l'inclusion donnait
 * une poire au poireau et une pomme au chénopode « épinard pays ».
 */
export const ESPECE_NAME_EMOJIS: Record<string, string> = {
  'ail': '🧄',
  'oignon': '🧅',
  'echalote': '🧅',
  'ciboulette': '🌿',
  'tomate': '🍅',
  'carotte': '🥕',
  'chou': '🥬',
  'laitue': '🥬',
  'mesclun': '🥬',
  'epinard': '🥬',
  'blette': '🥬',
  'fraise': '🍓',
  'fraisier': '🍓',
  'framboisier': '🍓',
  'pomme': '🍎',
  'pommier': '🍎',
  'poire': '🍐',
  'poirier': '🍐',
  'cerise': '🍒',
  'cerisier': '🍒',
  'abricotier': '🍑',
  'pecher': '🍑',
  'prunier': '🍑',
  'menthe': '🌿',
  'aubergine': '🍆',
  'melon': '🍈',
  'pasteque': '🍉',
  'courgette': '🥒',
  'concombre': '🥒',
  'cornichon': '🥒',
  'citronnier': '🍋',
  'combava': '🍋',
  'oranger': '🍊',
  'mandarinier': '🍊',
  'kumquat': '🍊',
  'bananier': '🍌',
  'ananas': '🍍',
  'manguier': '🥭',
  'cocotier': '🥥',
  'avocatier': '🥑',
  'olivier': '🫒',
  'piment': '🌶️',
  'poivron': '🌶️',
  'mais': '🌽',
  'tournesol': '🌻',
  'vigne': '🍇',
  'kiwi': '🥝',
  'noisetier': '🌰',
  'noyer': '🌰',
  'amandier': '🌰',
  'chataignier': '🌰',
}

function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Retourne l'emoji pour une categorie donnee
 */
export function getCategorieEmoji(categorie: string | null | undefined): string {
  if (!categorie) return ''
  const key = categorie.toLowerCase().trim()
  return CATEGORIES_EMOJIS[key] || CATEGORIES_EMOJIS[normaliser(categorie)] || ''
}

/**
 * Retourne l'emoji pour une espece donnee : d'abord par son nom (le plus
 * spécifique), sinon par sa catégorie.
 */
export function getEspeceEmoji(nom: string | null | undefined, categorie: string | null | undefined): string {
  if (nom) {
    const nomKey = normaliser(nom)

    for (const [cle, emoji] of NOMS_COMPOSES_EMOJIS) {
      if (nomKey.includes(cle)) return emoji
    }

    // Mots entiers : « Chou de Bruxelles » → [chou, de, bruxelles]
    const mots = nomKey.split(/[\s\-'()]+/)
    for (const mot of mots) {
      const emoji = ESPECE_NAME_EMOJIS[mot]
      if (emoji) return emoji
    }
  }

  return getCategorieEmoji(categorie)
}
