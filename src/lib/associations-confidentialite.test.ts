import { describe, expect, it, vi } from 'vitest'
import { checkAdjacence } from './associations-adjacence'
import { chargerContexteEspeces } from './associations-alertes'
import { estVisibleReferentiel, visibiliteReferentiel } from './referentiel-communaute'

const especes = [
  { id: 'aubergine', nom: 'Aubergine', familleId: 'Solanaceae', userId: null },
  { id: 'secrete-b', nom: 'Sélection secrète fictive B', familleId: 'Fabaceae', userId: 'B', partageCommunaute: false },
  { id: 'perso-a', nom: 'Sélection A', familleId: 'Fabaceae', userId: 'A', partageCommunaute: false },
  { id: 'communaute', nom: 'Sélection partagée B', familleId: 'Fabaceae', userId: 'B', partageCommunaute: true },
]
function base() {
  return {
    espece: { findMany: vi.fn(async ({ where }: { where: { AND: [{ id: { in: string[] } }, unknown] } }) => {
      expect(where.AND[1]).toEqual(visibiliteReferentiel('A'))
      return especes.filter((e) => where.AND[0].id.in.includes(e.id) && estVisibleReferentiel(e, 'A'))
    }) },
    planche: {
      findFirst: vi.fn().mockResolvedValue({ id: 'p1', nom: 'P1', ilot: 'Nord' }),
      findMany: vi.fn().mockResolvedValue([{ id: 'p2', nom: 'P2' }]),
    },
    culture: { findMany: vi.fn().mockResolvedValue([{ especeId: 'aubergine', plancheId: 'p2', annee: 2027, terminee: null, espece: { vivace: false } }]) },
    association: { findMany: vi.fn().mockResolvedValue([{
      id: 'famille-publique', nom: 'Aubergine et Fabaceae', type: 'favorable',
      details: [{ especeId: 'aubergine' }, { familleId: 'Fabaceae' }],
    }, {
      id: 'partenaires', nom: 'Compagnons', type: 'favorable',
      details: ['aubergine', 'secrete-b', 'perso-a', 'communaute'].map((especeId) => ({ especeId })),
    }]) },
  }
}
const maintenant = new Date('2027-06-01T12:00:00Z')
describe('confidentialité du contexte des associations', () => {
  it('ne charge ni nom ni famille privés d’une autre exploitation', async () => {
    const tx = base()
    const contexte = await chargerContexteEspeces(tx as never, especes.map((e) => e.id), 'A')
    expect([...contexte.keys()]).toEqual(['aubergine', 'perso-a', 'communaute'])
    expect(JSON.stringify([...contexte])).not.toContain('Sélection secrète')
  })
  it('rend la même réponse vide pour une candidate invisible et une candidate inconnue', async () => {
    const tx = base()
    const invisible = await checkAdjacence('secrete-b', 'p1', 'A', tx as never, maintenant)
    const inconnue = await checkAdjacence('inconnue', 'p1', 'A', tx as never, maintenant)
    expect(invisible).toEqual(inconnue)
    expect(invisible).toEqual({ alertes: [], suggestions: [], ilot: null, planchesVoisines: [] })
    expect(tx.association.findMany).not.toHaveBeenCalled()
    expect(tx.culture.findMany).not.toHaveBeenCalled()
  })
  it('conserve les règles de famille pour les espèces personnelles visibles', async () => {
    const res = await checkAdjacence('perso-a', 'p1', 'A', base() as never, maintenant)
    expect(res.alertes).toHaveLength(1)
    expect(res.alertes[0].message).toContain('Sélection A')
  })
  it('filtre les partenaires privés même si une ancienne règle les référence', async () => {
    const tx = base()
    const res = await checkAdjacence('aubergine', 'p1', 'A', tx as never, maintenant)
    expect(res.suggestions.map((s) => s.especeId)).toEqual(['perso-a', 'communaute'])
    expect(JSON.stringify(res)).not.toMatch(/secrete-b|Sélection secrète/)
    expect(tx.association.findMany.mock.calls[0][0].where.details.none).toEqual({ requise: true, espece: { is: { NOT: visibiliteReferentiel('A') } } })
    expect(tx.association.findMany.mock.calls[0][0].include.details.where.OR[1]).toEqual({ espece: { is: visibiliteReferentiel('A') } })
  })
})
