import { describe, expect, it } from 'vitest'
import { fetchMoonPhase, fuseauValide, getLunarCalendar, getMoonPhaseToday, instantPhaseVraie, jourDansFuseau, midiDansFuseau, phaseVraieDuJour } from './lunar'
import { estCroissante, libelleSensDuJour } from '@/components/lunaire/lecture'

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

// QA cmvno0s5d (2026-10-25) — la carte Météo du 25/10/2026 affichait
// « Gibbeuse croissante » puis « Lune décroissante, 100 % éclairée » : le sens
// venait de l'âge comparé à la demi-lunaison MOYENNE (14,77 j), alors que la
// pleine lune vraie tombe le 26/10 à 04:12 UTC, 15,5 j après la nouvelle lune.
// Les termes E·sin(M'±M) de Meeus avaient en outre leur signe inversé
// (syzygies décalées de 10 à 20 min).

const MINUTE_MS = 60000
const JOUR_MS = 24 * HEURE_MS

describe('syzygies vraies au plus près des éphémérides (cmvno0s5d)', () => {
  it("exemple 49.a de Meeus : nouvelle lune du 18/02/1977 à 3 h 37 min 42 s TD (JDE 2443192,65118)", () => {
    const attendu = Date.UTC(1977, 1, 18, 3, 37, 42)
    // Signes inversés : 03:31:47, six minutes trop tôt.
    expect(Math.abs(instantPhaseVraie(-283) - attendu)).toBeLessThan(3 * MINUTE_MS)
  })

  it.each([
    ['nouvelle lune du 12/08/2026', 329, Date.UTC(2026, 7, 12, 17, 37)],
    ['nouvelle lune du 10/10/2026', 331, Date.UTC(2026, 9, 10, 15, 50)],
    ['pleine lune du 26/10/2026', 331.5, Date.UTC(2026, 9, 26, 4, 12)],
    ['nouvelle lune du 09/11/2026', 332, Date.UTC(2026, 10, 9, 7, 2)],
    ['pleine lune du 24/11/2026', 332.5, Date.UTC(2026, 10, 24, 14, 53)],
  ])('%s à 5 min près', (_nom, k, attendu) => {
    expect(Math.abs(instantPhaseVraie(k) - attendu)).toBeLessThan(5 * MINUTE_MS)
  })
})

describe('sens et illumination tirés des instants vrais (cmvno0s5d)', () => {
  // Fin de l'heure d'été le 25/10/2026 à 01:00 UTC : midi Paris = 11:00 UTC.
  const midi25 = new Date(Date.UTC(2026, 9, 25, 11, 0))
  const midi27 = new Date(Date.UTC(2026, 9, 27, 11, 0))

  it('25/10/2026 : gibbeuse croissante, Lune croissante, au moins 95 % éclairée', async () => {
    const vrai = phaseVraieDuJour(midi25)
    expect(vrai.phaseIndex).toBe(3)
    expect(vrai.croissante).toBe(true)
    expect(vrai.illumination).toBeGreaterThanOrEqual(95)
    // Veille de la pleine lune : pas encore pleinement éclairée.
    expect(vrai.illumination).toBeLessThan(100)

    // Chaîne de la carte : jour servi par l'API, puis lecture du composant.
    const jour = await fetchMoonPhase(midi25)
    expect(jour.phase).toBe('Gibbeuse croissante')
    expect(jour.croissante).toBe(true)
    expect(estCroissante(jour)).toBe(true)
    expect(jour.conseilVerger.startsWith('Verger — lune décroissante')).toBe(false)
  })

  it("26/10/2026 : la carte donne l'heure de la pleine lune, pas un sens qui contredirait le nom", async () => {
    const jour = await fetchMoonPhase(new Date(Date.UTC(2026, 9, 26, 11, 0)))
    expect(jour.phaseIndex).toBe(4)
    // Pleine lune à 04:12 UTC, 05:12 à Paris (heure d'hiver).
    expect(libelleSensDuJour(jour, 'Europe/Paris')).toBe('Pleine Lune à 05:12')
    // Un jour sans événement garde le sens.
    expect(libelleSensDuJour(await fetchMoonPhase(midi25), 'Europe/Paris')).toBe('Lune croissante')
  })

  it('27/10/2026 : lendemain de la pleine lune, gibbeuse décroissante', async () => {
    const vrai = phaseVraieDuJour(midi27)
    expect(vrai.phaseIndex).toBe(5)
    expect(vrai.croissante).toBe(false)
    const jour = await fetchMoonPhase(midi27)
    expect(jour.phase).toBe('Gibbeuse décroissante')
    expect(estCroissante(jour)).toBe(false)
  })

  it('croissante tant que la pleine lune vraie n’est pas passée (pas de 3 h sur toute la lunaison)', () => {
    const nm = instantPhaseVraie(331)
    const pl = instantPhaseVraie(331.5)
    const nmSuivante = instantPhaseVraie(332)
    for (let t = nm + 60 * 1000; t < nmSuivante; t += 3 * HEURE_MS) {
      expect(phaseVraieDuJour(new Date(t)).croissante, new Date(t).toISOString()).toBe(t < pl)
    }
  })

  it("nom de phase, sens et illumination cohérents chaque jour d'une lunaison complète", async () => {
    let precedent: { croissante: boolean; illumination: number } | null = null
    let bascules = 0
    const syzygies: number[] = []
    // Du 10/10/2026 (nouvelle lune) au 10/11/2026 inclus, à midi Paris (heure d'hiver).
    for (let jour = 0; jour <= 31; jour++) {
      const midi = new Date(Date.UTC(2026, 9, 10, 11, 0) + jour * JOUR_MS)
      const j = await fetchMoonPhase(midi)
      const ctx = `${midi.toISOString().slice(0, 10)} ${j.phase} ${j.illumination} %`

      if (j.phaseIndex >= 1 && j.phaseIndex <= 3) expect(j.croissante, ctx).toBe(true)
      if (j.phaseIndex >= 5) expect(j.croissante, ctx).toBe(false)
      if (/décroissante|^Dernier/.test(j.phase)) expect(j.croissante, ctx).toBe(false)
      else if (/croissante|^Premier/.test(j.phase)) expect(j.croissante, ctx).toBe(true)
      expect(estCroissante(j), ctx).toBe(j.croissante)

      // Nouvelle et pleine lune (index 0 et 4) : la ligne de détail donne
      // l'heure de l'événement, qui tombe dans la journée civile, jamais un
      // sens. Les autres jours : le sens, accordé au nom.
      const libelle = libelleSensDuJour(j, 'Europe/Paris')
      if (j.phaseIndex === 0 || j.phaseIndex === 4) {
        expect(libelle, ctx).toMatch(new RegExp(`^${j.phase} à \\d{2}:\\d{2}$`))
        expect(libelle, ctx).not.toMatch(/croissante/)
        expect(j.instantEvenement, ctx).not.toBeNull()
        expect(Math.abs(Date.parse(j.instantEvenement!) - midi.getTime()), ctx).toBeLessThan(JOUR_MS / 2)
        syzygies.push(j.phaseIndex)
      } else {
        expect(libelle, ctx).toBe(j.croissante ? 'Lune croissante' : 'Lune décroissante')
      }
      expect(j.conseilVerger.startsWith('Verger — lune décroissante'), ctx).toBe(j.typeJour !== 'repos' && !j.croissante)

      if (precedent) {
        if (precedent.croissante !== j.croissante) bascules++
        // La Lune s'éclaire en croissant, s'assombrit en décroissant.
        if (precedent.croissante && j.croissante) expect(j.illumination, ctx).toBeGreaterThanOrEqual(precedent.illumination)
        if (!precedent.croissante && !j.croissante) expect(j.illumination, ctx).toBeLessThanOrEqual(precedent.illumination)
      }
      precedent = { croissante: j.croissante, illumination: j.illumination }
    }
    // Trois bascules, pas davantage : croissante dès le 11/10 (nouvelle lune
    // le 10/10 à 15:51 UTC, après midi), décroissante dès le 26/10 (pleine lune
    // à 04:12 UTC), de nouveau croissante le 09/11 (nouvelle lune à 07:03 UTC).
    expect(bascules).toBe(3)
    // Nouvelle lune du 10/10, pleine lune du 26/10, nouvelle lune du 09/11.
    expect(syzygies).toEqual([0, 4, 0])
  })
})

