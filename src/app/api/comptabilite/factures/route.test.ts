/**
 * TICKET cmsogchrf — PATCH /api/comptabilite/factures : le passage d'une
 * facture au statut 'payee' doit propager paye=true aux VenteProduit liées
 * (relation factureId), dans la même transaction. La sync inverse
 * vente→facture existe déjà côté api/elevage/ventes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  factureFindFirst: vi.fn(),
  txFactureUpdate: vi.fn(),
  txVenteProduitUpdateMany: vi.fn(),
  invalidateKpi: vi.fn(),
  creerFacture: vi.fn(),
  clientFindMany: vi.fn(),
  clientFindFirst: vi.fn(),
  dossierFacture: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: mocks.invalidateKpi }))
vi.mock('@/lib/facture-utils', () => ({
  creerFacture: mocks.creerFacture,
  montantAvoirsEmis: vi.fn().mockResolvedValue(0),
  reserverProchainNumeroForEmission: vi.fn(),
  snapshotEmetteurForEmission: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    facture: { findFirst: mocks.factureFindFirst },
    mouvementStockCommercial: { count: async () => 0 },
    client: { findMany: mocks.clientFindMany, findFirst: mocks.clientFindFirst },
    $transaction: (callback: (tx: unknown) => unknown) =>
      callback({
        mouvementStockCommercial: { count: async () => 0 },
        recolte: { count: async () => 0 },
        facture: { findUnique: async () => null, update: mocks.txFactureUpdate, findFirstOrThrow: async () => ({ ...(await mocks.factureFindFirst()), lignes: [] }) },
        $queryRaw: async (sql: TemplateStringsArray) => sql.join('?').includes('cibles_reglement') ? mocks.dossierFacture() : [{ id: 5 }],
        $executeRaw: async () => 0,
        venteProduit: { updateMany: mocks.txVenteProduitUpdateMany },
      }),
  },
}))

import { PATCH, POST } from './route'

const request = (body: Record<string, unknown>, method = 'PATCH') =>
  new NextRequest('http://localhost/api/comptabilite/factures', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('PATCH /api/comptabilite/factures — propagation paiement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
    mocks.factureFindFirst.mockResolvedValue({ id: 5, userId: 'user-1', statut: 'emise', type: 'facture' })
    mocks.txFactureUpdate.mockResolvedValue({ id: 5, statut: 'payee', lignes: [], client: null })
    mocks.txVenteProduitUpdateMany.mockResolvedValue({ count: 1 })
    mocks.dossierFacture.mockResolvedValue([])
  })

  it('propage paye=true aux VenteProduit liées quand la facture passe à payee', async () => {
    const res = await PATCH(request({ id: 5, statut: 'payee' }))

    expect(res.status).toBe(200)
    expect(mocks.txVenteProduitUpdateMany).toHaveBeenCalledWith({
      where: { factureId: 5, userId: 'user-1' },
      data: { paye: true },
    })
    expect(mocks.txFactureUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: expect.objectContaining({ statut: 'payee', datePaiement: expect.any(Date) }),
      })
    )
  })

  it('ne touche pas aux ventes liées pour une transition vers annulee', async () => {
    const res = await PATCH(request({ id: 5, statut: 'annulee' }))

    expect(res.status).toBe(200)
    expect(mocks.txVenteProduitUpdateMany).not.toHaveBeenCalled()
  })

  it('corrige la catégorie d’opération et la livraison d’une facture émise sans toucher au statut (lot 1 facturation électronique)', async () => {
    mocks.txFactureUpdate.mockResolvedValue({ id: 5, statut: 'emise', categorieOperation: 'services', lignes: [], client: null })
    const res = await PATCH(request({ id: 5, categorieOperation: 'Services', dateLivraison: '2026-10-09', adresseLivraison: 'Lieu-dit Larrouy', codePostalLivraison: '64160', villeLivraison: 'Morlaàs' }))

    expect(res.status).toBe(200)
    expect(mocks.txFactureUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: expect.objectContaining({ categorieOperation: 'services', dateLivraison: expect.any(Date), adresseLivraison: 'Lieu-dit Larrouy', villeLivraison: 'Morlaàs' }),
      }),
    )
    expect(mocks.txFactureUpdate.mock.calls[0][0].data).not.toHaveProperty('statut')
    expect(mocks.txVenteProduitUpdateMany).not.toHaveBeenCalled()
  })

  it('refuse une catégorie d’opération inconnue et toute mention sur une facture annulée', async () => {
    expect((await PATCH(request({ id: 5, categorieOperation: 'autre' }))).status).toBe(400)
    mocks.factureFindFirst.mockResolvedValue({ id: 5, userId: 'user-1', statut: 'annulee', type: 'facture' })
    expect((await PATCH(request({ id: 5, categorieOperation: 'biens' }))).status).toBe(409)
    expect(mocks.txFactureUpdate).not.toHaveBeenCalled()
  })

  it('ne propose plus l’annulation d’une facture payée, toujours refusée : elle se régularise par un avoir', async () => {
    mocks.factureFindFirst.mockResolvedValue({ id: 5, userId: 'user-1', statut: 'payee', type: 'facture' })

    const res = await PATCH(request({ id: 5, statut: 'annulee' }))

    expect(res.status).toBe(409)
    expect((await res.json()).details).toBe('Transitions possibles : emise')
    expect(mocks.txFactureUpdate).not.toHaveBeenCalled()
  })

  it('annule une facture émise dont l’unique versement a été annulé, pas une facture qui en porte un', async () => {
    mocks.dossierFacture.mockResolvedValue([{ dossier_id: 'dossier-qa', regle: BigInt(0), actifs: BigInt(1) }])
    expect((await PATCH(request({ id: 5, statut: 'annulee' }))).status).toBe(409)
    expect(mocks.txFactureUpdate).not.toHaveBeenCalled()

    mocks.dossierFacture.mockResolvedValue([{ dossier_id: 'dossier-qa', regle: BigInt(0), actifs: BigInt(0) }])
    expect((await PATCH(request({ id: 5, statut: 'annulee' }))).status).toBe(200)
    expect(mocks.txFactureUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ statut: 'annulee' }) }))
  })

  it('refuse toujours une transition invalide (annulee → payee) sans toucher aux ventes', async () => {
    mocks.factureFindFirst.mockResolvedValue({ id: 5, userId: 'user-1', statut: 'annulee', type: 'facture' })

    const res = await PATCH(request({ id: 5, statut: 'payee' }))

    expect(res.status).toBe(409)
    expect(mocks.txVenteProduitUpdateMany).not.toHaveBeenCalled()
    expect(mocks.txFactureUpdate).not.toHaveBeenCalled()
  })
})

/**
 * Ticket cmvfljaru (QA 2026-10-19) — une facture saisie au nom exact d'un
 * client professionnel partait sans fiche, donc sans son SIRET. Décision de
 * revue : la route ne devine pas. L'écran envoie l'id de la fiche affichée
 * (choisie ou désignée par le nom) ou `null` (« Facturer sans la fiche ») ;
 * un nom qui désigne une fiche sans `clientId` est refusé (409). Le corps
 * rejoué est celui qu'envoie l'onglet « Nouvelle facture ».
 */
