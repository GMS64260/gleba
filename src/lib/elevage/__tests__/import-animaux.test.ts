import { describe, expect, it } from 'vitest'
import { csvRowToAnimal, parseAnimauxCsv } from '../import-animaux'

describe('import CSV animaux', () => {
  it('accepte le CSV français au point-virgule et les champs entre guillemets', () => {
    const rows = parseAnimauxCsv('espece;identifiant;nom;prix_achat\nchevre_alpine;FR123456789012;"Neige, la blanche";350,50')
    expect(rows).toHaveLength(1)
    expect(rows[0].nom).toBe('Neige, la blanche')
    expect(csvRowToAnimal(rows[0], 'chevre_alpine')).toMatchObject({
      especeAnimaleId: 'chevre_alpine', prixAchat: 350.5, statut: 'actif',
    })
  })

  it('refuse un fichier sans colonne espece', () => {
    expect(() => parseAnimauxCsv('nom;race\nNeige;Alpine')).toThrow(/espece/)
  })
})
