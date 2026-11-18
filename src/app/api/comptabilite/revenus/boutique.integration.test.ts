/**
 * Route Revenus sur PostgreSQL jetable : commandes déjà livrées et leurs
 * miroirs comptables. La livraison elle-même relève du parcours boutique.
 * Seule l'identité de session est simulée ; les lectures Prisma sont réelles.
 */
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const identite = vi.hoisted(() => ({ userId: '' }))
vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: identite.userId } } }),
}))

import prisma from '@/lib/prisma'
import { GET } from './route'

const url = process.env.DATABASE_URL
const active = !!url && url === process.env.TEST_DATABASE_URL && new URL(url).pathname === '/gleba_tests'
const date = new Date('2026-01-10T12:00:00Z')
const proprietaires: string[] = []

async function ferme(montant: number) {
  const userId = randomUUID()
  const resultat = await prisma.$transaction(async tx => {
    await tx.user.create({ data: { id: userId, email: `${userId}@example.invalid` } })
    await tx.exploitation.create({ data: { userId, devise: 'EUR', territoire: 'METROPOLE',
      raisonSociale: 'Ferme fictive', formeJuridique: 'EI', regimeFiscal: 'micro-BA', regimeTva: 'franchise-293b',
      adresseSiege: '1 voie fictive', codePostal: '64000', ville: 'Essai', emailContact: 'qa@example.invalid',
    } })
    const boutique = await tx.boutique.create({ data: { userId, slug: randomUUID(), nom: 'Boutique fictive' } })
    const produit = await tx.produitBoutique.create({ data: {
      userId, boutiqueId: boutique.id, nom: 'Carottes fictives', categorie: 'legumes', unite: 'kg', prix: montant,
    } })
    const commande = await tx.commandeBoutique.create({ data: {
      userId, boutiqueId: boutique.id, numero: 'CMD-FICTIVE-1', statut: 'livree', createdAt: date,
      clientNom: 'Client fictif', clientEmail: 'client@example.invalid', total: montant,
      lignes: { create: { produitId: produit.id, nom: produit.nom, unite: produit.unite, quantite: 1, prixUnitaire: montant, total: montant } },
    } })
    const vente = await tx.venteManuelle.create({ data: {
      userId, date, auto: true, sourceType: 'commande_boutique', sourceId: commande.id,
      module: 'potager', categorie: 'legumes', description: 'Commande de carottes fictive', montant, paye: false,
    } })
    await tx.commandeBoutique.update({ where: { id: commande.id }, data: { venteManuelleId: vente.id } })
    const autre = await tx.venteManuelle.create({ data: {
      userId, date, module: 'autre', categorie: 'service', description: 'Service fictif', montant: 17, auto: false,
    } })
    return { userId, vente, autre }
  })
  proprietaires.push(userId)
  return resultat
}

const lire = async (userId: string, module?: string) => {
  identite.userId = userId
  const reponse = await GET(new NextRequest(`http://localhost/api/comptabilite/revenus?year=2026${module ? `&module=${module}` : ''}`))
  const json = await reponse.json()
  expect(reponse.status, JSON.stringify(json)).toBe(200)
  return json
}

describe.skipIf(!active)('Transactions : filtre du canal boutique, PostgreSQL', () => {
  let a: Awaited<ReturnType<typeof ferme>>, b: Awaited<ReturnType<typeof ferme>>
  beforeAll(async () => { a = await ferme(42); b = await ferme(900) })
  afterAll(async () => {
    try {
      // Supprimer d'abord les lignes de commandes liées par une clé d'unité.
      await prisma.commandeBoutique.deleteMany({ where: { userId: { in: proprietaires } } })
      await prisma.user.deleteMany({ where: { id: { in: proprietaires } } })
    } finally { await prisma.$disconnect() }
  })

  it('sépare la commande livrée de légumes de la vente manuelle Autre, sans changer Tous', async () => {
    const boutique = await lire(a.userId, 'boutique')
    expect(boutique.data.map((l: { id: string }) => l.id)).toEqual([`manuel-${a.vente.id}`])
    expect(boutique.data[0]).toMatchObject({ module: 'potager', montant: 42 })
    expect(boutique.stats).toMatchObject({ total: 42, count: 1,
      parModule: { potager: 42, verger: 0, elevage: 0, autre: 0 },
      parDevise: [{ monnaie: 'EUR', total: 42, count: 1, parModule: { potager: 42, verger: 0, elevage: 0, autre: 0 } }],
    })
    const autre = await lire(a.userId, 'autre')
    expect(autre.data.map((l: { id: string }) => l.id)).toEqual([`manuel-${a.autre.id}`])
    expect(autre.stats.total).toBe(17)
    const tous = await lire(a.userId)
    expect(tous.data).toHaveLength(2)
    expect(tous.stats.total).toBe(59)
  })

  it('ne renvoie que les ventes boutique du propriétaire connecté, dans les deux sens', async () => {
    for (const f of [a, b]) {
      const j = await lire(f.userId, 'boutique')
      expect(j.data.map((l: { id: string }) => l.id)).toEqual([`manuel-${f.vente.id}`])
      expect(j.stats.total).toBe(f.vente.montant)
      expect(j.stats.parDevise[0].total).toBe(f.vente.montant)
    }
  })

  it('inclut une vente manuelle historique Boutique malgré la casse et les espaces', async () => {
    const ancienne = await prisma.venteManuelle.create({ data: {
      userId: a.userId, date, auto: false, module: ' BoUtIqUe ', categorie: 'legumes',
      description: 'Vente boutique historique fictive', montant: 8,
    } })
    try {
      const j = await lire(a.userId, 'boutique')
      expect(j.data.map((l: { id: string }) => l.id).sort()).toEqual([`manuel-${a.vente.id}`, `manuel-${ancienne.id}`].sort())
      expect(j.stats).toMatchObject({ total: 50, count: 2, parModule: { potager: 50 }, parDevise: [{ monnaie: 'EUR', total: 50, count: 2 }] })
    } finally { await prisma.venteManuelle.delete({ where: { id: ancienne.id } }) }
  })
})
