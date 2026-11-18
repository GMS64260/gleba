import { describe, expect, it } from 'vitest'
import { messageAvertissementDarPaiement } from './avertissement-dar'

describe('messageAvertissementDarPaiement (décision B13-1)', () => {
  it('annonce le paiement enregistré et la livraison impossible, blocages cités', () => {
    const texte = messageAvertissementDarPaiement({ blocages: ['Salade : DAR : récolte du 16/11 avant la fin du délai.'] })
    expect(texte).toBe('Paiement enregistré. Livraison impossible tant que le délai avant récolte n’est pas respecté : Salade : DAR : récolte du 16/11 avant la fin du délai.')
  })
  it('rien à afficher sans blocage', () => {
    expect(messageAvertissementDarPaiement(null)).toBeNull()
    expect(messageAvertissementDarPaiement(undefined)).toBeNull()
    expect(messageAvertissementDarPaiement({ blocages: [] })).toBeNull()
  })
})
