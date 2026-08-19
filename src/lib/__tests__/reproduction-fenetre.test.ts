import { describe, expect, it } from 'vitest'

import {
  dureeGestationEspece,
  fenetreMiseBasCampagne,
} from '@/lib/reproduction'

const iso = (d: Date) => d.toISOString().slice(0, 10)

describe('dureeGestationEspece', () => {
  it('préfère la durée renseignée sur l’espèce', () => {
    expect(
      dureeGestationEspece({ id: 'brebis_merinos_arles', type: 'mammifere_grand', dureeGestation: 147 })
    ).toBe(147)
  })

  it('retombe sur les défauts FR par identifiant', () => {
    expect(dureeGestationEspece({ id: 'brebis', type: 'mammifere_grand' })).toBe(150)
    expect(dureeGestationEspece({ id: 'Lapin', type: null })).toBe(31)
  })

  it('reste nulle pour une espèce sans référence', () => {
    expect(dureeGestationEspece({ id: 'autruche_perso', type: 'inconnu' })).toBeNull()
  })
})

describe('fenetreMiseBasCampagne', () => {
  // Cas réel (friction 2026-08-14) : « Lutte printemps 2026 » du 15/04 au
  // 16/05, brebis Mérinos d'Arles (147 j) → mises bas du 09/09 au 10/10.
  it('projette la fenêtre de lutte décalée de la gestation', () => {
    const fenetre = fenetreMiseBasCampagne(
      {
        dateDebut: new Date('2026-04-15T00:00:00.000Z'),
        dateFin: new Date('2026-05-16T00:00:00.000Z'),
      },
      147
    )
    expect(iso(fenetre.debut)).toBe('2026-09-09')
    expect(iso(fenetre.fin)).toBe('2026-10-10')
  })

  it('réduit la fenêtre à un jour quand la lutte n’a pas de date de fin', () => {
    const fenetre = fenetreMiseBasCampagne(
      { dateDebut: new Date('2026-04-15T00:00:00.000Z'), dateFin: null },
      150
    )
    expect(iso(fenetre.debut)).toBe('2026-09-12')
    expect(iso(fenetre.fin)).toBe('2026-09-12')
  })
})
