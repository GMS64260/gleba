/**
 * Rendement effectif : celui de la ferme, sinon celui du catalogue.
 *
 * Contexte (2026-08-20) : une espèce du catalogue officiel n'est pas modifiable
 * par un membre (403). Sans surcharge par ferme, le choix d'unité de rendement
 * — tiges, pièces, bottes — restait inatteignable pour qui cultive du catalogue,
 * c'est-à-dire pour le compte même qui l'avait demandé.
 */

import { describe, expect, it } from 'vitest'
import { rendementEffectif, surchargeActive, appliquerSurcharges } from '../rendement-effectif'

const catalogue = { rendement: 4, uniteRendement: 'kg_m2' }

describe('rendementEffectif', () => {
  it('sans surcharge, le catalogue fait foi', () => {
    expect(rendementEffectif(catalogue, null)).toEqual({
      rendement: 4,
      uniteRendement: 'kg_m2',
      origine: 'catalogue',
    })
    expect(rendementEffectif(catalogue, { rendement: null, uniteRendement: null })).toEqual({
      rendement: 4,
      uniteRendement: 'kg_m2',
      origine: 'catalogue',
    })
  })

  it('la surcharge complète remplace valeur ET unité (cas vécu du dahlia)', () => {
    expect(
      rendementEffectif(catalogue, { rendement: 40, uniteRendement: 'tiges_m2' }),
    ).toEqual({ rendement: 40, uniteRendement: 'tiges_m2', origine: 'ferme' })
  })

  it('surcharger la seule VALEUR ne change pas ce qu’elle mesure', () => {
    // L'unité retombe sur celle du catalogue : un rendement corrigé reste des kg.
    expect(rendementEffectif(catalogue, { rendement: 6, uniteRendement: null })).toEqual({
      rendement: 6,
      uniteRendement: 'kg_m2',
      origine: 'ferme',
    })
  })

  it('déclarer l’unité sans la valeur est une information, pas une erreur', () => {
    // « Mes dahlias se comptent en tiges, je ne connais pas encore ma densité » :
    // la projection rendra 0 dans la bonne unité plutôt qu'un chiffre en kilos
    // qu'on sait faux.
    expect(rendementEffectif(catalogue, { rendement: null, uniteRendement: 'tiges_m2' })).toEqual({
      rendement: null,
      uniteRendement: 'tiges_m2',
      origine: 'ferme',
    })
  })

  it('un catalogue muet reste lisible : kg/m² est le défaut du schéma', () => {
    expect(rendementEffectif(null, null)).toEqual({
      rendement: null,
      uniteRendement: 'kg_m2',
      origine: 'catalogue',
    })
    expect(rendementEffectif({ rendement: 3, uniteRendement: null }, null).uniteRendement).toBe(
      'kg_m2',
    )
  })
})

describe('surchargeActive', () => {
  it('un seul des deux champs suffit', () => {
    expect(surchargeActive(null)).toBe(false)
    expect(surchargeActive({ rendement: null, uniteRendement: null })).toBe(false)
    expect(surchargeActive({ rendement: 40, uniteRendement: null })).toBe(true)
    expect(surchargeActive({ rendement: null, uniteRendement: 'tiges_m2' })).toBe(true)
  })
})

describe('appliquerSurcharges', () => {
  it('remplace le rendement exposé et conserve la référence à côté', () => {
    const [dahlia, carotte] = appliquerSurcharges(
      [
        { id: 'Dahlia', rendement: 4, uniteRendement: 'kg_m2' },
        { id: 'Carotte', rendement: 5, uniteRendement: 'kg_m2' },
      ],
      new Map([['Dahlia', { rendement: 40, uniteRendement: 'tiges_m2' }]]),
    )

    // Tout écran qui lit `espece.rendement` obtient la vérité de la ferme…
    expect(dahlia.rendement).toBe(40)
    expect(dahlia.uniteRendement).toBe('tiges_m2')
    expect(dahlia.origineRendement).toBe('ferme')
    // …sans perdre la valeur de référence, que la fiche affiche à côté.
    expect(dahlia.rendementCatalogue).toBe(4)
    expect(dahlia.uniteRendementCatalogue).toBe('kg_m2')

    // Une espèce sans surcharge n'est pas touchée.
    expect(carotte.rendement).toBe(5)
    expect(carotte.origineRendement).toBe('catalogue')
  })
})