describe('POST /api/comptabilite/factures — rattachement à la fiche client', () => {
  const corpsEcran = (extra: Record<string, unknown> = {}) => ({
    type: 'facture',
    clientNom: 'Restaurant du Port',
    clientAdresse: '2 quai des Pêcheurs, 64500 Ciboure',
    date: '2026-10-19',
    dateEcheance: '2026-11-18',
    objet: 'Livraison mixte',
    totalHT: 150,
    totalTVA: 15.5,
    totalTTC: 165.5,
    statut: 'emise',
    notes: 'Paiement à 30 jours par virement.',
    categorieOperation: 'mixte',
    dateLivraison: null,
    adresseLivraison: null,
    codePostalLivraison: null,
    villeLivraison: null,
    paysLivraison: null,
    lignes: [
      { description: 'Légumes', quantite: 10, unite: 'kg', prixUnitaire: 10, tauxTVA: 5.5, montantHT: 100, montantTVA: 5.5, montantTTC: 105.5 },
      { description: 'Prestation de livraison', quantite: 1, unite: 'forfait', prixUnitaire: 50, tauxTVA: 20, montantHT: 50, montantTVA: 10, montantTTC: 60 },
    ],
    ...extra,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
    mocks.creerFacture.mockResolvedValue({ id: 34, numero: 'F-2026-0003', lignes: [], client: null })
    // Fiches du compte : 9, 10 et 12 (exonérée) ; toute autre est d'un autre compte.
    mocks.clientFindFirst.mockImplementation(async ({ where }: { where: { id: number; userId: string } }) =>
      where.userId === 'user-1' && [9, 10, 12].includes(where.id) ? { id: where.id } : null
    )
    mocks.clientFindMany.mockResolvedValue([
      { id: 9, nom: 'Restaurant du Port' },
      { id: 10, nom: 'Épicerie du Marché' },
    ])
  })

  it('refuse (409, champ clientId) un nom qui désigne une fiche active quand aucun clientId n’est envoyé', async () => {
    const res = await POST(request(corpsEcran({ clientNom: '  restaurant du  port ' }), 'POST'))

    expect(res.status).toBe(409)
    const corps = await res.json()
    expect(corps.champ).toBe('clientId')
    expect(corps.clientIdPropose).toBe(9)
    expect(corps.error).toContain('choisissez-la ou facturez sans fiche')
    expect(mocks.clientFindMany).toHaveBeenCalledWith({ where: { userId: 'user-1', actif: true }, select: { id: true, nom: true } })
    expect(mocks.creerFacture).not.toHaveBeenCalled()
  })

  it('rattache la fiche dont l’écran envoie l’id (fiche désignée par le nom, encadré affiché)', async () => {
    const res = await POST(request(corpsEcran({ clientId: 9 }), 'POST'))

    expect(res.status).toBe(201)
    expect(mocks.clientFindMany).not.toHaveBeenCalled()
    expect(mocks.creerFacture).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'user-1', clientId: 9, notes: 'Paiement à 30 jours par virement.' }),
    )
  })

  it('refuse (400, champ clientId) la fiche d’un autre compte au lieu de facturer sans client', async () => {
    const res = await POST(request(corpsEcran({ clientId: 77 }), 'POST'))
    expect(res.status).toBe(400)
    const corps = await res.json()
    expect(corps.champ).toBe('clientId')
    expect(mocks.creerFacture).not.toHaveBeenCalled()
  })

  it('respecte un clientId choisi au sélecteur, sans chercher par nom', async () => {
    const res = await POST(request(corpsEcran({ clientId: 10 }), 'POST'))

    expect(res.status).toBe(201)
    expect(mocks.clientFindMany).not.toHaveBeenCalled()
    expect(mocks.creerFacture).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ clientId: 10 }))
  })

  it('ne rattache pas quand l’écran a choisi « Facturer sans la fiche » (clientId null)', async () => {
    const res = await POST(request(corpsEcran({ clientId: null }), 'POST'))

    expect(res.status).toBe(201)
    expect(mocks.clientFindMany).not.toHaveBeenCalled()
    expect(mocks.creerFacture).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ clientId: null }))
  })

  it('fiche exonérée de TVA : les montants enregistrés sont ceux que l’écran affiche (lignes à 0 %, HT = TTC)', async () => {
    const reel = await vi.importActual<typeof import('@/lib/facture-utils')>('@/lib/facture-utils')
    const create = vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...data, lignes: (data.lignes as { create: unknown[] }).create }))
    const txReel = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(1),
      $queryRawUnsafe: vi.fn().mockImplementation(async (sql: string) =>
        sql.includes('FOR UPDATE') ? [{ prochain_num: 3, prefixe: 'F-2026-', format: '%04d' }] : [{ max_num: 2 }],
      ),
      client: {
        findFirst: vi.fn().mockResolvedValue({
          id: 12, nom: 'Association des Jardins', adresse: '1 place de la Mairie', codePostal: '64000', ville: 'Pau',
          siret: null, siren: null, tvaIntra: null, exonererTVA: true,
        }),
      },
      exploitation: { findUnique: vi.fn().mockResolvedValue(null) },
      facture: { create },
    }
    mocks.creerFacture.mockImplementation((_tx: unknown, params: Parameters<typeof reel.creerFacture>[1]) => reel.creerFacture(txReel as never, params))

    // Corps de l'écran pour une fiche exonérée : taux appliqué 0 %, TVA nulle.
    const res = await POST(request(corpsEcran({
      clientId: 12,
      clientNom: 'Association des Jardins',
      totalHT: 150,
      totalTVA: 0,
      totalTTC: 150,
      lignes: [
        { description: 'Légumes', quantite: 10, unite: 'kg', prixUnitaire: 10, tauxTVA: 0, montantHT: 100, montantTVA: 0, montantTTC: 100 },
        { description: 'Prestation de livraison', quantite: 1, unite: 'forfait', prixUnitaire: 50, tauxTVA: 0, montantHT: 50, montantTVA: 0, montantTTC: 50 },
      ],
    }), 'POST'))

    expect(res.status).toBe(201)
    const data = create.mock.calls[0][0].data
    expect(data).toMatchObject({ clientId: 12, totalHT: 150, totalTVA: 0, totalTTC: 150 })
    expect(data.lignes.create).toEqual([
      expect.objectContaining({ prixUnitaire: 10, tauxTVA: 0, montantHT: 100, montantTVA: 0, montantTTC: 100 }),
      expect.objectContaining({ prixUnitaire: 50, tauxTVA: 0, montantHT: 50, montantTVA: 0, montantTTC: 50 }),
    ])
  })

  it('ne choisit pas entre deux homonymes ni pour un nom sans fiche', async () => {
    mocks.clientFindMany.mockResolvedValue([
      { id: 9, nom: 'Restaurant du Port' },
      { id: 11, nom: 'RESTAURANT DU PORT' },
    ])
    await POST(request(corpsEcran(), 'POST'))
    expect(mocks.creerFacture).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ clientId: null }))

    await POST(request(corpsEcran({ clientNom: 'Client de passage' }), 'POST'))
    expect(mocks.creerFacture).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ clientId: null }))
  })
})

