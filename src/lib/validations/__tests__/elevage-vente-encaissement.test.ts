import { describe, expect, it } from 'vitest'
import { venteProduitSchema } from '../elevage-vente'

describe('confirmation d’encaissement d’une vente d’élevage', () => {
  it.each(['animal_vivant', 'fromage', 'oeufs', 'lait', 'miel'])(
    'laisse une vente de %s à encaisser si seul son mode est renseigné',
    (type) => {
      const vente = venteProduitSchema.parse({
        type, quantite: 1, unite: 'unite', prixUnitaire: 100, modeReglement: 'Virement',
      })
      expect(vente.paye).toBe(false)
      expect(vente.modeReglement).toBe('Virement')
    },
  )

  it('accepte un encaissement explicitement confirmé et conserve son mode', () => {
    expect(venteProduitSchema.parse({
      type: 'fromage', quantite: 2, unite: 'pièce', prixUnitaire: 3,
      paye: true, modeReglement: 'Chèque',
    })).toMatchObject({ paye: true, modeReglement: 'Chèque' })
  })
})
