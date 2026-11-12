import { describe, expect, it, vi } from 'vitest'
import { chargerAvertissementsDarFruits } from '../dar'

/**
 * Revue réglementaire du 2026-11-12 (C5) : un traitement d'arbre sans DAR
 * était écarté par la lecture (`dar > 0`) puis compté pour 0 jour. Arrêté du
 * 4 mai 2017, art. 3, I : 3 jours par défaut sauf disposition contraire de
 * l'AMM. La récolte reste enregistrée ; seul un avertissement est produit.
 */
type Obs = { arbreId: number; parcelleId: string | null; date: Date; dar: number | null; produit: string | null; numAMM: string | null; methodeTraitement: string | null }
const hier = new Date(2026, 5, 9, 10)
const recolte = { id: 1, arbreId: 1, parcelleId: null, date: new Date(2026, 5, 10, 9) }
const obs = (o: Partial<Obs>): Obs => ({ arbreId: 1, parcelleId: null, date: hier, dar: null, produit: 'Fongicide X', numAMM: null, methodeTraitement: 'chimique_conventionnel', ...o })
const db = (observations: Obs[], interventions: unknown[] = []) => ({
  observationSante: { findMany: vi.fn(async () => observations) },
  intervention: { findMany: vi.fn(async () => interventions) },
})

describe('délai avant récolte des fruits', () => {
  it('traitement de la veille sans DAR : avertit avec le défaut légal', async () => {
    const r = await chargerAvertissementsDarFruits(db([obs({})]) as never, 'u', [recolte])
    expect(r.get(1)).toHaveLength(1)
    expect(r.get(1)![0]).toContain('DAR non renseigné pour Fongicide X')
  })

  it('un délai positif saisi garde son message', async () => {
    const r = await chargerAvertissementsDarFruits(db([obs({ dar: 7 })]) as never, 'u', [recolte])
    expect(r.get(1)![0]).toContain('avant la fin du délai saisi pour Fongicide X (7 jours')
  })

  it('une observation sans traitement, un purin ou un geste mécanique sans délai : rien', async () => {
    const lignes = [
      obs({ produit: null, methodeTraitement: null }),
      obs({ produit: 'Purin d’ortie', methodeTraitement: 'biologique_purin' }),
      obs({ produit: 'Glu', methodeTraitement: 'mecanique_manuel' }),
    ]
    const r = await chargerAvertissementsDarFruits(db(lignes) as never, 'u', [recolte])
    expect(r.get(1)).toEqual([])
  })

  it('une intervention sans délai sur l’arbre est lue et signalée', async () => {
    const intervention = { arbreId: 1, parcelleId: null, date: hier, dar: null, produitPhyto: 'Fongicide Y', geste: null, produitPhytoRef: null }
    const base = db([], [intervention])
    const r = await chargerAvertissementsDarFruits(base as never, 'u', [recolte])
    expect(r.get(1)![0]).toContain('DAR non renseigné pour Fongicide Y')
    const where = (base.intervention.findMany.mock.calls[0] as unknown as [{ where: { OR: unknown[] } }])[0].where
    expect(where.OR).toHaveLength(3)
  })
})
