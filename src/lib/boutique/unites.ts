/** Règle commune au panier public et à la validation des commandes. */
export function uniteEntiereBoutique(unite: string): boolean {
  return ['pièce', 'piece', 'tige', 'botte', 'barquette', 'bocal', 'panier', 'douzaine', 'boîte', 'boite'].includes(unite.trim().toLowerCase())
}
