import { describe, expect, it } from 'vitest'
import { champsReellementEnvoyes } from '@/lib/validations/champs-envoyes'
import { updateClientSchema } from '@/lib/validations/client'

describe('champsReellementEnvoyes', () => {
  it('écarte les valeurs par défaut que la requête n’a pas envoyées', () => {
    const corps = { id: 7, notes: 'livrer le mardi' }
    const analyse = updateClientSchema.parse(corps)
    // Le piège : zod rend les défauts du schéma de création.
    expect(analyse).toMatchObject({ actif: true, pays: 'France' })
    expect(champsReellementEnvoyes(analyse, corps)).toEqual({ id: 7, notes: 'livrer le mardi' })
  })

  it('garde un champ envoyé, même égal à sa valeur par défaut', () => {
    const corps = { id: 7, actif: true, pays: 'Belgique' }
    expect(champsReellementEnvoyes(updateClientSchema.parse(corps), corps)).toEqual({ id: 7, actif: true, pays: 'Belgique' })
  })

  it('ne garde rien pour un corps qui n’est pas un objet', () => {
    expect(champsReellementEnvoyes({ actif: true }, null)).toEqual({})
    expect(champsReellementEnvoyes({ actif: true }, ['actif'])).toEqual({})
  })
})
