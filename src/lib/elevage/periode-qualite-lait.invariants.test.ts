import { describe, expect, it } from 'vitest'
import { periodeQualiteLait } from './periode-qualite-lait'

const GRAINE = 20261119
const format = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
})
function jourParis(instant: number) {
  const p = Object.fromEntries(format.formatToParts(new Date(instant)).map(p => [p.type, p.value]))
  return `${p.year}-${p.month}-${p.day}`
}

describe(`qualité du lait — périodes civiles, graine ${GRAINE}`, () => {
  it('détermine aujourd’hui à Paris même quand UTC est encore la veille', () => {
    const periode = periodeQualiteLait(new URLSearchParams({ start: '2026-03-30' }), new Date('2026-03-29T22:30:00Z'))
    expect(periode).toMatchObject({ ok: true, fenetreJours: 1,
      periode: { start: '2026-03-30', end: '2026-03-30' },
      date: { gte: new Date('2026-03-29T22:00:00Z'), lt: new Date('2026-03-30T22:00:00Z') } })
  })

  it('500 périodes : bornes inclusives, durée civile et priorité sur fenetre', () => {
    let graine = GRAINE
    const entier = (max: number) => {
      graine = (Math.imul(graine, 1664525) + 1013904223) >>> 0
      return graine % max
    }
    for (let i = 0; i < 500; i++) {
      const debut = Date.UTC(1990, 0, 1) + entier(365 * 60) * 86_400_000
      const duree = entier(1500) + 1
      const start = new Date(debut).toISOString().slice(0, 10)
      const end = new Date(debut + (duree - 1) * 86_400_000).toISOString().slice(0, 10)
      const periode = periodeQualiteLait(new URLSearchParams({ start, end, fenetre: '30' }))
      expect(periode.ok, `Graine ${GRAINE}, cas ${i}`).toBe(true)
      if (!periode.ok) throw new Error(periode.error)
      expect(periode.fenetreJours).toBe(duree)
      expect(periode.periode).toEqual({ mode: 'periode', start, end })
      const min = periode.date.gte!.getTime()
      const max = periode.date.lt!.getTime()
      for (const instant of [min - 1, min, min + entier(max - min), max - 1, max]) {
        expect(instant >= min && instant < max).toBe(jourParis(instant) >= start && jourParis(instant) <= end)
      }
      const finSeule = periodeQualiteLait(new URLSearchParams({ end }))
      expect(finSeule.ok && finSeule.fenetreJours).toBeNull()
      expect(finSeule.ok && finSeule.date).toEqual({ lt: new Date(max) })
      const fenetre = entier(701) + 30
      const glissante = periodeQualiteLait(new URLSearchParams({ fenetre: String(fenetre) }), new Date(`${end}T12:00:00Z`))
      expect(glissante.ok).toBe(true)
      if (!glissante.ok) throw new Error(glissante.error)
      expect(glissante.periode.end).toBe(end)
      expect((Date.parse(glissante.periode.end) - Date.parse(glissante.periode.start!)) / 86_400_000 + 1).toBe(fenetre)
      expect(jourParis(glissante.date.lt!.getTime() - 1)).toBe(end)
    }
  })
})
