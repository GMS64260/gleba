/** Rejeu du SQL livré, PostgreSQL réel et données fictives, base jetable uniquement. */
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import db from '@/lib/prisma'

describe.skipIf(process.env.GLEBA_PR73_POSTGRES !== '1')('migration des associations orphelines', () => {
  beforeAll(() => {
    if (!new URL(process.env.DATABASE_URL || '').pathname.startsWith('/gleba_jetable_')) {
      throw new Error('Base jetable gleba_jetable_* obligatoire : le SQL nettoie le référentiel global')
    }
  })
  afterAll(async () => { await db.$disconnect() })

  it('conserve la règle volontaire pivot+famille et ses détails, nettoie les lignes réellement vides', async () => {
    const suffixe = randomUUID()
    const pivot = `pivot-fictif-${suffixe}`
    const famille = `famille-fictive-${suffixe}`
    const id = `association-volontaire-${suffixe}`
    const vide = `association-vide-${suffixe}`
    try {
      await db.espece.create({ data: { id: pivot, nom: pivot } })
      await db.famille.create({ data: { id: famille } })
      await db.association.create({ data: { id, nom: 'Règle volontaire fictive', type: 'incompatible',
        details: { create: [{ especeId: pivot, requise: true }, { familleId: famille }] } } })
      await db.association.create({ data: { id: vide, nom: 'Règle vide fictive',
        details: { create: [{ groupe: ' ' }] } } })
      const avant = await db.association.findUniqueOrThrow({ where: { id }, include: { details: true } })
      const sql = readFileSync('prisma/migrations/20261113132000_associations_lignes_orphelines/migration.sql', 'utf8')
      // Ce fichier ne contient que des DELETE simples ; exécuter chaque instruction exacte.
      const instructions = sql.replace(/--[^\n]*/g, '').split(';').filter((s) => s.trim())
      for (let rejeu = 0; rejeu < 2; rejeu++) {
        await db.$transaction(instructions.map((s) => db.$executeRawUnsafe(s)))
        expect(await db.association.findUnique({ where: { id }, include: { details: true } })).toEqual(avant)
        expect(await db.association.findUnique({ where: { id: vide } })).toBeNull()
      }
    } finally {
      await db.association.deleteMany({ where: { id: { in: [id, vide] } } })
      await db.espece.deleteMany({ where: { id: pivot } })
      await db.famille.deleteMany({ where: { id: famille } })
    }
  })
})
