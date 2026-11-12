/**
 * Constat C9 de la revue réglementaire du 2026-11-12 : supprimer un soin
 * RÉALISÉ effaçait sa trace au registre, rendait les doses à la pharmacie et
 * recalculait l'écartement du lait sans lui, quelle qu'en soit la raison.
 *
 * Règlement (UE) 2019/6, art. 108 §1, §2 et §5 : registre des médicaments
 * utilisés, tenu à disposition cinq ans ; arrêté du 5 juin 2000, art. 7 et 11.
 * Règle retenue : un soin administré ne se supprime pas ; une erreur de saisie
 * reste corrigeable, motivée, et son original est conservé au journal.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  soinFindFirst: vi.fn(),
  soinDelete: vi.fn(),
  injectionFindMany: vi.fn(),
  annulationCreate: vi.fn(),
  stockFindFirst: vi.fn(),
  stockUpdate: vi.fn(),
  deleteAutoEntry: vi.fn(),
  cibles: vi.fn(),
  resync: vi.fn(),
  ordre: [] as string[],
}))

vi.mock('@/lib/prisma', () => {
  const tx = {
    soinAnimal: {
      findFirst: mocks.soinFindFirst,
      delete: vi.fn(async (args: unknown) => { mocks.ordre.push('delete'); return mocks.soinDelete(args) }),
    },
    injectionSoin: { findMany: mocks.injectionFindMany },
    annulationSoinAnimal: {
      create: vi.fn(async (args: unknown) => { mocks.ordre.push('journal'); return mocks.annulationCreate(args) }),
    },
    stockMedicamentElevage: { findFirst: mocks.stockFindFirst, update: mocks.stockUpdate },
  }
  return { default: {
    soinAnimal: { findFirst: mocks.soinFindFirst },
    injectionSoin: { findMany: mocks.injectionFindMany },
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  } }
})
vi.mock('@/lib/auto-compta', () => ({ deleteAutoEntry: mocks.deleteAutoEntry }))
vi.mock('@/lib/elevage/attente-lait', () => ({ ciblesLaitAffectees: mocks.cibles, resyncEcartementLait: mocks.resync }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))

import { supprimerSoin } from './suppression-soin'

const soinRealise = {
  id: 41, userId: 'user-1', animalId: 7, lotId: null,
  date: new Date('2026-11-02T08:00:00Z'), type: 'Traitement vétérinaire', fait: true,
  produit: 'Pénicilline', produitId: 'p1', stockMedicamentId: 'stock-1', quantite: 10, unite: 'mL',
  quantitePreleveeStock: 10, tempsAttenteLaitJ: 6, finAttenteLait: new Date('2026-11-08T08:00:00Z'),
  finAttenteViande: new Date('2026-11-30T08:00:00Z'), finAttenteOeufs: null,
}

describe('supprimerSoin (C9)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.ordre.length = 0
    mocks.injectionFindMany.mockResolvedValue([])
    mocks.cibles.mockResolvedValue({ animalIds: [7], lotIds: [] })
    mocks.stockFindFirst.mockResolvedValue({ quantite: 90, notes: null })
  })

  it('refuse de supprimer un soin réalisé sans nature ni motif : rien n’est effacé, rendu ni recalculé', async () => {
    mocks.soinFindFirst.mockResolvedValue(soinRealise)

    const res = await supprimerSoin('user-1', 41)

    expect(res).toMatchObject({ ok: false, status: 409, code: 'ANNULATION_MOTIVEE_REQUISE' })
    expect(mocks.soinDelete).not.toHaveBeenCalled()
    expect(mocks.stockUpdate).not.toHaveBeenCalled()
    expect(mocks.resync).not.toHaveBeenCalled()
    expect(mocks.deleteAutoEntry).not.toHaveBeenCalled()
  })

  it('administration réelle : le soin reste, sans retour fictif en pharmacie ni levée de l’écartement', async () => {
    mocks.soinFindFirst.mockResolvedValue(soinRealise)

    const res = await supprimerSoin('user-1', 41, {
      annulation: { nature: 'administre', motif: 'Je voulais nettoyer la liste' },
    })

    expect(res).toMatchObject({ ok: false, status: 409, code: 'SOIN_ADMINISTRE_CONSERVE' })
    expect(mocks.soinDelete).not.toHaveBeenCalled()
    expect(mocks.stockUpdate).not.toHaveBeenCalled()
    expect(mocks.resync).not.toHaveBeenCalled()
    expect(mocks.annulationCreate).not.toHaveBeenCalled()
  })

  it('une injection réalisée suffit à protéger un soin resté « à faire »', async () => {
    mocks.soinFindFirst.mockResolvedValue({ ...soinRealise, fait: false, quantitePreleveeStock: 0 })
    mocks.injectionFindMany.mockResolvedValue([{ numero: 1, statut: 'realisee', dateRealisee: soinRealise.date, datePrevue: soinRealise.date }])

    const res = await supprimerSoin('user-1', 41)

    expect(res).toMatchObject({ ok: false, status: 409 })
    expect(mocks.soinDelete).not.toHaveBeenCalled()
  })

  it('erreur de saisie motivée : l’original est journalisé AVANT la suppression, puis doses et écartement suivent la vérité', async () => {
    mocks.soinFindFirst.mockResolvedValue(soinRealise)

    const res = await supprimerSoin('user-1', 41, {
      annulation: { nature: 'erreur_saisie', motif: '  Saisi sur la mauvaise chèvre  ' },
      acteurId: 'invite-9',
    })

    expect(res.ok).toBe(true)
    expect(mocks.ordre).toEqual(['journal', 'delete'])
    const journal = mocks.annulationCreate.mock.calls[0][0].data
    expect(journal).toMatchObject({
      userId: 'user-1',
      soinId: 41,
      soinIdOrigine: 41,
      action: 'suppression',
      nature: 'erreur_saisie',
      motif: 'Saisi sur la mauvaise chèvre',
      acteurId: 'invite-9',
    })
    expect(journal.instantane.soin).toMatchObject({ id: 41, produit: 'Pénicilline', quantitePreleveeStock: 10 })
    // Jamais administré : le prélèvement fictif est rendu et la fausse
    // restriction ne reste pas active.
    expect(mocks.stockUpdate).toHaveBeenCalledWith({ where: { id: 'stock-1' }, data: { quantite: { increment: 10 } } })
    expect(mocks.resync).toHaveBeenCalled()
  })

  it('refuse un motif vide même pour une erreur de saisie', async () => {
    mocks.soinFindFirst.mockResolvedValue(soinRealise)

    const res = await supprimerSoin('user-1', 41, { annulation: { nature: 'erreur_saisie', motif: '   ' } })

    expect(res).toMatchObject({ ok: false, status: 409, code: 'ANNULATION_MOTIVEE_REQUISE' })
    expect(mocks.soinDelete).not.toHaveBeenCalled()
  })

  it('un soin seulement planifié se supprime sans motif ni journal', async () => {
    mocks.soinFindFirst.mockResolvedValue({ ...soinRealise, fait: false, quantitePreleveeStock: 0, finAttenteLait: null })

    const res = await supprimerSoin('user-1', 41)

    expect(res.ok).toBe(true)
    expect(mocks.soinDelete).toHaveBeenCalled()
    expect(mocks.annulationCreate).not.toHaveBeenCalled()
  })
})
