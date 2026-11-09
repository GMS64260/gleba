/**
 * Bilan matière du lait (décision du 2026-11-03) : fenêtre de 7 jours,
 * alerte confirmable. Témoin de la revue du 2026-11-01 : une collecte vendue
 * entière en lait cru puis transformée en fromage passait sans signal.
 */
import { describe, expect, it } from 'vitest'
import {
  alerteDisponibilite,
  bilanDepuisMouvements,
  chargerBilanLait,
  chargerBilansLait,
  corpsLaitIndisponible,
  debutJourParis,
  finJourParis,
  jourParis,
  messageLaitIndisponible,
  verifierDisponibiliteLait,
  type DbLait,
  type MouvementLait,
} from './bilan-lait'
import { CODE_LAIT_INDISPONIBLE } from './lait-indisponible'

type Plage = { gte: Date; lte: Date }
const dans = (d: Date, p: Plage) => d >= p.gte && d <= p.lte

/** Base factice : filtre réellement par plage, comme PostgreSQL. */
function base(donnees: {
  collectes?: { date: string; quantiteLitres: number | string; ecarteAttente?: boolean; lotFromageId?: string | null }[]
  fabrications?: { dateFabrication: string; volumeLaitUtiliseL: number | string }[]
  livraisons?: { date: string; litres: number | string }[]
  ventes?: { id: number; date: string; quantite: number; unite: string }[]
}): DbLait {
  const c = (donnees.collectes ?? []).map((x) => ({ ecarteAttente: false, lotFromageId: null, ...x, date: new Date(x.date) }))
  const f = (donnees.fabrications ?? []).map((x) => ({ ...x, dateFabrication: new Date(x.dateFabrication) }))
  const l = (donnees.livraisons ?? []).map((x) => ({ ...x, date: new Date(x.date) }))
  const v = (donnees.ventes ?? []).map((x) => ({ ...x, date: new Date(x.date) }))
  return {
    collecteLait: { findMany: async ({ where }: { where: { date: Plage } }) => c.filter((x) => dans(x.date, where.date)) },
    lotFromage: { findMany: async ({ where }: { where: { dateFabrication: Plage } }) => f.filter((x) => dans(x.dateFabrication, where.dateFabrication)) },
    livraisonLait: { findMany: async ({ where }: { where: { date: Plage } }) => l.filter((x) => dans(x.date, where.date)) },
    venteProduit: { findMany: async ({ where }: { where: { date: Plage } }) => v.filter((x) => dans(x.date, where.date)) },
  } as unknown as DbLait
}

const vente = (jour: string, litres: number, source?: string): MouvementLait => ({ jour, poste: 'venduCru', litres, source })

describe('jours civils de Paris', () => {
  it('range une saisie de 23:30 UTC au lendemain à Paris', () => {
    expect(jourParis(new Date('2026-11-02T23:30:00Z'))).toBe('2026-11-03')
  })

  it('borne un jour de changement d’heure (25 heures le 2026-10-25)', () => {
    expect(debutJourParis('2026-10-25').toISOString()).toBe('2026-10-24T22:00:00.000Z')
    expect(finJourParis('2026-10-25').toISOString()).toBe('2026-10-25T22:59:59.999Z')
  })
})

describe('bilan d’une période', () => {
  it('écarte le lait en délai d’attente du disponible et compte ce qui reste non affecté', () => {
    const b = bilanDepuisMouvements([
      { jour: '2026-11-01', poste: 'collecte', litres: 30 },
      { jour: '2026-11-01', poste: 'ecarte', litres: 4 },
      { jour: '2026-11-02', poste: 'livre', litres: 10 },
      vente('2026-11-02', 5),
      { jour: '2026-11-03', poste: 'transforme', litres: 8 },
      { jour: '2026-10-20', poste: 'collecte', litres: 99 },
    ], '2026-10-28', '2026-11-03', 2)

    expect(b).toMatchObject({ collecte: 30, ecarte: 4, disponible: 26, livre: 10, venduCru: 5, transforme: 8, sorties: 23, nonAffecte: 3, nbCollectes: 1, ventesHorsLitres: 2 })
  })
})

