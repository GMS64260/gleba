import { describe, expect, it, vi } from 'vitest'
import { signalerAvertissementsRecolte } from '@/lib/recolte/dar-ecran'

// Un seul toast est visible à la fois (TOAST_LIMIT) : le comptage récent
// (décision B du 2026-11-25) ne remplace jamais un délai avant récolte.
describe('avertissements d’une récolte créée', () => {
  const comptage = 'Le stock de Carotte a été compté le 18/11/2026 : …'

  it('comptage seul : un toast « Stock déjà compté »', () => {
    const toast = vi.fn()
    signalerAvertissementsRecolte({ avertissementComptage: comptage }, toast)
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith({ title: 'Stock déjà compté', description: comptage, duration: 30_000 })
  })

  it('délai avant récolte et comptage : le comptage rejoint le dernier délai', () => {
    const toast = vi.fn()
    signalerAvertissementsRecolte({ warnings: ['Délai A', 'Délai B'], avertissementComptage: comptage }, toast)
    expect(toast).toHaveBeenCalledTimes(2)
    expect(toast).toHaveBeenNthCalledWith(1, expect.objectContaining({ title: 'Délai avant récolte', description: 'Délai A' }))
    expect(toast).toHaveBeenLastCalledWith(expect.objectContaining({ variant: 'destructive', title: 'Délai avant récolte', description: `Délai B ${comptage}` }))
  })

  it('rien à signaler : aucun toast', () => {
    const toast = vi.fn()
    signalerAvertissementsRecolte({ id: 1 }, toast)
    expect(toast).not.toHaveBeenCalled()
  })
})
