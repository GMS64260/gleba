import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'
import { delegueMemoire } from '@/lib/__tests__/fixtures/referentiel-memoire'

const mocks = vi.hoisted(() => ({ db: {} as Record<string, unknown> }))
vi.mock('@/lib/prisma', () => ({ default: mocks.db }))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: async () => ({ error: null, session: { user: { id: 'ferme-a' } } }) }))
vi.mock('@/lib/abonnement/serveur', async () => {
  const { accesComplet } = await import('@/lib/abonnement/politique')
  return { chargerAccesService: async () => accesComplet('libre') }
})
import { GET, type SearchItem } from './route'

// Graine imprimée dans le nom du test pour reproduire toute combinaison.
const GRAINE = 341705

describe('invariants de visibilité des noms recherchés', () => {
  it(`aucun nom privé ne sélectionne ni ne décrit une production — 384 cas, graine ${GRAINE}`, async () => {
    let graine = GRAINE
    const alea = (n: number) => {
      graine = (Math.imul(graine, 1664525) + 1013904223) >>> 0
      return (graine >>> 16) % n
    }
    const origines = [
      { userId: null, partageCommunaute: false, visible: true },
      { userId: 'ferme-a', partageCommunaute: false, visible: true },
      { userId: 'ferme-b', partageCommunaute: true, visible: true },
      { userId: 'ferme-b', partageCommunaute: false, visible: false },
    ]
    for (const modele of ['arbre', 'animal', 'lotAnimaux', 'client', 'facture', 'documentCommercial', 'parcelleGeo', 'soinAnimal', 'produitBoutique']) {
      mocks.db[modele] = delegueMemoire([])
    }
    for (let cas = 0; cas < 384; cas++) {
      const origineEspece = origines[alea(4)]
      const origineVariete = origines[alea(4)]
      const origineParent = origines[alea(4)]
      const propre = alea(3) !== 0
      const espece = { id: 'ref-espece', nom: 'Épinard espèce', nomNormalise: 'epinard espece', ...origineEspece }
      const variete = { id: 'ref-variete', nom: 'Épinard variété', nomNormalise: 'epinard variete', ...origineVariete,
        especeId: 'ref-parent', espece: { id: 'ref-parent', ...origineParent } }
      const userId = propre ? 'ferme-a' : 'ferme-b'
      mocks.db.variete = delegueMemoire([variete])
      mocks.db.culture = delegueMemoire([{ id: 1, userId, especeId: espece.id, varieteId: variete.id, espece, variete, annee: 2026 }])
      mocks.db.recolte = delegueMemoire([{ id: 2, userId, especeId: espece.id, espece, quantite: 1, date: new Date('2026-11-01') }])
      const varieteVisible = origineVariete.visible && origineParent.visible
      const res = await GET(new NextRequest(`http://localhost/api/search?q=${cas % 2 ? 'ÉPINARD' : 'epinard'}`))
      const items = (await res.json()).items as SearchItem[]
      expect(items.some(i => i.type === 'Culture'), `culture cas ${cas}`).toBe(propre && (origineEspece.visible || varieteVisible))
      expect(items.some(i => i.type === 'Récolte'), `récolte cas ${cas}`).toBe(propre && origineEspece.visible)
      expect(items.some(i => i.type === 'Variété'), `variété cas ${cas}`).toBe(varieteVisible)
      if (!origineEspece.visible) expect(JSON.stringify(items)).not.toContain(espece.nom)
      if (!varieteVisible) expect(JSON.stringify(items)).not.toContain(variete.nom)
      // Les ids historiques du compte restent utilisables, même si les noms se ferment.
      const historique = await GET(new NextRequest('http://localhost/api/search?q=ref-'))
      const anciens = (await historique.json()).items as SearchItem[]
      expect(anciens.some(i => i.type === 'Culture')).toBe(propre)
      expect(anciens.some(i => i.type === 'Récolte')).toBe(propre)
      if (!origineEspece.visible) expect(JSON.stringify(anciens)).not.toContain(espece.nom)
      if (!varieteVisible) expect(JSON.stringify(anciens)).not.toContain(variete.nom)
    }
  })
})
