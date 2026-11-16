/**
 * Boutique reliée aux stocks de l'élevage (œufs, ruche) sur PostgreSQL :
 * sortie FIFO à la livraison et au paiement, retour à l'annulation, paiement
 * jamais refusé faute de stock, livraison refusée sans stock.
 *
 * Base jetable uniquement : DATABASE_URL = TEST_DATABASE_URL (base dont le nom
 * commence par `gleba_tests`), sinon la suite est ignorée.
 */
import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'

import prisma from '@/lib/prisma'
import { annulerCommandeBoutique as annuler, confirmCommandeBoutique as confirmer, ErreurCommandeBoutique, livrerCommandeBoutique as livrer } from '@/lib/commande-boutique'
import { retournerStockCommercial, sortirStockCommercial } from '@/lib/commercial/stock'
import { ErreurStockLie, stockLieRetenu } from '@/lib/boutique/stock-lie'
import { chargerStocksLies, commandableProduitLie, lignesEnRuptureStockLie, listerStocksLiables, relierProduitAuStock } from '@/lib/boutique/stock-lie-disponible'
import { reprendreStockLieExploitation } from '@/lib/boutique/reprise-stock-lie'
import { chargerCatalogueStock } from '@/lib/commercial/catalogue-stock'

const url = process.env.DATABASE_URL
const active = !!url && url === process.env.TEST_DATABASE_URL && new URL(url).pathname.startsWith('/gleba_tests')
// Les verrous de la commande ne valent que dans une transaction : l'appelant la fournit.
const livrerCommandeBoutique = (id: number) => prisma.$transaction((tx) => livrer(id, tx), { timeout: 30000 })
const annulerCommandeBoutique = (id: number) => prisma.$transaction((tx) => annuler(id, 'Annulé', tx), { timeout: 30000 })
const confirmCommandeBoutique = (id: number, opts: { modeReglement?: string | null }) => prisma.$transaction((tx) => confirmer(id, opts, tx), { timeout: 30000 })
const hier = () => new Date(Date.now() - 24 * 3600 * 1000)