describe('couverture des sorties par la traite des 7 derniers jours', () => {
  const collecte20: MouvementLait = { jour: '2026-11-01', poste: 'collecte', litres: 20 }
  const transforme20: MouvementLait = { jour: '2026-11-01', poste: 'transforme', litres: 20, consommeCollecte: true }

  it('signale la collecte vendue en lait cru puis transformée (témoin de la revue)', () => {
    const avant = [collecte20, vente('2026-11-01', 20)]

    expect(alerteDisponibilite(avant, [...avant, transforme20], ['2026-11-01'])).toMatchObject({
      debut: '2026-10-26', fin: '2026-11-01', disponible: 20, sorties: 40, depassement: 20, manque: 20,
    })
  })

  it('voit une vente postérieure que la collecte transformée couvrait', () => {
    const avant = [collecte20, vente('2026-11-04', 20)]

    expect(alerteDisponibilite(avant, [...avant, transforme20], ['2026-11-01'])).toMatchObject({
      debut: '2026-10-29', fin: '2026-11-04', depassement: 20, manque: 20,
    })
  })

  it('couvre une vente par la traite des 6 jours précédents (faux positif des sommes glissantes)', () => {
    // Témoin PostgreSQL du 2026-11-03 : 20 L le 21/10, 4 L écartés le 22/10,
    // 5 L vendus le 27/10. La fenêtre du 22 au 28/10 ne voyait que le lait écarté.
    const avant: MouvementLait[] = [
      { jour: '2026-10-21', poste: 'collecte', litres: 20 },
      { jour: '2026-10-22', poste: 'collecte', litres: 4 },
      { jour: '2026-10-22', poste: 'ecarte', litres: 4 },
    ]
    expect(alerteDisponibilite(avant, [...avant, vente('2026-10-27', 5)], ['2026-10-27'])).toBeNull()
  })

  it('ne compte plus une traite de plus de 6 jours', () => {
    const avant: MouvementLait[] = [
      { jour: '2026-10-21', poste: 'collecte', litres: 20 },
      { jour: '2026-10-24', poste: 'collecte', litres: 1 },
    ]
    expect(alerteDisponibilite(avant, [...avant, vente('2026-10-28', 5)], ['2026-10-28'])).toMatchObject({
      debut: '2026-10-22', fin: '2026-10-28', disponible: 1, depassement: 4, manque: 3.95,
    })
  })

  it('n’alerte pas pour une sortie sans collecte saisie dans ses 7 jours', () => {
    const avant = [collecte20, vente('2026-11-08', 20)]
    expect(alerteDisponibilite(avant, [...avant, transforme20], ['2026-11-01'])).toBeNull()
    const livraison: MouvementLait = { jour: '2026-11-03', poste: 'livre', litres: 500 }
    expect(alerteDisponibilite([], [livraison], ['2026-11-03'])).toBeNull()
  })

  it('laisse 5 % d’écart de mesure avec la laiterie et ignore un manque d’au plus 1 L', () => {
    const collecte100: MouvementLait = { jour: '2026-11-01', poste: 'collecte', litres: 100 }
    const livre = (litres: number): MouvementLait => ({ jour: '2026-11-03', poste: 'livre', litres })

    expect(alerteDisponibilite([collecte100], [collecte100, livre(106)], ['2026-11-03'])).toBeNull()
    expect(alerteDisponibilite([collecte100], [collecte100, livre(107)], ['2026-11-03'])).toMatchObject({ depassement: 7, manque: 2 })
    const petite: MouvementLait = { jour: '2026-11-01', poste: 'collecte', litres: 4 }
    expect(alerteDisponibilite([petite], [petite, vente('2026-11-01', 5)], ['2026-11-01'])).toBeNull()
    expect(alerteDisponibilite([petite], [petite, vente('2026-11-01', 5.5)], ['2026-11-01'])).toMatchObject({ depassement: 1.5, manque: 1.3 })
  })

  it('ne couvre rien avec le lait écarté', () => {
    const avant: MouvementLait[] = [collecte20, { jour: '2026-11-01', poste: 'ecarte', litres: 20 }]
    expect(alerteDisponibilite(avant, [...avant, vente('2026-11-02', 10)], ['2026-11-02'])).toMatchObject({ disponible: 0, depassement: 10, manque: 10 })
  })

  it('n’alerte pas quand une correction réduit un manque existant', () => {
    const avant = [collecte20, vente('2026-11-01', 40, 'vente:7')]
    const apres = [collecte20, vente('2026-11-01', 30, 'vente:7')]
    expect(alerteDisponibilite(avant, apres, ['2026-11-01'])).toBeNull()
  })
})

