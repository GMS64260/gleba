import { describe, expect, it } from 'vitest'
import { positionsEnGrille } from './grille-planches'

describe('positionsEnGrille (D236)', () => {
  it('ne superpose pas des planches de tailles différentes', () => {
    const planches = [{ largeur: 4, longueur: 8 }, { largeur: 1, longueur: 2 }, { largeur: 1.2, longueur: 10 }]
    const positions = positionsEnGrille(planches)
    expect(positions).toEqual([{ posX: 0, posY: 0 }, { posX: 4.5, posY: 0 }, { posX: 0, posY: 8.5 }])
    // Aucune paire ne se recouvre.
    const boites = planches.map((p, i) => ({ ...positions[i], l: p.largeur, h: p.longueur }))
    for (let a = 0; a < boites.length; a++) for (let b = a + 1; b < boites.length; b++) {
      const A = boites[a], B = boites[b]
      const separees = A.posX + A.l <= B.posX || B.posX + B.l <= A.posX || A.posY + A.h <= B.posY || B.posY + B.h <= A.posY
      expect(separees).toBe(true)
    }
  })

  it('compte une planche tournée pour son emprise réelle', () => {
    // 4 × 8 m tournée de 90° : elle occupe 8 m de large et 4 m de haut autour de son centre.
    const positions = positionsEnGrille([{ largeur: 4, longueur: 8, rotation2D: 90 }, { largeur: 1, longueur: 2 }])
    // Emprise de la première : de x = 0 à 8 (coin non tourné décalé de +2), de y = 0 à 4 (décalé de −2).
    expect(positions[0]).toEqual({ posX: 2, posY: -2 })
    expect(positions[1]).toEqual({ posX: 8.5, posY: 0 })
  })

  it('garde le pas par défaut pour une planche sans dimensions', () => {
    expect(positionsEnGrille([{}, {}])).toEqual([{ posX: 0, posY: 0 }, { posX: 1.3, posY: 0 }])
  })
})
