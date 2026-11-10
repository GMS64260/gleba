import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ default: {} }))

import { statutBioApresModification } from '../creation-recolte'

describe('statut bio d’une récolte de fruits modifiée', () => {
  const calculer = vi.fn(async () => 'conventionnel')

  it('recalcule depuis la nouvelle origine quand le statut renvoyé est celui déjà stocké', async () => {
    calculer.mockClear()
    expect(await statutBioApresModification({ saisi: 'bio', stocke: 'bio', origineChangee: true, calculer })).toBe('conventionnel')
    expect(await statutBioApresModification({ saisi: undefined, stocke: 'bio', origineChangee: true, calculer })).toBe('conventionnel')
    expect(calculer).toHaveBeenCalledTimes(2)
  })

  it('un statut ressaisi gagne, même si l’origine change', async () => {
    calculer.mockClear()
    expect(await statutBioApresModification({ saisi: 'conversion', stocke: 'bio', origineChangee: true, calculer })).toBe('conversion')
    expect(calculer).not.toHaveBeenCalled()
  })

  it('ne touche à rien quand ni l’origine ni le statut ne changent', async () => {
    calculer.mockClear()
    expect(await statutBioApresModification({ saisi: 'bio', stocke: 'bio', origineChangee: false, calculer })).toBeUndefined()
    expect(await statutBioApresModification({ saisi: undefined, stocke: 'bio', origineChangee: false, calculer })).toBeUndefined()
    expect(calculer).not.toHaveBeenCalled()
  })

  it('un statut vidé explicitement est retiré', async () => {
    expect(await statutBioApresModification({ saisi: '', stocke: 'bio', origineChangee: false, calculer })).toBeNull()
    expect(await statutBioApresModification({ saisi: null, stocke: null, origineChangee: false, calculer })).toBeUndefined()
  })
})
