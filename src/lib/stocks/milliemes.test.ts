import { describe, expect, it } from 'vitest'
import { ajouterAuStock, milliemesDuReste, normaliserStock, plafonnerStock, quantiteCanonique, retirerDuStock, stockCouvre } from './milliemes'

describe('arithmétique décimale exacte du stock commercial', () => {
  it('2,3 − 0,5 − 1,8 vaut exactement 0', () => {
    expect(2.3 - 0.5 - 1.8).not.toBe(0)
    expect(retirerDuStock(retirerDuStock(2.3, 0.5), 1.8)).toBe(0)
  })
  it('dix ajouts de 0,1 rendent exactement 1', () => {
    let stock = 0
    for (let i = 0; i < 10; i++) stock = ajouterAuStock(stock, 0.1)
    expect(stock).toBe(1)
  })
  it('lit normalisé un résidu flottant, sans zéro négatif', () => {
    expect(normaliserStock(-2.220446049250313e-16)).toBe(0)
    expect(Object.is(normaliserStock(-2.220446049250313e-16), 0)).toBe(true)
    expect(normaliserStock(0.09999999999999998)).toBe(0.1)
    expect(normaliserStock(2.3000000000000003)).toBe(2.3)
  })
  it('compare sur la grille', () => {
    expect(stockCouvre(0.09999999999999998, 0.1)).toBe(true)
    expect(stockCouvre(0.099, 0.1)).toBe(false)
    expect(stockCouvre(2.3005, 2.3005)).toBe(true)
    expect(stockCouvre(2.3005, 2.3006)).toBe(false)
  })
  it.each([0.0004, 0.0005, 0.0015, 0.1, 1 / 3, 1234.56789])('sortie puis retour de %s sont exactement inverses', (quantite) => {
    for (const stock of [2.3, 2.3005, 2.3004, 1000000.001]) {
      const apres = retirerDuStock(stock, quantite)
      expect(apres).toBeLessThan(stock)
      expect(ajouterAuStock(apres, quantite)).toBe(stock)
    }
  })
  it('ne perd ni ne crée rien sous le millième : 2,3 − 0,0004 = 2,2996 ; 2,3005 − 0,5 = 1,8005', () => {
    expect(retirerDuStock(2.3, 0.0004)).toBe(2.2996)
    expect(retirerDuStock(2.3005, 0.5)).toBe(1.8005)
    expect(ajouterAuStock(1.8005, 0.5)).toBe(2.3005)
  })
  it('la quantité canonique est positive, la même au débit et au retour ; nulle sous la grille', () => {
    expect(quantiteCanonique(-0.0005)).toBe(0.0005)
    expect(quantiteCanonique(0.0005)).toBe(0.0005)
    expect(quantiteCanonique(0.30000000000000004)).toBe(0.3)
    expect(quantiteCanonique(1e-10)).toBe(0)
    // Le signe ne change jamais le sens : le nom de la fonction le porte.
    expect(retirerDuStock(1, -0.5)).toBe(0.5)
    expect(ajouterAuStock(1, -0.5)).toBe(1.5)
  })
})

