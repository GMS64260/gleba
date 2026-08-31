/**
 * Mapping des categories et noms d'especes vers emojis botaniques
 */

export const CATEGORIES_EMOJIS: Record<string, string> = {
  // Catégories génériques
  'vivace': '🌿',
  'arbre fruitier': '🍎',
  'aromatique': '🌿',
  'legume': '🥬',
  'légume': '🥬',
  'petit fruit': '🍓',
  'fleur': '🌸',
  'engrais vert': '🟩',
  'ornement': '🌺',
  'racine': '🥕',
  'bulbe': '🧅',
  'feuille': '🥗',
  'fruit': '🍎',
  'agrume': '🍊',
}

export const ESPECE_NAME_EMOJIS: Record<string, string> = {
  'ail': '🧄',
  'oignon': '🧅',
  'pomme de terre': '🥔',
  'tomate': '🍅',
  'carotte': '🥕',
  'chou': '🥬',
  'fraise': '🍓',
  'pomme': '🍎',
  'poire': '🍐',
  'cerise': '🍒',
  'framboise': '🍇',
  'menthe': '🌿',
  'abricotier': '🍑',
  'aubergine': '🍆',
  'melon': '🍈',
  'courgette': '🥒',
  'concombre': '🥒',
  'patate douce': '🍠',
}

/**
 * Retourne l'emoji pour une categorie donnee
 */
export function getCategorieEmoji(categorie: string | null | undefined): string {
  if (!categorie) return ''
  const key = categorie.toLowerCase().trim()
  const normalized = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return CATEGORIES_EMOJIS[key] || CATEGORIES_EMOJIS[normalized] || ''
}

/**
 * Retourne l'emoji pour une espece donnee (nom + categorie)
 */
export function getEspeceEmoji(nom: string | null | undefined, categorie: string | null | undefined): string {
  // 1. Catégorie prioritaire pour fruits
  if (categorie) {
    const catKey = categorie.toLowerCase().trim()
    if (catKey === 'fruit' || catKey === 'fruit_legume') {
        return '🍎'
    }
  }

  // 2. Essayer de matcher par nom d'espece
  if (nom) {
    const nomKey = nom.toLowerCase().trim()
    for (const [key, emoji] of Object.entries(ESPECE_NAME_EMOJIS)) {
      if (nomKey.includes(key)) return emoji
    }
  }

  // 3. Fallback sur categorie
  if (!categorie) return ''
  const key = categorie.toLowerCase().trim()
  const normalized = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return CATEGORIES_EMOJIS[key] || CATEGORIES_EMOJIS[normalized] || ''
}
