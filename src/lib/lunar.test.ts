import { describe, expect, it } from 'vitest'
import { instantPhaseVraie, phaseVraieDuJour } from './lunar'

// TICKET cmsoglmwb — le modèle d'âge moyen plaçait la nouvelle lune d'août
// 2026 au 13/08 (instant vrai : 12/08 17:37 UTC, écart +14 h). Ces tests
// ancrent le calcul des syzygies VRAIES sur des éphémérides connues.
// Les « midis locaux » Europe/Paris sont exprimés en UTC explicite
// (12:00 Paris été = 10:00 UTC) pour rester indépendants du fuseau du runner.

const HEURE_MS = 3600000

describe('instants vrais des phases (Meeus)', () => {
  it('k=0 : nouvelle lune de référence du 6 janvier 2000 à ~18:14 UTC', () => {
    const attendu = Date.UTC(2000, 0, 6, 18, 14)
    expect(Math.abs(instantPhaseVraie(0) - attendu)).toBeLessThan(1 * HEURE_MS)
  })

  it('k=329 : nouvelle lune du 12 août 2026 à ~17:37 UTC (USNO)', () => {
    const attendu = Date.UTC(2026, 7, 12, 17, 37)
    expect(Math.abs(instantPhaseVraie(329) - attendu)).toBeLessThan(1 * HEURE_MS)
  })
})

describe('icône du jour civil (Europe/Paris)', () => {
  it('le 12/08/2026 porte la nouvelle lune (événement à 19:37 Paris)', () => {
    const midiParis = new Date(Date.UTC(2026, 7, 12, 10, 0))
    expect(phaseVraieDuJour(midiParis).phaseIndex).toBe(0)
  })

  it('le 13/08/2026 est un premier croissant, pas la nouvelle lune', () => {
    const midiParis = new Date(Date.UTC(2026, 7, 13, 10, 0))
    expect(phaseVraieDuJour(midiParis).phaseIndex).toBe(1)
  })

  it('le 11/08/2026 est un dernier croissant (phase décroissante)', () => {
    const midiParis = new Date(Date.UTC(2026, 7, 11, 10, 0))
    const { phaseIndex, age } = phaseVraieDuJour(midiParis)
    expect(phaseIndex).toBe(7)
    expect(age).toBeGreaterThan(22.1) // après le dernier quartier
  })

  it("l'âge est recalé sur la dernière nouvelle lune vraie", () => {
    // Midi Paris le 13/08/2026 : ~16,4 h après la nouvelle lune du 12/08 19:37 Paris.
    const midiParis = new Date(Date.UTC(2026, 7, 13, 10, 0))
    const { age } = phaseVraieDuJour(midiParis)
    expect(age).toBeGreaterThan(0.5)
    expect(age).toBeLessThan(0.9)
  })
})