// Revue du 2026-10-28 (témoin lune-fuseau) : le jour civil est celui du
// LECTEUR. Les instants des phases sont communs ; seul le découpage en jours
// dépend du fuseau, qui entre donc dans la clé du cache.
describe('jour civil au fuseau du lecteur', () => {
  it('midi local et jour civil d’un fuseau, heure d’été comprise', () => {
    expect(midiDansFuseau('2026-07-01', 'Europe/Paris').toISOString()).toBe('2026-07-01T10:00:00.000Z')
    expect(midiDansFuseau('2026-10-25', 'Europe/Paris').toISOString()).toBe('2026-10-25T11:00:00.000Z')
    expect(midiDansFuseau('2026-08-12', 'America/Guadeloupe').toISOString()).toBe('2026-08-12T16:00:00.000Z')
    expect(midiDansFuseau('2026-11-25', 'Pacific/Noumea').toISOString()).toBe('2026-11-25T01:00:00.000Z')
    expect(jourDansFuseau(new Date('2026-08-13T02:00:00Z'), 'America/Guadeloupe')).toBe('2026-08-12')
    expect(jourDansFuseau(new Date('2026-08-12T22:30:00Z'), 'Europe/Paris')).toBe('2026-08-13')
    expect(fuseauValide('America/Guadeloupe')).toBe('America/Guadeloupe')
    expect(fuseauValide('Mars/Olympus')).toBeNull()
    expect(fuseauValide('')).toBeNull()
  })

  it('un même jour, deux fuseaux : deux réponses, pas celle du premier lecteur servie au second', async () => {
    const midi = midiDansFuseau('2026-11-25', 'Europe/Paris')
    const paris = await fetchMoonPhase(midi, 'Europe/Paris')
    const noumea = await fetchMoonPhase(midiDansFuseau('2026-11-25', 'Pacific/Noumea'), 'Pacific/Noumea')
    expect(paris.date).toBe('2026-11-25')
    expect(noumea.date).toBe('2026-11-25')
    // Pleine lune du 24/11 à 14:53 UTC : le 25 à Nouméa, la veille à Paris.
    expect(paris.phaseIndex).toBe(5)
    expect(noumea.phaseIndex).toBe(4)
    expect(noumea.instantEvenement).toBe(new Date(instantPhaseVraie(332.5)).toISOString())
  })

  it('le jour du lecteur fait foi pour « aujourd’hui »', async () => {
    const j = await getMoonPhaseToday({ jour: '2026-08-12', fuseau: 'America/Guadeloupe' })
    expect(j.date).toBe('2026-08-12')
    expect(j.phaseIndex).toBe(0)
    const cal = await getLunarCalendar(2026, 8, 'America/Guadeloupe')
    expect(cal.jours.find((d) => d.date === '2026-08-12')?.phaseIndex).toBe(0)
  })
})