describe('plafond de production (contrainte CHECK stock <= production)', () => {
  it('une production héritée 0,7 × 3 livrée de 0,1 puis retournée revient à sa valeur brute', () => {
    const production = 0.7 * 3
    expect(production).toBe(2.0999999999999996)
    const apresSortie = retirerDuStock(production, 0.1)
    expect(apresSortie).toBe(2)
    expect(plafonnerStock(ajouterAuStock(apresSortie, 0.1), production)).toBe(production)
  })
  it('une production à dix décimales (2,3000000005) revient à sa valeur brute, sans perte ni dépassement', () => {
    const apresSortie = retirerDuStock(2.3000000005, 0.1)
    expect(apresSortie).toBe(2.200000001)
    expect(plafonnerStock(ajouterAuStock(apresSortie, 0.1), 2.3000000005)).toBe(2.3000000005)
    // Arrondie vers le bas sur la grille, la fraction historique n'est pas perdue.
    expect(plafonnerStock(ajouterAuStock(retirerDuStock(2.3000000004, 0.1), 0.1), 2.3000000004)).toBe(2.3000000004)
  })
  it('un retour partiel reste strictement sous la production, inchangé', () => {
    expect(plafonnerStock(2, 0.7 * 3)).toBe(2)
    expect(plafonnerStock(2.099999999, 0.7 * 3)).toBe(2.099999999)
  })
  it('un reliquat à un pas de grille au-dessus de la production vaut la production brute', () => {
    expect(plafonnerStock(2.100000001, 2.1)).toBe(2.1)
    expect(plafonnerStock(2.1, 0.7 * 3)).toBe(0.7 * 3)
    // ADV259 : sur la production brute 2,0999999999999996, 2,100000001 dépasse de 10⁻⁹ + 4·10⁻¹⁶ → refus
    // (aucune sortie ni retour sur la grille ne peut produire ce reliquat : le retour intégral rend 2,1).
    expect(() => plafonnerStock(2.100000001, 0.7 * 3)).toThrow(/^STOCK_RETOUR_EXCEDENT: /)
  })
  it('un reliquat au-delà de la production (plus d’un pas de grille) est refusé, jamais plafonné en silence', () => {
    expect(() => plafonnerStock(2.100000002, 2.1)).toThrow(/^STOCK_RETOUR_EXCEDENT: /)
    expect(() => plafonnerStock(2.101, 0.7 * 3)).toThrow(/^STOCK_RETOUR_EXCEDENT: /)
    expect(() => plafonnerStock(3, 2.1)).toThrow(/dépasserait la production du lot/)
  })
  it('ADV259 : le dépassement se mesure sur la production brute, pas sur sa lecture arrondie à la grille', () => {
    // 2,3000000006 se lit 2,300000001 sur la grille : 2,300000002 la dépasse de 1,4·10⁻⁹.
    expect(() => plafonnerStock(2.300000002, 2.3000000006)).toThrow(/^STOCK_RETOUR_EXCEDENT: /)
    expect(plafonnerStock(2.300000001, 2.3000000006)).toBe(2.3000000006)
    expect(plafonnerStock(2.300000001, 2.3000000005)).toBe(2.3000000005)
    expect(plafonnerStock(2.3, 2.3000000006)).toBe(2.3)
    // Production plus basse que sa grille (2,3000000004 lue 2,3) : un pas au-dessus de la grille reste dans le 10⁻⁹.
    expect(plafonnerStock(2.300000001, 2.3000000004)).toBe(2.3000000004)
    expect(plafonnerStock(2.3, 2.3000000004)).toBe(2.3000000004)
    expect(plafonnerStock(2.299999999, 2.3000000004)).toBe(2.299999999)
    expect(() => plafonnerStock(2.300000002, 2.3000000004)).toThrow(/^STOCK_RETOUR_EXCEDENT: /)
  })
  it('un reliquat sous la production est rendu normalisé (même valeur que la primitive SQL)', () => {
    expect(plafonnerStock(0.1 + 0.2, 2.1)).toBe(0.3)
  })
})

// Modèle de stock unique (L4.2) : le stock d'une espèce somme les restes des
// lots arrondis au millième, comme `floor(reste::numeric * 1000 + 0.5)` en SQL.
describe('milliemesDuReste', () => {
  it('arrondit au millième le plus proche, la moitié vers le haut', () => {
    expect(milliemesDuReste(2.3)).toBe(2300)
    expect(milliemesDuReste(2.3005)).toBe(2301)
    expect(milliemesDuReste(2.3004)).toBe(2300)
    expect(milliemesDuReste(0.0004)).toBe(0)
    expect(milliemesDuReste(0)).toBe(0)
  })
  it('lit un résidu flottant sur la grille avant d’arrondir', () => {
    expect(milliemesDuReste(0.1 + 0.2)).toBe(300)
    expect(milliemesDuReste(2.3 - 0.5)).toBe(1800)
    expect(milliemesDuReste(2.0004999999999997)).toBe(2001)
  })
  it('vaut 0 pour une valeur non finie', () => {
    expect(milliemesDuReste(Number.NaN)).toBe(0)
  })
})
