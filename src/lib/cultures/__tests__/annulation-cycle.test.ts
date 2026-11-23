import { describe, expect, it } from 'vitest'
import { refusCycleIncoherent } from '@/lib/cultures/annulation-etape'
import type { ChampEtape } from '@/lib/cultures/execution'

// FB-EYRRO5 — la fiche laissait annuler le semis d'une culture plantée et récoltée.
describe('cohérence du cycle à l’annulation d’une étape', () => {
  const etat = (e: Partial<Record<ChampEtape, boolean>>) => (etape: ChampEtape) => Boolean(e[etape])

  it('refuse d’annuler le semis quand la plantation et la récolte restent faites', () => {
    const refus = refusCycleIncoherent(['semisFait'], etat({ plantationFaite: true, recolteFaite: true }))
    expect(refus?.error).toContain("Annulez d'abord la plantation et la récolte")
    expect(refus?.error).toContain('avant le semis')
  })
  it('accepte une annulation en cascade dans le même envoi', () => {
    expect(refusCycleIncoherent(['semisFait', 'plantationFaite', 'recolteFaite'], etat({}))).toBeNull()
  })
  it('accepte d’annuler la dernière étape faite, et ne juge rien sans annulation', () => {
    expect(refusCycleIncoherent(['recolteFaite'], etat({ semisFait: true, plantationFaite: true }))).toBeNull()
    expect(refusCycleIncoherent([], etat({ semisFait: false, plantationFaite: true }))).toBeNull()
  })
})
