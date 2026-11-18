import { describe, expect, it } from 'vitest'
import { etapePourAnnee, type CultureHistorique } from '@/lib/rotation-check'

// Rotation-3ans-Courges du compte de démonstration : étape 1 Cucurbitaceae,
// étape 2 Fabaceae, étape 3 Hydrophyllaceae.
const COURGES = new Map<number, string>([
  [1, 'Cucurbitaceae'],
  [2, 'Fabaceae'],
  [3, 'Hydrophyllaceae'],
])

const h = (annee: number, familleId: string | null): CultureHistorique => ({ annee, familleId })

describe('etapePourAnnee', () => {
  it("déduit l'étape depuis la culture repère de la même année", () => {
    // QA cmsg52uzr : C4 portait un Concombre (Cucurbitaceae) en 2026.
    expect(etapePourAnnee(2026, 3, COURGES, [h(2026, 'Cucurbitaceae')])).toEqual({
      etape: 1,
      familleAttendue: 'Cucurbitaceae',
    })
  })

  it('déroule le cycle à partir du repère pour les années suivantes', () => {
    const histo = [h(2025, 'Cucurbitaceae')]
    expect(etapePourAnnee(2026, 3, COURGES, histo)?.familleAttendue).toBe('Fabaceae')
    expect(etapePourAnnee(2027, 3, COURGES, histo)?.familleAttendue).toBe('Hydrophyllaceae')
    expect(etapePourAnnee(2028, 3, COURGES, histo)?.familleAttendue).toBe('Cucurbitaceae')
  })

  it('retient le repère le plus récent', () => {
    const histo = [h(2020, 'Cucurbitaceae'), h(2025, 'Fabaceae')]
    // 2025 = étape 2 → 2026 = étape 3.
    expect(etapePourAnnee(2026, 3, COURGES, histo)?.etape).toBe(3)
  })

  it('ignore les cultures postérieures à l’année visée', () => {
    // Un repère futur ne dit rien de la position présente.
    expect(etapePourAnnee(2026, 3, COURGES, [h(2030, 'Fabaceae')])).toBeNull()
  })

  it('ne prétend rien sans repère exploitable', () => {
    // Aucune histoire, ou une famille absente du cycle : position inconnue.
    expect(etapePourAnnee(2026, 3, COURGES, [])).toBeNull()
    expect(etapePourAnnee(2026, 3, COURGES, [h(2025, 'Solanaceae')])).toBeNull()
    expect(etapePourAnnee(2026, 3, COURGES, [h(2025, null)])).toBeNull()
  })

  it('écarte une famille ambiguë présente à deux étapes', () => {
    // Cucurbitaceae à l'étape 1 ET 3 : l'ancrage serait arbitraire.
    const ambigu = new Map<number, string>([
      [1, 'Cucurbitaceae'],
      [2, 'Fabaceae'],
      [3, 'Cucurbitaceae'],
    ])
    expect(etapePourAnnee(2026, 3, ambigu, [h(2025, 'Cucurbitaceae')])).toBeNull()
    // La famille non ambiguë reste exploitable comme repère.
    expect(etapePourAnnee(2026, 3, ambigu, [h(2025, 'Fabaceae')])?.etape).toBe(3)
  })

  // Revue du 2026-11-11 : deux cultures de la même année peuvent désigner deux
  // étapes différentes (une culture dérobée de l'étape suivante derrière la
  // culture principale). Le repère dépendait alors de l'ordre des lignes lues,
  // que la requête ne fixe pas : l'avertissement de rotation changeait d'un
  // appel à l'autre pour le même historique.
  describe('année portant deux étapes', () => {
    const fabacee = h(2026, 'Fabaceae')
    const cucurbitacee = h(2026, 'Cucurbitaceae')

    it("rend le même résultat quel que soit l'ordre des cultures", () => {
      const a = etapePourAnnee(2027, 3, COURGES, [cucurbitacee, fabacee])
      const b = etapePourAnnee(2027, 3, COURGES, [fabacee, cucurbitacee])
      expect(a).toEqual(b)
    })

    it("n'affirme rien quand aucun repère antérieur ne départage", () => {
      expect(etapePourAnnee(2027, 3, COURGES, [cucurbitacee, fabacee])).toBeNull()
      expect(etapePourAnnee(2026, 3, COURGES, [fabacee, cucurbitacee])).toBeNull()
    })

    it('départage par le repère antérieur déroulé', () => {
      // 2025 = étape 1 → 2026 = étape 2 (Fabaceae), présente en 2026.
      for (const ordre of [
        [h(2025, 'Cucurbitaceae'), cucurbitacee, fabacee],
        [fabacee, cucurbitacee, h(2025, 'Cucurbitaceae')],
      ]) {
        expect(etapePourAnnee(2026, 3, COURGES, ordre)?.etape).toBe(2)
        expect(etapePourAnnee(2027, 3, COURGES, ordre)?.etape).toBe(3)
      }
    })

    it("n'affirme rien quand le repère antérieur contredit l'année ambiguë", () => {
      // 2025 = étape 2 → 2026 attendue à l'étape 3, que ni l'une ni l'autre
      // culture de 2026 ne confirme.
      const histo = [h(2025, 'Fabaceae'), cucurbitacee, fabacee]
      expect(etapePourAnnee(2027, 3, COURGES, histo)).toBeNull()
    })

    it("deux cultures de la même étape dans l'année restent un repère", () => {
      expect(etapePourAnnee(2027, 3, COURGES, [fabacee, h(2026, 'Fabaceae')])?.etape).toBe(3)
    })
  })

  it('reste dans les bornes du cycle sur un grand écart', () => {
    const histo = [h(2000, 'Cucurbitaceae')]
    for (const annee of [2026, 2027, 2028, 2029]) {
      const r = etapePourAnnee(annee, 3, COURGES, histo)
      expect(r).not.toBeNull()
      expect(r!.etape).toBeGreaterThanOrEqual(1)
      expect(r!.etape).toBeLessThanOrEqual(3)
    }
  })

  it('refuse un cycle vide ou incohérent', () => {
    expect(etapePourAnnee(2026, 0, COURGES, [h(2026, 'Cucurbitaceae')])).toBeNull()
    expect(etapePourAnnee(2026, 3, new Map(), [h(2026, 'Cucurbitaceae')])).toBeNull()
  })

  it("ne déduit rien d'un cycle dont l'étape calculée n'est pas renseignée", () => {
    // Cycle de 3 ans dont seule l'étape 1 est décrite : 2027 tomberait sur
    // l'étape 2, inconnue — on ne fabrique pas d'attente.
    const partiel = new Map<number, string>([[1, 'Cucurbitaceae']])
    expect(etapePourAnnee(2027, 3, partiel, [h(2026, 'Cucurbitaceae')])).toBeNull()
  })
})