/**
 * Ticket cmvflhyyu (QA 2026-10-19) — les notes sont imprimées sur la facture :
 * une fois émise, elles ne changent plus (le refus nomme son champ).
 */
describe('PATCH /api/comptabilite/factures — notes d’une facture émise', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
    mocks.txFactureUpdate.mockResolvedValue({ id: 5, statut: 'emise', lignes: [], client: null })
  })

  it('refuse de changer les notes d’une facture émise', async () => {
    mocks.factureFindFirst.mockResolvedValue({ id: 5, userId: 'user-1', statut: 'emise', type: 'facture', notes: 'Paiement à 30 jours.' })
    const res = await PATCH(request({ id: 5, notes: 'Paiement à réception.' }))

    expect(res.status).toBe(409)
    expect((await res.json()).champ).toBe('notes')
    expect(mocks.txFactureUpdate).not.toHaveBeenCalled()
  })

  it('compare le texte imprimé : vide ≡ absent, espaces ignorés', async () => {
    mocks.factureFindFirst.mockResolvedValue({ id: 5, userId: 'user-1', statut: 'emise', type: 'facture', notes: null, objet: 'Livraison' })
    expect((await PATCH(request({ id: 5, notes: '' }))).status).toBe(200)
    mocks.factureFindFirst.mockResolvedValue({ id: 5, userId: 'user-1', statut: 'emise', type: 'facture', notes: 'Paiement à 30 jours.', objet: 'Livraison' })
    expect((await PATCH(request({ id: 5, notes: '  Paiement à 30 jours.  ' }))).status).toBe(200)
    // Rien n'est réécrit sur une facture émise.
    expect(mocks.txFactureUpdate.mock.calls.every((c) => !('notes' in c[0].data))).toBe(true)
  })

  it('valide les notes d’un brouillon comme à la création (5 000 caractères, champ nommé)', async () => {
    mocks.factureFindFirst.mockResolvedValue({ id: 6, userId: 'user-1', statut: 'brouillon', type: 'facture', notes: null })
    const res = await PATCH(request({ id: 6, notes: 'x'.repeat(5001) }))
    expect(res.status).toBe(400)
    expect((await res.json()).champ).toBe('notes')
    expect(mocks.txFactureUpdate).not.toHaveBeenCalled()
  })

  it('accepte les notes inchangées et les notes d’un brouillon', async () => {
    mocks.factureFindFirst.mockResolvedValue({ id: 5, userId: 'user-1', statut: 'emise', type: 'facture', notes: 'Paiement à 30 jours.' })
    expect((await PATCH(request({ id: 5, notes: 'Paiement à 30 jours.', statut: 'payee' }))).status).toBe(200)

    mocks.factureFindFirst.mockResolvedValue({ id: 6, userId: 'user-1', statut: 'brouillon', type: 'facture', notes: null })
    expect((await PATCH(request({ id: 6, notes: 'Paiement à réception.' }))).status).toBe(200)
    expect(mocks.txFactureUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ notes: 'Paiement à réception.' }) }))
  })
})


it('retirer le pointage d’une facture remet aussi ses ventes en impayé', async () => {
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
  mocks.factureFindFirst.mockResolvedValue({ id: 5, userId: 'user-1', statut: 'payee', type: 'facture' })
  mocks.txVenteProduitUpdateMany.mockClear()
  const res = await PATCH(request({ id: 5, statut: 'emise' }))
  expect(res.status).toBe(200)
  expect(mocks.txVenteProduitUpdateMany).toHaveBeenCalledWith({ where: { factureId: 5, userId: 'user-1' }, data: { paye: false } })
  expect(mocks.txFactureUpdate.mock.calls.at(-1)?.[0].data.datePaiement).toBeNull()
})
