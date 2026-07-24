import { describe, it, expect } from 'vitest'
import { consoliderAttentes, remiseVente, type SoinAttenteRow } from '../attentes'

const D = (s: string) => new Date(`${s}T00:00:00.000Z`)

function row(partial: Partial<SoinAttenteRow> & Pick<SoinAttenteRow, 'id'>): SoinAttenteRow {
  return {
    animalId: 253,
    lotId: null,
    type: 'Traitement vétérinaire',
    produit: 'Engemycin 10%',
    produitId: null,
    date: D('2026-07-24'),
    datePrevue: null,
    fait: true,
    tempsAttenteLaitJ: 7,
    tempsAttenteViandeJ: 28,
    nbInjections: 1,
    intervalleInjectionsHeures: null,
    cibleLabel: 'FR41-QA0001',
    cibleNom: 'QA Caprin Chevrette1',
    traitementLabel: 'Engemycin 10%',
    ...partial,
  }
}

describe('consoliderAttentes — cas QA animal 253 (Engemycin sur 3 jours)', () => {
  const today = D('2026-07-24')

  it('ancre la fenêtre sur la DERNIÈRE injection (planifiée) et déduplique', () => {
    // 3 lignes : 2 doublons faits le 24/07 + 1 planifiée le 26/07 (non faite).
    const soins: SoinAttenteRow[] = [
      row({ id: 69, date: D('2026-07-24'), fait: true }),
      row({ id: 70, date: D('2026-07-24'), fait: true }),
      row({ id: 71, date: D('2026-07-26'), fait: false }),
    ]
    const res = consoliderAttentes(soins, today)

    // Une SEULE échéance consolidée (QA #9 : plus de doublons).
    expect(res).toHaveLength(1)
    const a = res[0]
    // Ancrée sur le 26/07 (QA #2 : depuis la dernière injection, pas la 1re).
    expect(a.derniereInjection.toISOString()).toBe(D('2026-07-26').toISOString())
    // Lait : 26/07 + 7 = 02/08 ; viande : 26/07 + 28 = 23/08.
    expect(a.finAttenteLait?.toISOString()).toBe(D('2026-08-02').toISOString())
    expect(a.finAttenteViande?.toISOString()).toBe(D('2026-08-23').toISOString())
    // Remise en vente = lendemain de la fin d'attente.
    expect(remiseVente(a.finAttenteLait)?.toISOString()).toBe(D('2026-08-03').toISOString())
    expect(remiseVente(a.finAttenteViande)?.toISOString()).toBe(D('2026-08-24').toISOString())
    // Les 3 lignes sont bien rattachées au même traitement.
    expect(a.soinIds.sort()).toEqual([69, 70, 71])
  })

  it('ignore un traitement non commencé (aucune injection faite)', () => {
    const soins: SoinAttenteRow[] = [
      row({ id: 80, date: D('2026-07-26'), fait: false }),
      row({ id: 81, date: D('2026-07-27'), fait: false }),
    ]
    expect(consoliderAttentes(soins, today)).toHaveLength(0)
  })

  it('protocole multi-injections sur une seule ligne (PROMPT 30)', () => {
    // 1 ligne, 3 injections /24h à partir du 11/03 → dernière le 13/03.
    const soins: SoinAttenteRow[] = [
      row({
        id: 90,
        produit: 'Pénijectyl',
        traitementLabel: 'Pénijectyl',
        date: D('2026-03-11'),
        fait: true,
        nbInjections: 3,
        intervalleInjectionsHeures: 24,
        tempsAttenteLaitJ: 5,
        tempsAttenteViandeJ: 31,
      }),
    ]
    const res = consoliderAttentes(soins, D('2026-03-12'))
    expect(res).toHaveLength(1)
    expect(res[0].derniereInjection.toISOString()).toBe(D('2026-03-13').toISOString())
    expect(res[0].finAttenteLait?.toISOString()).toBe(D('2026-03-18').toISOString())
    expect(res[0].finAttenteViande?.toISOString()).toBe(D('2026-04-13').toISOString())
  })

  it('deux animaux différents → deux échéances distinctes', () => {
    const soins: SoinAttenteRow[] = [
      row({ id: 100, animalId: 1, cibleLabel: 'A1' }),
      row({ id: 101, animalId: 2, cibleLabel: 'A2' }),
    ]
    expect(consoliderAttentes(soins, today)).toHaveLength(2)
  })

  it('exclut une fenêtre déjà expirée', () => {
    const soins: SoinAttenteRow[] = [
      row({ id: 110, date: D('2026-07-01'), fait: true, tempsAttenteLaitJ: 3, tempsAttenteViandeJ: 5 }),
    ]
    // 01/07 + 5 = 06/07 < 24/07 → plus rien d'actif.
    expect(consoliderAttentes(soins, today)).toHaveLength(0)
  })

  it('ne fusionne pas deux cures distinctes du même produit', () => {
    const soins = [
      row({ id: 120, date: D('2026-07-24'), fait: true }),
      row({ id: 121, date: D('2026-08-10'), datePrevue: D('2026-08-10'), fait: false }),
    ]
    const res = consoliderAttentes(soins, today)
    expect(res).toHaveLength(1)
    expect(res[0].soinIds).toEqual([120])
    expect(res[0].derniereInjection.toISOString()).toBe(D('2026-07-24').toISOString())
  })
})