describe('chargement et contrôle sur la base', () => {
  const donnees = {
    collectes: [
      { date: '2026-11-01T00:00:00Z', quantiteLitres: '20.000' },
      { date: '2026-11-02T00:00:00Z', quantiteLitres: '10', lotFromageId: 'f1' },
      { date: '2026-11-02T00:00:00Z', quantiteLitres: '4', ecarteAttente: true },
    ],
    fabrications: [{ dateFabrication: '2026-11-03T00:00:00Z', volumeLaitUtiliseL: '6.00' }],
    livraisons: [{ date: '2026-11-03T00:00:00Z', litres: '3' }],
    ventes: [
      { id: 1, date: '2026-11-01T09:00:00Z', quantite: 2, unite: 'L' },
      { id: 2, date: '2026-11-01T09:00:00Z', quantite: 6, unite: 'unite' },
      { id: 3, date: '2026-10-20T09:00:00Z', quantite: 50, unite: 'L' },
    ],
  }

  it('lit collectes, fabrications avec et sans collecte, livraisons et ventes en litres', async () => {
    const b = await chargerBilanLait(base(donnees), 'u1', '2026-10-28', '2026-11-03')

    expect(b).toMatchObject({ collecte: 34, ecarte: 4, disponible: 30, transforme: 16, livre: 3, venduCru: 2, sorties: 21, nonAffecte: 9, nbCollectes: 3, ventesHorsLitres: 1 })
  })

  it('ne retire qu’une fois une collecte transformée puis écartée par un soin saisi après coup', async () => {
    const b = await chargerBilanLait(base({
      collectes: [{ date: '2026-11-03T00:00:00Z', quantiteLitres: '40', lotFromageId: 'f1', ecarteAttente: true }],
    }), 'u1', '2026-10-28', '2026-11-03')

    expect(b).toMatchObject({ collecte: 40, ecarte: 0, transforme: 40, nonAffecte: 0 })
  })

  it('rend les 7 derniers jours et le mois en cours', async () => {
    const { jours7, mois } = await chargerBilansLait(base(donnees), 'u1', '2026-11-03')
    expect(jours7).toMatchObject({ debut: '2026-10-28', fin: '2026-11-03', venduCru: 2 })
    expect(mois).toMatchObject({ debut: '2026-11-01', fin: '2026-11-03', collecte: 34 })
  })

  it('refuse sans confirmation la transformation d’une collecte déjà vendue', async () => {
    const db = base({ collectes: [{ date: '2026-11-01T00:00:00Z', quantiteLitres: 20 }], ventes: [{ id: 9, date: '2026-11-01T10:00:00Z', quantite: 20, unite: 'L' }] })

    const alerte = await verifierDisponibiliteLait(db, 'u1', { ajout: [{ jour: '2026-11-01', poste: 'transforme', litres: 20, consommeCollecte: true }] })

    expect(alerte).toMatchObject({ depassement: 20, manque: 20, venduCru: 20, transforme: 20 })
    const corps = corpsLaitIndisponible(alerte!)
    expect(corps.code).toBe(CODE_LAIT_INDISPONIBLE)
    expect(corps.error).toBe('Du 26/10 au 01/11, les sorties de lait (vendu cru 20 L, transformé 20 L) atteindraient 40 L pour 20 L collectés : 20 L de plus que la traite. Si ce lait vient d\'un achat ou d\'une collecte non saisie, vous pouvez confirmer.')
  })

  it('retire la vente corrigée avant de compter sa nouvelle valeur', async () => {
    const db = base({ collectes: [{ date: '2026-11-01T00:00:00Z', quantiteLitres: 20 }], ventes: [{ id: 9, date: '2026-11-01T10:00:00Z', quantite: 18, unite: 'L' }] })

    expect(await verifierDisponibiliteLait(db, 'u1', { ajout: [vente('2026-11-01', 20)], retirerSource: 'vente:9' })).toBeNull()
    expect(await verifierDisponibiliteLait(db, 'u1', { ajout: [vente('2026-11-01', 20)] })).toMatchObject({ depassement: 18, manque: 17 })
  })

  it('cite le lait écarté dans le message', () => {
    const alerte = alerteDisponibilite(
      [{ jour: '2026-11-01', poste: 'collecte', litres: 24 }, { jour: '2026-11-01', poste: 'ecarte', litres: 4 }],
      [{ jour: '2026-11-01', poste: 'collecte', litres: 24 }, { jour: '2026-11-01', poste: 'ecarte', litres: 4 }, { jour: '2026-11-02', poste: 'livre', litres: 22.5 }],
      ['2026-11-02'],
    )
    expect(messageLaitIndisponible(alerte!)).toContain('pour 20 L collectés (hors 4 L écartés pour délai d\'attente) : 2,5 L de plus')
  })
})
