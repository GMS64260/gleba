import { describe, expect, it, vi } from 'vitest'
import { chargerAvertissementsDarFruits, chargerVerdictsDarFruits } from '../dar'

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
const db = (observations: Obs[], interventions: unknown[] = [], operations: unknown[] = []) => ({
  observationSante: { findMany: vi.fn(async () => observations) },
  intervention: { findMany: vi.fn(async () => interventions) },
  operationArbre: { findMany: vi.fn(async () => operations) },
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

  it('une observation sans traitement ou un geste mécanique sans délai : rien', async () => {
    const lignes = [
      obs({ produit: null, methodeTraitement: null }),
      obs({ produit: 'Glu', methodeTraitement: 'mecanique_manuel' }),
    ]
    const r = await chargerAvertissementsDarFruits(db(lignes) as never, 'u', [recolte])
    expect(r.get(1)).toEqual([])
  })

  it('CR-DAR-01 : une décoction sans délai rappelle les conditions d’approbation, sans les 3 jours ; délai nul déclaré : rien', async () => {
    const prele = obs({ produit: 'Décoction de prêle', methodeTraitement: 'biologique_purin' })
    const r = await chargerAvertissementsDarFruits(db([prele]) as never, 'u', [recolte])
    expect(r.get(1)).toHaveLength(1)
    expect(r.get(1)![0]).toMatch(/délai inconnu pour Décoction de prêle/)
    expect(r.get(1)![0]).not.toMatch(/3 jours|AMM/)
    const nul = await chargerAvertissementsDarFruits(db([{ ...prele, dar: 0 }]) as never, 'u', [recolte])
    expect(nul.get(1)).toEqual([])
  })

  it('une intervention sans délai sur l’arbre est lue et signalée', async () => {
    const intervention = { arbreId: 1, parcelleId: null, date: hier, dar: null, produitPhyto: 'Fongicide Y', geste: null, produitPhytoRef: null }
    const base = db([], [intervention])
    const r = await chargerAvertissementsDarFruits(base as never, 'u', [recolte])
    expect(r.get(1)![0]).toContain('DAR non renseigné pour Fongicide Y')
    const where = (base.intervention.findMany.mock.calls[0] as unknown as [{ where: { OR: unknown[] } }])[0].where
    expect(where.OR).toHaveLength(3)
  })

  /**
   * Revues QA et adverse du lot dar-cadre-legal-blocage (tour 2) : un
   * traitement réalisé saisi dans Verger > Opérations (OperationArbre) figurait
   * au registre phyto mais n'entrait pas au verdict ; la récolte du lendemain
   * restait vendable sans un mot.
   */
  describe('traitements saisis dans Verger > Opérations', () => {
    const operation = (o: object = {}) => ({ arbreId: 1, date: hier, dar: null, produit: 'Fongicide Z', natureProduit: null, ...o })

    it('opération de traitement de la veille, sans délai : bloquant au titre des 3 jours par défaut', async () => {
      const base = db([], [], [operation()])
      const v = (await chargerVerdictsDarFruits(base as never, 'ferme-a', [recolte])).get(1)!
      expect(v.niveau).toBe('bloquant')
      expect(v.blocages[0]).toContain('DAR non renseigné pour Fongicide Z')
      expect(v.traitements[0]).toMatchObject({ produit: 'Fongicide Z', origineDelai: 'defaut_legal' })
      // Lecture bornée à l'exploitation, à l'arbre, aux traitements RÉALISÉS.
      const where = (base.operationArbre.findMany.mock.calls[0] as unknown as [{ where: Record<string, unknown> }])[0].where
      expect(where).toMatchObject({ userId: 'ferme-a', arbreId: { in: [1] }, type: 'traitement', fait: true })
    })

    it('délai saisi de 14 jours : bloquant ; substance de base sans délai : rappel ; biostimulant : rien', async () => {
      const quatorze = (await chargerVerdictsDarFruits(db([], [], [operation({ dar: 14 })]) as never, 'u', [recolte])).get(1)!
      expect(quatorze.traitements[0]).toMatchObject({ origineDelai: 'saisi' })
      const prele = (await chargerVerdictsDarFruits(db([], [], [operation({ produit: 'Décoction de prêle', natureProduit: 'substance_base' })]) as never, 'u', [recolte])).get(1)!
      expect(prele.niveau).toBe('informatif')
      expect(prele.rappels[0]).toMatch(/délai inconnu pour Décoction de prêle/)
      const purin = (await chargerVerdictsDarFruits(db([], [], [operation({ produit: 'Purin d’ortie', natureProduit: 'biostimulant' })]) as never, 'u', [recolte])).get(1)!
      expect(purin.niveau).toBe('rien')
    })

    it('l’opération d’un autre arbre ne touche pas la récolte ; au-delà de 3 jours, simple rappel', async () => {
      const autre = (await chargerVerdictsDarFruits(db([], [], [operation({ arbreId: 2 })]) as never, 'u', [recolte])).get(1)!
      expect(autre.niveau).toBe('rien')
      const ancienne = (await chargerVerdictsDarFruits(db([], [], [operation({ date: new Date(2026, 4, 31, 10) })]) as never, 'u', [recolte])).get(1)!
      expect(ancienne.niveau).toBe('informatif')
    })

    it('chacune des trois sources (observation, intervention, opération) bloque à elle seule', async () => {
      const intervention = { arbreId: 1, parcelleId: null, date: hier, dar: null, produitPhyto: 'Fongicide Y', geste: null, produitPhytoRef: null }
      for (const base of [db([obs({})]), db([], [intervention]), db([], [], [operation()])]) {
        expect((await chargerVerdictsDarFruits(base as never, 'u', [recolte])).get(1)!.niveau).toBe('bloquant')
      }
    })
  })
})