describe.skipIf(!active)('boutique : produit relié à un stock de l\'élevage', () => {
  afterAll(async () => { await prisma.$disconnect() })

  async function ferme() {
    const userId = randomUUID()
    await prisma.user.create({ data: { id: userId, email: `${userId}@example.com` } })
    await prisma.exploitation.create({ data: { userId, raisonSociale: 'Ferme synthétique stock lié', formeJuridique: 'EI', regimeFiscal: 'micro-BA', regimeTva: 'franchise-293b', territoire: 'METROPOLE', devise: 'EUR', adresseSiege: '1 rue de test', codePostal: '64000', ville: 'Ville test', emailContact: 'qa@example.com' } })
    const boutique = await prisma.boutique.create({ data: { userId, slug: randomUUID(), nom: 'Boutique synthétique', active: true } })
    const douzaine = await prisma.produitBoutique.create({ data: { userId, boutiqueId: boutique.id, nom: 'Douzaine synthétique', prix: 4.8, unite: 'douzaine', categorie: 'oeufs', stockLieType: 'oeufs', stockLieRef: 'stock', stockLieConditionnement: 12 } })
    const pot = await prisma.produitBoutique.create({ data: { userId, boutiqueId: boutique.id, nom: 'Pot de miel synthétique 500 g', prix: 8, unite: 'pot', categorie: 'miel', stockLieType: 'ruche', stockLieRef: 'miel', stockLieConditionnement: 0.5 } })
    let n = 0
    const commande = async (lignes: Array<{ produit: typeof douzaine; quantite: number }>) => prisma.commandeBoutique.create({
      data: {
        userId, boutiqueId: boutique.id, numero: `CMD-${++n}`, clientNom: 'Client synthétique', clientEmail: 'client@example.com',
        total: lignes.reduce((s, l) => s + l.produit.prix * l.quantite, 0),
        lignes: { create: lignes.map((l) => ({ produitId: l.produit.id, nom: l.produit.nom, prixUnitaire: l.produit.prix, unite: l.produit.unite, quantite: l.quantite, total: l.produit.prix * l.quantite, stockLieType: l.produit.stockLieType, stockLieRef: l.produit.stockLieRef, stockLieConditionnement: l.produit.stockLieConditionnement })) },
      },
    })
    const ponte = (quantite: number, date = hier()) => prisma.productionOeuf.create({ data: { userId, quantite, date } })
    const oeufsSortis = async () => (await prisma.mouvementStockOeuf.aggregate({ where: { userId }, _sum: { quantite: true } }))._sum.quantite ?? 0
    return { userId, boutique, douzaine, pot, commande, ponte, oeufsSortis }
  }

  it('la livraison sort les œufs en FIFO, une seule fois, et l\'annulation les rend', async () => {
    const f = await ferme()
    const ancienne = await f.ponte(10, new Date(Date.now() - 3 * 24 * 3600 * 1000))
    const recente = await f.ponte(30)
    const c = await f.commande([{ produit: f.douzaine, quantite: 2 }])
    expect(await stockLieRetenu(prisma, f.userId)).toEqual(new Map([['oeufs:stock', 24]]))

    await livrerCommandeBoutique(c.id)
    const mouvements = await prisma.mouvementStockCommercial.findMany({ where: { userId: f.userId, commandeBoutiqueId: c.id }, orderBy: { id: 'asc' } })
    expect(mouvements.map((m) => [m.ponteId, m.quantite, m.ligneCommandeBoutiqueId != null, m.ligneFactureId])).toEqual([[ancienne.id, 10, true, null], [recente.id, 14, true, null]])
    expect(await f.oeufsSortis()).toBe(24)
    expect(await stockLieRetenu(prisma, f.userId)).toEqual(new Map())
    // Aucune vente d'élevage : la recette est portée par la commande seule.
    expect(await prisma.venteProduit.count({ where: { userId: f.userId } })).toBe(0)
    expect(await prisma.venteManuelle.count({ where: { userId: f.userId, sourceType: 'commande_boutique', sourceId: c.id } })).toBe(1)

    await confirmCommandeBoutique(c.id, { modeReglement: 'Espèces' })
    expect(await f.oeufsSortis()).toBe(24)

    await annulerCommandeBoutique(c.id)
    expect(await f.oeufsSortis()).toBe(0)
    await annulerCommandeBoutique(c.id)
    expect(await f.oeufsSortis()).toBe(0)
  })

  it('refuse la livraison sans stock et ne crée ni recette ni mouvement', async () => {
    const f = await ferme()
    await f.ponte(11)
    const c = await f.commande([{ produit: f.douzaine, quantite: 1 }])
    await expect(livrerCommandeBoutique(c.id)).rejects.toBeInstanceOf(ErreurCommandeBoutique)
    expect(await f.oeufsSortis()).toBe(0)
    expect(await prisma.venteManuelle.count({ where: { userId: f.userId } })).toBe(0)
  })

  it('ne refuse jamais le paiement faute de stock : la ligne reste à sortir, puis sort à la livraison', async () => {
    const f = await ferme()
    await f.ponte(12)
    const c = await f.commande([{ produit: f.douzaine, quantite: 1 }, { produit: f.douzaine, quantite: 2 }])
    const r = await confirmCommandeBoutique(c.id, { modeReglement: 'Espèces' })
    expect(r.sortiesStockManquantes?.map((m) => [m.demande, m.disponible, m.unite])).toEqual([[24, 0, 'pièce']])
    expect(await f.oeufsSortis()).toBe(12)
    expect(await stockLieRetenu(prisma, f.userId)).toEqual(new Map([['oeufs:stock', 24]]))

    await expect(livrerCommandeBoutique(c.id)).rejects.toBeInstanceOf(ErreurCommandeBoutique)
    await f.ponte(30)
    await livrerCommandeBoutique(c.id)
    expect(await f.oeufsSortis()).toBe(36)
    expect(await stockLieRetenu(prisma, f.userId)).toEqual(new Map())
  })

  it('sort le miel au poids du conditionnement et le rend à l\'annulation', async () => {
    const f = await ferme()
    await prisma.productionRuche.create({ data: { userId: f.userId, produit: 'miel', quantite: 2, unite: 'kg', date: hier() } })
    const c = await f.commande([{ produit: f.pot, quantite: 3 }])
    await livrerCommandeBoutique(c.id)
    const sorti = async () => (await prisma.mouvementStockRuche.aggregate({ where: { userId: f.userId }, _sum: { quantite: true } }))._sum.quantite ?? 0
    expect(await sorti()).toBeCloseTo(1.5, 6)
    await annulerCommandeBoutique(c.id)
    expect(await sorti()).toBeCloseTo(0, 6)
  })

  it('refuse un mouvement de stock sans origine au lieu de viser tout le compte', async () => {
    const f = await ferme()
    await f.ponte(12)
    await expect(prisma.$transaction((tx) => retournerStockCommercial(tx, f.userId, {}))).rejects.toThrow(/relié/)
    await expect(prisma.$transaction((tx) => sortirStockCommercial(tx, f.userId, [{ articleStockType: 'oeufs', articleStockId: 'stock', description: 'Œufs', quantite: 6, unite: 'pièce' }], { numero: 'X', date: new Date() }))).rejects.toThrow(/relié/)
    expect(await f.oeufsSortis()).toBe(0)
  })

  it('relie un produit par la règle et retire les produits reliés du catalogue « boutique »', async () => {
    const f = await ferme()
    await f.ponte(40)
    const libre = await prisma.produitBoutique.create({ data: { userId: f.userId, boutiqueId: f.boutique.id, nom: 'Boîte de six synthétique', prix: 2.5, unite: 'boîte', categorie: 'oeufs' } })
    const relier = (id: number, stockLie: unknown) => prisma.$transaction((tx) => relierProduitAuStock(tx, f.userId, id, stockLie))
    await expect(relier(libre.id, { type: 'oeufs', conditionnement: 6.5 })).rejects.toBeInstanceOf(ErreurStockLie)
    await expect(relier(libre.id, { type: 'ruche', ref: 'miel', conditionnement: 0.5 })).rejects.toBeInstanceOf(ErreurStockLie) // aucune production de miel
    const compte = await prisma.produitBoutique.create({ data: { userId: f.userId, boutiqueId: f.boutique.id, nom: 'Compteur synthétique', prix: 1, unite: 'pièce', stockDispo: 3 } })
    await expect(relier(compte.id, { type: 'oeufs', conditionnement: 1 })).rejects.toBeInstanceOf(ErreurStockLie)
    expect((await relier(libre.id, { type: 'oeufs', conditionnement: '6' })).stockLieConditionnement).toBe(6)
    expect((await prisma.$transaction((tx) => listerStocksLiables(tx, f.userId))).map((s) => [s.type, s.ref, s.unite, s.disponible])).toEqual([['oeufs', 'stock', 'pièce', 40]])
    const catalogue = await prisma.$transaction((tx) => chargerCatalogueStock(f.userId, tx))
    expect(catalogue.filter((a) => a.type === 'boutique').map((a) => a.nom)).toEqual(['Compteur synthétique'])
    // Douzaine et boîte vendent le même stock : la demande se cumule (2 × 12 + 3 × 6 = 42 > 40).
    const etats = await prisma.$transaction((tx) => chargerStocksLies(tx, f.userId))
    const panier = (boites: number) => [{ nom: 'Douzaine', quantite: 2, stockLieType: 'oeufs', stockLieRef: 'stock', stockLieConditionnement: 12 }, { nom: 'Boîte', quantite: boites, stockLieType: 'oeufs', stockLieRef: 'stock', stockLieConditionnement: 6 }]
    expect(lignesEnRuptureStockLie(etats, panier(3)).map((l) => l.nom)).toEqual(['Boîte'])
    expect(lignesEnRuptureStockLie(etats, panier(2))).toEqual([])
    expect(commandableProduitLie(etats, { type: 'oeufs', ref: 'stock', conditionnement: 12 }, 'douzaine')).toBe(3)
    expect((await relier(libre.id, null)).stockLieType).toBeNull()
  })

  it('reprise : relie par règle, sort à la date de la commande, à blanc par défaut, rejouable, sans rien forcer', async () => {
    const f = await ferme()
    const jour = (n: number) => new Date(Date.now() - n * 24 * 3600 * 1000)
    // État d'avant le chantier : produits et lignes sans lien, commandes déjà livrées, rien de sorti.
    await prisma.produitBoutique.updateMany({ where: { userId: f.userId }, data: { stockLieType: null, stockLieRef: null, stockLieConditionnement: null } })
    const barquette = await prisma.produitBoutique.create({ data: { userId: f.userId, boutiqueId: f.boutique.id, nom: 'Barquette synthétique', prix: 3, unite: 'barquette', categorie: 'oeufs' } })
    await f.ponte(60, jour(6))
    await f.ponte(12, jour(1))
    const ancienne = async (lignes: Array<{ produit: typeof f.douzaine; quantite: number }>, date: Date) => {
      const c = await f.commande(lignes)
      await prisma.ligneCommandeBoutique.updateMany({ where: { commandeId: c.id }, data: { stockLieType: null, stockLieRef: null, stockLieConditionnement: null } })
      const v = await prisma.venteManuelle.create({ data: { userId: f.userId, date, categorie: 'oeufs', description: 'Commande synthétique', montant: c.total, montantHT: c.total, montantTVA: 0, tauxTVA: 0, module: 'boutique', paye: true, auto: true, sourceType: 'commande_boutique', sourceId: c.id } })
      return prisma.commandeBoutique.update({ where: { id: c.id }, data: { statut: 'livree', paiementStatut: 'Confirmé', venteManuelleId: v.id, createdAt: date } })
    }
    const c1 = await ancienne([{ produit: f.douzaine, quantite: 3 }], jour(5))
    const c2 = await ancienne([{ produit: f.douzaine, quantite: 2 }, { produit: barquette, quantite: 1 }], jour(4))
    // Antérieures à toute ponte : aucun lot à leur date. La première sort sur
    // le stock réellement présent (repli), la seconde n'a plus de stock : rien n'est forcé.
    const c3 = await ancienne([{ produit: f.douzaine, quantite: 1 }], jour(10))
    const c4 = await ancienne([{ produit: f.douzaine, quantite: 1 }], jour(9))
    await prisma.venteProduit.create({ data: { userId: f.userId, date: jour(3), type: 'oeufs', quantite: 1, unite: 'douzaine', prixUnitaire: 4.8, prixTotal: 4.8 } })

    const blanc = await reprendreStockLieExploitation(prisma, f.userId, false)
    expect(blanc.evenements.filter((e) => e.issue === 'sortie').map((e) => 'quantite' in e && [e.quantite, 'dateDeRepli' in e])).toEqual([[36, false], [24, false], [12, true]])
    expect(await f.oeufsSortis()).toBe(0)
    expect((await prisma.produitBoutique.findUniqueOrThrow({ where: { id: f.douzaine.id } })).stockLieType).toBeNull()

    const reel = await reprendreStockLieExploitation(prisma, f.userId, true)
    expect(reel.evenements.map((e) => e.issue)).toEqual(blanc.evenements.map((e) => e.issue))
    expect(reel.evenements.filter((e) => e.objet === 'produit').map((e) => [e.produitId, e.issue])).toEqual([[f.douzaine.id, 'relie'], [f.pot.id, 'non_relie'], [barquette.id, 'non_relie']]) // pot et barquette : contenance jamais devinée
    expect(reel.evenements.filter((e) => e.issue === 'stock_insuffisant').map((e) => 'commandeId' in e && e.commandeId)).toEqual([c4.id])
    expect(await f.oeufsSortis()).toBe(72)
    // La commande livrée restée sans stock est au journal ; elle ne retient rien dans la vitrine.
    expect(await stockLieRetenu(prisma, f.userId)).toEqual(new Map())
    const mouvements = await prisma.mouvementStockCommercial.findMany({ where: { userId: f.userId, commandeBoutiqueId: { in: [c1.id, c2.id] } } })
    expect((await prisma.mouvementStockCommercial.count({ where: { userId: f.userId, commandeBoutiqueId: c3.id } }))).toBe(1)
    expect(mouvements.every((m) => m.date.getTime() < Date.now() - 3 * 24 * 3600 * 1000)).toBe(true)
    // Aucune vente d'élevage touchée, aucune recette ajoutée.
    expect(await prisma.venteProduit.count({ where: { userId: f.userId, annule: false } })).toBe(1)
    expect(await prisma.venteManuelle.count({ where: { userId: f.userId } })).toBe(4)

    const rejeu = await reprendreStockLieExploitation(prisma, f.userId, true)
    expect(rejeu.evenements.filter((e) => e.issue === 'sortie')).toEqual([])
    expect(rejeu.evenements.filter((e) => e.issue === 'deja_sortie').length).toBe(3)
    expect(await f.oeufsSortis()).toBe(72)
  })
})
