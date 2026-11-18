import { describe, expect, it, vi } from 'vitest'
import { chargerPorteGreffesArbres } from './porte-greffe-lecture'

const GRAINE = 20261118
type Db = Parameters<typeof chargerPorteGreffesArbres>[0]

describe('invariants de visibilité des porte-greffes', () => {
  it(`préserve les arbres et ne révèle que les références visibles sur 512 entrées (graine ${GRAINE})`, async () => {
    let etat = GRAINE
    const aleatoire = () => {
      etat = (Math.imul(etat, 1664525) + 1013904223) >>> 0
      return etat / 2 ** 32
    }
    const tenant = 'ferme-fictive'
    const references = Array.from({ length: 64 }, (_, i) => ({
      id: `pg-fictif-${i}`, nom: `Référence fictive ${i}`, vigueur: 1 + Math.floor(aleatoire() * 5),
      userId: [null, tenant, 'autre-ferme-fictive', 'acteur-fictif'][i % 4],
      partageCommunaute: aleatoire() > 0.5,
    }))
    const arbres = Array.from({ length: 512 }, (_, i) => Object.freeze({
      id: i, porteGreffeId: i % 9 === 0 ? null : i % 7 === 0 ? 'absente' : references[Math.floor(aleatoire() * references.length)].id,
      portGreffe: i % 5 === 0 ? `Saisie fictive ${i}` : null,
      // Même une ancienne relation en mémoire doit être remplacée.
      porteGreffeRef: { id: 'obsolete', nom: 'Ancienne jointure', vigueur: 5 },
    }))
    const avant = JSON.stringify(arbres)
    const findMany = vi.fn(async () => references
      .filter(r => r.userId === null || r.userId === tenant || r.partageCommunaute)
      .map(({ id, nom, vigueur }) => ({ id, nom, vigueur })))
    const resultat = await chargerPorteGreffesArbres({ porteGreffe: { findMany } } as unknown as Db, tenant, arbres)
    expect(findMany).toHaveBeenCalledOnce()
    expect(findMany).toHaveBeenCalledWith({
      where: { id: { in: [...new Set(arbres.flatMap(a => a.porteGreffeId ? [a.porteGreffeId] : []))] }, OR: [{ userId: null }, { partageCommunaute: true }, { userId: tenant }] },
      select: { id: true, nom: true, vigueur: true },
    })
    expect(resultat).toHaveLength(arbres.length)
    resultat.forEach((arbre, i) => {
      expect(arbre.id).toBe(arbres[i].id)
      expect(arbre.porteGreffeId).toBe(arbres[i].porteGreffeId)
      expect(arbre.portGreffe).toBe(arbres[i].portGreffe)
      const reference = references.find(r => r.id === arbre.porteGreffeId)
      if (reference && (reference.userId === null || reference.userId === tenant || reference.partageCommunaute)) {
        expect(arbre.porteGreffeRef).toEqual({ id: reference.id, nom: reference.nom, vigueur: reference.vigueur })
      } else {
        expect(arbre.porteGreffeRef).toBeNull()
      }
    })
    expect(JSON.stringify(arbres)).toBe(avant)
  })

  it('ne lit aucun catalogue pour une liste vide ou sans référence', async () => {
    const findMany = vi.fn()
    const db = { porteGreffe: { findMany } } as unknown as Db
    expect(await chargerPorteGreffesArbres(db, 'ferme-fictive', [])).toEqual([])
    expect(await chargerPorteGreffesArbres(db, 'ferme-fictive', [{ porteGreffeId: null, portGreffe: 'Libre' }])).toEqual([
      { porteGreffeId: null, portGreffe: 'Libre', porteGreffeRef: null },
    ])
    expect(findMany).not.toHaveBeenCalled()
  })
})
