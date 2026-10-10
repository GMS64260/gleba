/**
 * Ticket cmv29j6q7 — le stock d'une variété est celui de l'utilisateur, jamais
 * une colonne de la variété partagée par tous les comptes.
 */
import { describe, expect, it, vi } from 'vitest'
import {
  enregistrerStockVariete,
  porteUnStockVariete,
  separerStockVariete,
  serialiserVariete,
  stockVarieteSchema,
} from '../stock-variete'

function fauxDb(existant: Record<string, unknown> | null = null) {
  const findUnique = vi.fn().mockResolvedValue(existant)
  const create = vi.fn().mockImplementation(async ({ data }) => ({ id: 1, ...data }))
  const update = vi.fn().mockImplementation(async ({ data }) => ({ ...(existant ?? {}), ...data }))
  return { db: { userStockVariete: { findUnique, create, update } } as never, findUnique, create, update }
}

describe('separerStockVariete / porteUnStockVariete', () => {
  it('retire les champs de stock du corps catalogue', () => {
    const { catalogue, stock } = separerStockVariete({
      especeId: 'Tomate',
      nbGrainesG: 300,
      stockGraines: 80,
      stockPlants: null,
      dateStock: undefined,
    })
    expect(catalogue).toEqual({ especeId: 'Tomate', nbGrainesG: 300 })
    expect(stock).toEqual({ stockGraines: 80, stockPlants: null, dateStock: undefined })
    expect(porteUnStockVariete(stock)).toBe(true)
    expect(porteUnStockVariete({})).toBe(false)
    expect(porteUnStockVariete({ dateStock: new Date() })).toBe(true)
  })

  it('refuse une quantité négative ou des plants non entiers', () => {
    expect(stockVarieteSchema.safeParse({ stockPlants: -5 }).success).toBe(false)
    expect(stockVarieteSchema.safeParse({ stockPlants: 12.7 }).success).toBe(false)
    expect(stockVarieteSchema.safeParse({ stockGraines: 12.7, stockPlants: 12 }).success).toBe(true)
  })
})

describe('enregistrerStockVariete', () => {
  it("rend la ligne existante sans écrire quand aucun stock n'est saisi", async () => {
    const ligne = { stockGraines: 80, stockPlants: null, dateStock: new Date('2026-09-01') }
    const { db, create, update } = fauxDb(ligne)
    await expect(enregistrerStockVariete(db, 'u1', 'Tomate Cerise', {})).resolves.toBe(ligne)
    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it("ne crée pas de ligne vide quand les deux quantités sont null et qu'aucune ligne n'existe", async () => {
    const { db, create, update } = fauxDb(null)
    await expect(
      enregistrerStockVariete(db, 'u1', 'Tomate Cerise', { stockGraines: null, stockPlants: null }),
    ).resolves.toBeNull()
    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it("crée la ligne de l'utilisateur, par (userId, varieteId)", async () => {
    const { db, create } = fauxDb(null)
    await enregistrerStockVariete(db, 'u1', 'Tomate Cerise', { stockGraines: 80 })
    expect(create).toHaveBeenCalledTimes(1)
    const { data } = create.mock.calls[0][0]
    expect(data).toMatchObject({ userId: 'u1', varieteId: 'Tomate Cerise', stockGraines: 80, stockPlants: null })
    expect(data.dateStock).toBeInstanceOf(Date)
  })

  it("met à jour une quantité sans toucher l'autre, et vide celle explicitement null", async () => {
    const { db, update } = fauxDb({ stockGraines: 80, stockPlants: 12, dateStock: new Date('2026-09-01') })
    await enregistrerStockVariete(db, 'u1', 'v', { stockGraines: null })
    const { where, data } = update.mock.calls[0][0]
    expect(where).toEqual({ userId_varieteId: { userId: 'u1', varieteId: 'v' } })
    expect(data).toMatchObject({ stockGraines: null })
    expect(data).not.toHaveProperty('stockPlants')
    expect(data.dateStock).toBeInstanceOf(Date)
  })

  it("une date seule corrige la date d'une ligne existante", async () => {
    const date = new Date('2026-09-01')
    const { db, update } = fauxDb({ stockGraines: 80, stockPlants: null, dateStock: new Date() })
    await enregistrerStockVariete(db, 'u1', 'v', { dateStock: date })
    expect(update.mock.calls[0][0].data).toEqual({ dateStock: date })
  })
})

describe('serialiserVariete', () => {
  it("retire les colonnes de stock de la variété et expose le stock de l'appelant", () => {
    const sortie = serialiserVariete(
      { id: 'Tomate Cerise', nbGrainesG: 300, stockGraines: 80, stockPlants: 3, dateStock: new Date() },
      { stockGraines: 20, stockPlants: null, dateStock: null },
    )
    expect(sortie).toEqual({ id: 'Tomate Cerise', nbGrainesG: 300, userStockGraines: 20, userStockPlants: null, userStockDate: null })
    expect(serialiserVariete({ id: 'v' }, null).userStockGraines).toBeNull()
  })
})
