/**
 * Rejeu sur PostgreSQL du SQL brut de l'attente lait (`chargerAppartenances`)
 * et de la lecture des traitements du délai avant récolte : les tests
 * unitaires simulent la base et ne prouvent pas que ces requêtes s'exécutent.
 *
 * Inactif sans `GLEBA_ATTENTE_LAIT_QA_DATABASE_URL` pointant une base jetable
 * nommée `gleba_attente_lait_qa_<6 hex>` (jamais une base de production).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'

const url = process.env.GLEBA_ATTENTE_LAIT_QA_DATABASE_URL
const active = Boolean(url && /^\/gleba_attente_lait_qa_[0-9a-f]{6}$/.test(new URL(url).pathname))
const j = (jour: string) => new Date(`${jour}T00:00:00Z`)

let db: PrismaClient
let userId: string
let autreId: string
let especeId: string
let lot1: number
let lot2: number
let animal: number

describe.skipIf(!active)('attente lait et délai avant récolte sur PostgreSQL isolé', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = url
    db = (await import('@/lib/prisma')).default
    const creer = () => db.user.create({ data: { email: 'attente-' + randomUUID() + '@example.test', emailVerified: true } })
    userId = (await creer()).id
    autreId = (await creer()).id
    especeId = 'qa-chevre-' + randomUUID().slice(0, 8)
    await db.especeAnimale.create({ data: { id: especeId, nom: 'Chèvre QA', type: 'mammifere_petit', production: 'lait', userId } as never })
    const lot = (nom: string, proprietaire = userId) => db.lotAnimaux.create({
      data: { userId: proprietaire, especeAnimaleId: especeId, nom, quantiteInitiale: 1, quantiteActuelle: 1 } as never,
    })
    lot1 = (await lot('Lot traité')).id
    lot2 = (await lot('Lot d’arrivée')).id
    animal = (await db.animal.create({ data: { userId, especeAnimaleId: especeId, nom: 'Cannelle', lotId: lot2 } as never })).id
    // L'animal a quitté le lot 1 le 3 janvier pour le lot 2.
    await db.historiqueLotAnimal.createMany({ data: [
      { userId, animalId: animal, lotId: lot1, dateDebut: j('2025-12-01'), dateFin: j('2026-01-03') },
      { userId, animalId: animal, lotId: lot2, dateDebut: j('2026-01-03'), dateFin: null },
      // Même animal et mêmes lots chez un autre compte : ne doit jamais être lu.
      { userId: autreId, animalId: animal, lotId: lot1, dateDebut: j('2025-01-01'), dateFin: null },
    ] })
    // Soin de lot du 1er janvier, attente lait jusqu'au 7.
    await db.soinAnimal.create({ data: {
      userId, lotId: lot1, type: 'traitement', produit: 'Antibiotique QA', fait: true,
      date: new Date('2026-01-01T12:00:00Z'), finAttenteLait: j('2026-01-07'),
    } as never })
  })

  afterAll(async () => {
    if (!db) return
    await db.historiqueLotAnimal.deleteMany({ where: { userId: { in: [userId, autreId] } } })
    for (const id of [userId, autreId]) await db.user.deleteMany({ where: { id } })
    await db.especeAnimale.deleteMany({ where: { id: especeId } })
    await db.$disconnect()
  })

  it('lit l’historique complet du seul compte, par animal et par lot', async () => {
    const { chargerAppartenances } = await import('../attente-lait')
    const parAnimal = await chargerAppartenances(db as never, userId, [animal], [])
    expect(parAnimal.get(animal)?.map((h) => h.lotId)).toEqual([lot2, lot1])
    expect(parAnimal.get(animal)?.[1].dateFin?.toISOString()).toBe('2026-01-03T00:00:00.000Z')
    const parLot = await chargerAppartenances(db as never, userId, [], [lot1])
    expect(parLot.get(animal)).toHaveLength(2)
    expect((await chargerAppartenances(db as never, userId, [], [])).size).toBe(0)
  })

  it('écarte la collecte individuelle de l’animal sorti du lot traité, et le tank du lot d’arrivée', async () => {
    const { soinCouvrantCollecte } = await import('../attente-lait')
    expect(await soinCouvrantCollecte(db as never, userId, animal, null, j('2026-01-05'))).not.toBeNull()
    expect(await soinCouvrantCollecte(db as never, userId, null, lot2, j('2026-01-05'))).not.toBeNull()
    expect(await soinCouvrantCollecte(db as never, userId, null, lot2, j('2026-01-02'))).toBeNull()
    expect(await soinCouvrantCollecte(db as never, userId, animal, null, j('2026-01-08'))).toBeNull()
    expect(await soinCouvrantCollecte(db as never, autreId, animal, null, j('2026-01-05'))).toBeNull()
  })

  it('recalcule l’écartement des collectes déjà saisies, appartenances passées comprises', async () => {
    const { ciblesLaitAffectees, resyncEcartementLait } = await import('../attente-lait')
    const collecte = (data: object) => db.collecteLait.create({ data: { userId, traite: 'Unique', quantiteLitres: 2, ...data } as never })
    const individuelle = await collecte({ animalId: animal, date: j('2026-01-05') })
    const tankArrivee = await collecte({ lotId: lot2, date: j('2026-01-06') })
    const libre = await collecte({ animalId: animal, date: j('2026-01-08') })
    const cibles = await ciblesLaitAffectees(db as never, userId, null, lot1)
    expect(cibles.animalIds).toContain(animal)
    expect(cibles.lotIds).toEqual(expect.arrayContaining([lot1, lot2]))
    await resyncEcartementLait(db as never, userId, cibles, new Date('2026-01-01T12:00:00Z'), j('2026-01-07'))
    const etat = async (id: string) => (await db.collecteLait.findUniqueOrThrow({ where: { id } })).ecarteAttente
    expect(await etat(individuelle.id)).toBe(true)
    expect(await etat(tankArrivee.id)).toBe(true)
    expect(await etat(libre.id)).toBe(false)
  })

  it('lit les traitements du délai avant récolte sans erreur de requête', async () => {
    const { chargerAvertissementsDarLegumes } = await import('@/lib/recolte/dar')
    await db.intervention.create({ data: {
      userId, type: 'traitement_phyto', fait: true, date: j('2026-06-05'), dar: 7, produitPhyto: 'Bouillie QA', cultureId: null,
    } as never })
    // Traitement sans culture, planche ni parcelle : lu, mais ne vise aucun lot.
    const resultat = await chargerAvertissementsDarLegumes(db as never, userId, [
      { id: 1, cultureId: 999_999, plancheId: 'planche-inconnue', parcelleId: 'parcelle-inconnue', date: j('2026-06-10') },
    ])
    expect(resultat.get(1)).toEqual([])
  })
})
