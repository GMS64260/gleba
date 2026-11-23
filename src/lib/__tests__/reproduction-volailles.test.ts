import { describe, expect, it } from 'vitest'
import { dureeGestationEspece, estVolaille } from '@/lib/reproduction'

// FB-Q7PXKT — « Impossible d'enregistrer une saillie pour une poule pondeuse ».
describe('durée de gestation ou de couvaison d’une espèce', () => {
  it('prend la couvaison d’une volaille, dont la gestation est vide', () => {
    expect(dureeGestationEspece({ id: 'poule_pondeuse', type: 'volaille', dureeGestation: null, dureeCouvaison: 21 })).toBe(21)
  })
  it('retrouve le défaut d’une déclinaison d’espèce par sa base', () => {
    expect(dureeGestationEspece({ id: 'poule_marans', type: 'volaille' })).toBe(21)
    expect(dureeGestationEspece({ id: 'canard_barbarie', type: 'volaille' })).toBe(28)
  })
  it('ne prend pas la couvaison pour un mammifère et garde le champ renseigné', () => {
    expect(dureeGestationEspece({ id: 'espece_perso', type: 'autre', dureeGestation: null, dureeCouvaison: 21 })).toBeNull()
    expect(dureeGestationEspece({ id: 'chevre', type: 'caprin', dureeGestation: 152 })).toBe(152)
  })
  it('reconnaît une volaille par son type', () => {
    expect(estVolaille({ type: 'Volaille' })).toBe(true)
    expect(estVolaille({ type: 'caprin' })).toBe(false)
  })
})
