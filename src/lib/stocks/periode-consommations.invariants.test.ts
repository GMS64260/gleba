import { describe, expect, it } from 'vitest'
import { periodeConsommations } from './periode-consommations'

const GRAINE = 20261119
const formatParis = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
})
function jourParis(instant: number): string {
  const parties = Object.fromEntries(formatParis.formatToParts(new Date(instant)).map(p => [p.type, p.value]))
  return `${parties.year}-${parties.month}-${parties.day}`
}

describe(`période des consommations — graine ${GRAINE}`, () => {
  it('sur 500 périodes, chaque borne correspond exactement aux jours civils sélectionnés', () => {
    let etat = GRAINE
    const entier = (max: number) => {
      etat = (Math.imul(etat, 1664525) + 1013904223) >>> 0
      return etat % max
    }
    for (let i = 0; i < 500; i++) {
      const centre = Date.UTC(2000, 0, 1) + entier(365 * 100) * 86_400_000
      const start = new Date(centre).toISOString().slice(0, 10)
      const end = new Date(centre + entier(90) * 86_400_000).toISOString().slice(0, 10)
      const periode = periodeConsommations(start, end)
      const debutSeul = periodeConsommations(start, null)
      const finSeule = periodeConsommations(null, end)
      expect(periode.ok && debutSeul.ok && finSeule.ok).toBe(true)
      if (!periode.ok || !debutSeul.ok || !finSeule.ok) throw new Error(`Graine ${GRAINE}, cas ${i}`)
      const debut = periode.date!.gte!.getTime()
      const fin = periode.date!.lt!.getTime()
      expect(jourParis(debut - 1) < start).toBe(true)
      expect(jourParis(debut)).toBe(start)
      expect(jourParis(fin - 1)).toBe(end)
      expect(jourParis(fin) > end).toBe(true)
      expect(debutSeul.date).toEqual({ gte: new Date(debut) })
      expect(finSeule.date).toEqual({ lt: new Date(fin) })
      for (const instant of [debut - 1, debut, debut + entier(fin - debut), fin - 1, fin]) {
        const jour = jourParis(instant)
        expect(instant >= debut && instant < fin).toBe(jour >= start && jour <= end)
      }
      expect(periodeConsommations(null, null)).toEqual({ ok: true })
      if (start < end) expect(periodeConsommations(end, start)).toMatchObject({ ok: false, champ: 'end' })
    }
  })
})
