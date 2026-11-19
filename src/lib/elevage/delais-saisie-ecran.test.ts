import { describe, expect, it } from 'vitest'
import { corpsDelaisSaisis, delaisManquantsDuRefus } from './delais-saisie-ecran'

describe('saisie sur place des délais d’attente manquants', () => {
  it('reconnaît le refus du serveur et lui seul', () => {
    const refus = { error: '…', code: 'DELAIS_ATTENTE_REQUIS', delaisManquants: ['lait', 'viande'] }
    expect(delaisManquantsDuRefus(422, refus)).toEqual(['viande', 'lait'])
    expect(delaisManquantsDuRefus(400, refus)).toBeNull()
    expect(delaisManquantsDuRefus(422, { error: 'Autre refus' })).toBeNull()
    expect(delaisManquantsDuRefus(422, { code: 'DELAIS_ATTENTE_REQUIS', delaisManquants: [] })).toBeNull()
    expect(delaisManquantsDuRefus(422, null)).toBeNull()
  })

  it('zéro est une réponse, un champ vide ou hors bornes n’en est pas une', () => {
    expect(corpsDelaisSaisis(['viande', 'lait'], { viande: '0', lait: '7' }))
      .toEqual({ tempsAttenteViandeJ: 0, tempsAttenteLaitJ: 7 })
    expect(corpsDelaisSaisis(['viande'], { viande: '' })).toBeNull()
    expect(corpsDelaisSaisis(['oeufs'], { oeufs: '400' })).toBeNull()
    expect(corpsDelaisSaisis(['viande'], { viande: '2,5' })).toBeNull()
  })
})
