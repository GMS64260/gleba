/**
 * Mapping des categories d'especes vers emojis
 */

export const CATEGORIES_EMOJIS: Record<string, string> = {
  'racine': '🥕',
  'bulbe': '🧅',
  'feuille': '🌿',
  'fleur': '🌼',
  'fruit_legume': '🍆',
  'grain': '🌽',
  'petit_fruit': '🍓',
  'fruit': '🍎',
  'agrume': '🍊',
  'engrais_vert': '🟩',
  'mellifere': '🐝',
  'bois': '🪵',
  'arbre': '🌳',
  'ornement': '🌺',
}

/**
 * Retourne l'emoji pour une categorie donnee
 */
export function getCategorieEmoji(categorie: string | null | undefined): string {
  if (!categorie) return ''
  return CATEGORIES_EMOJIS[categorie.toLowerCase()] || ''
}

/**
 * Retourne le nom de la categorie avec emoji
 */
export function getCategorieWithEmoji(categorie: string | null | undefined): string {
  if (!categorie) return ''
  const emoji = getCategorieEmoji(categorie)
  return emoji ? `${emoji} ${categorie}` : categorie
}
