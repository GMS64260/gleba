import { describe, expect, it, vi } from 'vitest'
import { SERIE_MAX, creerPlanchesSerie, messageSerie, nomsDeSerie, planchesSerieSchema } from '../serie'

function dbFactice(nomsExistants: string[] = []) {
  const createMany = vi.fn(async () => ({ count: 0 }))
  return {
    createMany,
    planche: {
      findMany: async ({ where }: { where: { nom: { in: string[] } } }) =>
        where.nom.in.filter((nom) => nomsExistants.includes(nom)).map((nom) => ({ nom })),
      createMany,
    },
  }
}

describe('création de planches en série', () => {
  it('génère les noms attendus, avec ou sans zéros à gauche', () => {
    expect(nomsDeSerie({ prefixe: 'Z1p', debut: 4, nombre: 3 })).toEqual(['Z1p4', 'Z1p5', 'Z1p6'])
    expect(nomsDeSerie({ prefixe: 'Z2-p', nombre: 2 })).toEqual(['Z2-p1', 'Z2-p2'])
    expect(nomsDeSerie({ prefixe: 'P', nombre: 2, padding: 2 })).toEqual(['P01', 'P02'])
  })

  // Régression du 2026-08-06 : l'assistant promettait 14 planches et n'en créait
  // qu'une. Une série doit créer exactement ce qu'elle annonce.
  it('crée toute la série demandée en un appel', async () => {
    const db = dbFactice()
    const input = planchesSerieSchema.parse({
      prefixe: 'Z1p', debut: 4, nombre: 14, largeur: 0.8, longueur: 17, ilot: 'Zone 1',
    })

    const resultat = await creerPlanchesSerie(db, 'user-1', input)

    expect(resultat.crees).toHaveLength(14)
    expect(resultat.crees[0]).toBe('Z1p4')
    expect(resultat.crees[13]).toBe('Z1p17')
    expect(resultat.ignores).toEqual([])
    const data = db.createMany.mock.calls[0][0].data
    expect(data).toHaveLength(14)
    expect(data[0]).toMatchObject({ userId: 'user-1', largeur: 0.8, longueur: 17, surface: 13.6, ilot: 'Zone 1' })
  })

  it('ignore les noms déjà pris sans jamais les écraser', async () => {
    const db = dbFactice(['Z1p1', 'Z1p2'])
    const input = planchesSerieSchema.parse({ prefixe: 'Z1p', nombre: 4 })

    const resultat = await creerPlanchesSerie(db, 'user-1', input)

    expect(resultat.crees).toEqual(['Z1p3', 'Z1p4'])
    expect(resultat.ignores).toEqual(['Z1p1', 'Z1p2'])
    expect(messageSerie(resultat)).toContain('déjà utilisés')
  })

  it('ne calcule une surface que si les deux dimensions sont fournies', async () => {
    const db = dbFactice()
    await creerPlanchesSerie(db, 'user-1', planchesSerieSchema.parse({ prefixe: 'P', nombre: 1, longueur: 17 }))
    expect(db.createMany.mock.calls[0][0].data[0]).toMatchObject({ surface: null, longueur: 17, largeur: null })
  })

  it('refuse un nom qui dépasserait la limite du modèle', async () => {
    const db = dbFactice()
    const input = planchesSerieSchema.parse({ prefixe: 'x'.repeat(48), nombre: 1, debut: 1000 })
    await expect(creerPlanchesSerie(db, 'user-1', input)).rejects.toThrow(/trop long/)
  })

  // La surface 13.600000000000001 est réellement partie à un utilisateur.
  it('arrondit la surface au lieu d’exposer un flottant brut', async () => {
    const db = dbFactice()
    await creerPlanchesSerie(db, 'user-1', planchesSerieSchema.parse({
      prefixe: 'Z1p', nombre: 1, largeur: 0.8, longueur: 17,
    }))
    expect(db.createMany.mock.calls[0][0].data[0].surface).toBe(13.6)
  })

  it('borne la taille de la série et exige un préfixe', () => {
    expect(planchesSerieSchema.safeParse({ prefixe: 'P', nombre: SERIE_MAX + 1 }).success).toBe(false)
    expect(planchesSerieSchema.safeParse({ prefixe: '', nombre: 2 }).success).toBe(false)
    expect(planchesSerieSchema.safeParse({ prefixe: 'P', nombre: 0 }).success).toBe(false)
  })

  it('annonce un bilan lisible', () => {
    expect(messageSerie({ crees: ['Z1p4', 'Z1p5', 'Z1p6'], ignores: [] })).toBe('3 planches créées (Z1p4 à Z1p6)')
    expect(messageSerie({ crees: [], ignores: [] })).toBe('Aucune planche créée')
  })
})
