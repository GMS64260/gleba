import { describe, expect, it } from 'vitest'
import { venteProduitSchema } from '../elevage-vente'

// Décision du 2026-10-30 : une vente démarre payée ; décocher en fait une
// vente à crédit, qui reste à encaisser.
describe('statut de règlement d’une vente d’élevage', () => {
  it.each(['animal_vivant', 'fromage', 'oeufs', 'lait', 'miel'])(
    'présume payée une vente de %s sans statut explicite et garde son mode',
    (type) => {
      const vente = venteProduitSchema.parse({
        type, quantite: 1, unite: 'unite', prixUnitaire: 100, modeReglement: 'Virement',
      })
      expect(vente.paye).toBe(true)
      expect(vente.modeReglement).toBe('Virement')
    },
  )

  it('présume payée une vente sans mode : aucun mode n’est inventé', () => {
    const vente = venteProduitSchema.parse({ type: 'oeufs', quantite: 1, unite: 'douzaine', prixUnitaire: 3 })
    expect(vente.paye).toBe(true)
    expect(vente.modeReglement).toBeUndefined()
  })

  it('laisse à encaisser une vente décochée, avec ou sans mode', () => {
    expect(venteProduitSchema.parse({
      type: 'fromage', quantite: 2, unite: 'pièce', prixUnitaire: 3, paye: false, modeReglement: 'Chèque',
    })).toMatchObject({ paye: false, modeReglement: 'Chèque' })
    expect(venteProduitSchema.parse({
      type: 'fromage', quantite: 2, unite: 'pièce', prixUnitaire: 3, paye: false,
    }).paye).toBe(false)
  })

  it('déduit « à encaisser » d’un mode « À crédit » sans statut explicite', () => {
    expect(venteProduitSchema.parse({
      type: 'animal_vivant', quantite: 1, unite: 'unite', prixUnitaire: 100, modeReglement: 'À crédit',
    })).toMatchObject({ paye: false, modeReglement: 'À crédit' })
  })

  it('refuse une vente déclarée payée et « À crédit » à la fois', () => {
    const resultat = venteProduitSchema.safeParse({
      type: 'oeufs', quantite: 1, unite: 'douzaine', prixUnitaire: 3, paye: true, modeReglement: 'À crédit',
    })
    expect(resultat.success).toBe(false)
    expect(resultat.error?.flatten().fieldErrors.modeReglement).toBeDefined()
  })

  it('garde la règle du prix nul : une vente présumée payée à 0 € est refusée, sauf cession gratuite', () => {
    const base = { type: 'animal_vivant', quantite: 1, unite: 'unite', prixUnitaire: 0 }
    expect(venteProduitSchema.safeParse(base).success).toBe(false)
    expect(venteProduitSchema.safeParse({ ...base, paye: false }).success).toBe(true)
    expect(venteProduitSchema.parse({ ...base, cessionGratuite: true }).paye).toBe(true)
  })
})
