import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
const identite = vi.hoisted(() => ({ id: '', lectureSeule: false, proprietaire: true, admin: false }))
vi.mock('@/lib/auth-utils', () => ({
  requireAdminApi: async () =>
    identite.admin
      ? { error: null, session: { user: { id: identite.id, role: 'ADMIN' } } }
      : { error: new Response(JSON.stringify({ error: 'Accès interdit' }), { status: 403 }), session: null },
  requireAuthApi: async () => ({
    error: null,
    session: {
      user: {
        id: identite.id,
        acteurId: identite.id,
        estProprietaireExploitation: identite.proprietaire,
        peutEcrireExploitation: !identite.lectureSeule,
      },
    },
  }),
}))
const url = process.env.GLEBA_BANQUE_QA_DATABASE_URL
const active = Boolean(
  url && /^\/gleba_reglements_qa_banque_20261027_[0-9a-f]{6}$/.test(new URL(url).pathname),
)
let db: PrismaClient
const comptes: string[] = []
const req = (chemin: string, data?: object, method = data ? 'POST' : 'GET') =>
  new NextRequest('http://localhost' + chemin, {
    method,
    ...(data
      ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }
      : {}),
  })
async function json(r: Response, statut = 200) {
  const d = await r.json()
  expect(r.status, JSON.stringify(d)).toBe(statut)
  return d
}
const entree = (id: number, montant: string, cle = randomUUID()) => ({
  type: 'Facture',
  id,
  montant,
  date: '2026-10-27',
  modeReglement: 'Virement',
  reference: 'REFERENCE-QA',
  cleIdempotence: cle,
})
async function facture(montant = 100, userId = identite.id) {
  return db.facture.create({
    data: {
      userId,
      numero: 'F-QA-' + randomUUID(),
      clientNom: 'Client fictif',
      totalHT: montant,
      totalTVA: 0,
      totalTTC: montant,
      statut: 'emise',
      date: new Date('2026-10-27'),
    },
  })
}
describe.skipIf(!active)('règlements et rapprochement sur PostgreSQL isolé', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = url
    db = (await import('@/lib/prisma')).default
  })
  beforeEach(async () => {
    const u = await db.user.create({
      data: { email: 'banque-' + randomUUID() + '@example.test', emailVerified: true },
    })
    comptes.push(u.id)
    identite.id = u.id
    identite.lectureSeule = false
    identite.proprietaire = true
    identite.admin = false
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })
  afterAll(async () => {
    if (db) {
      for (const id of comptes) await db.user.deleteMany({ where: { id } })
      await db.$disconnect()
    }
  })
  it('encaisse en deux fois, protège le pointage et garde une annulation tracée', async () => {
    const f = await facture(100.1),
      api = await import('@/app/api/comptabilite/reglements/route')
    const premier = (
      await json(
        await api.POST(req('/api/comptabilite/reglements', entree(f.id, '30,03'))),
        201,
      )
    ).data
    const suivi = await json(
      await api.GET(req('/api/comptabilite/reglements?type=Facture&id=' + f.id)),
    )
    expect(suivi).toMatchObject({
      montantRegle: 30.03,
      resteAPayer: 70.07,
      statut: 'partiel',
      detaille: true,
    })
    expect((await db.facture.findUniqueOrThrow({ where: { id: f.id } })).statut).toBe('emise')
    const factures = await import('@/app/api/comptabilite/factures/route')
    expect(
      (
        await factures.PATCH(
          req('/api/comptabilite/factures', { id: f.id, statut: 'payee' }, 'PATCH'),
        )
      ).status,
    ).toBe(409)
    await json(await api.POST(req('/api/comptabilite/reglements', entree(f.id, '70,07'))), 201)
    expect((await db.facture.findUniqueOrThrow({ where: { id: f.id } })).statut).toBe('payee')
    await json(
      await api.DELETE(
        req(
          '/api/comptabilite/reglements',
          { id: premier.id, motif: 'Erreur de saisie fictive' },
          'DELETE',
        ),
      ),
    )
    const corrige = await json(
      await api.GET(req('/api/comptabilite/reglements?type=Facture&id=' + f.id)),
    )
    expect(corrige).toMatchObject({ montantRegle: 70.07, resteAPayer: 30.03 })
    expect(corrige.reglements).toHaveLength(2)
    expect(
      corrige.reglements.find((r: { id: string }) => r.id === premier.id).annuleLe,
    ).toBeTruthy()
  })
  it('ne double pas un versement rejoué et refuse une clé réutilisée autrement', async () => {
    const f = await facture(),
      api = await import('@/app/api/comptabilite/reglements/route'),
      e = entree(f.id, '30')
    const a = await json(await api.POST(req('/api/comptabilite/reglements', e)), 201)
    const b = await json(await api.POST(req('/api/comptabilite/reglements', e)), 201)
    expect(a.data.id).toBe(b.data.id)
    expect(
      (await api.POST(req('/api/comptabilite/reglements', { ...e, montant: '40' }))).status,
    ).toBe(409)
    expect(await db.reglement.count({ where: { userId: identite.id } })).toBe(1)
  })
  it('sérialise deux versements concurrents et empêche le dépassement du solde', async () => {
    const f = await facture(),
      api = await import('@/app/api/comptabilite/reglements/route')
    const reponses = await Promise.all([
      api.POST(req('/api/comptabilite/reglements', entree(f.id, '60'))),
      api.POST(req('/api/comptabilite/reglements', entree(f.id, '60'))),
    ])
    expect(reponses.map((r) => r.status).sort()).toEqual([201, 409])
    expect(await db.reglement.count({ where: { userId: identite.id } })).toBe(1)
    expect(
      (await json(await api.GET(req('/api/comptabilite/reglements?type=Facture&id=' + f.id))))
        .resteAPayer,
    ).toBe(40)
  })
  it('sérialise une baisse du montant source et un versement concurrent', async () => {
    const auto = await import('@/lib/auto-compta'),
      api = await import('@/app/api/comptabilite/reglements/route')
    const d = await db.depenseManuelle.create({
      data: {
        userId: identite.id,
        categorie: 'materiel',
        description: 'Pièce fictive concurrente',
        montant: 100,
        paye: false,
        auto: true,
        sourceType: 'achat_animal',
        sourceId: 990002,
      },
    })
    const resultats = await Promise.allSettled([
      api.POST(
        req('/api/comptabilite/reglements', {
          ...entree(d.id, '80'),
          type: 'DepenseManuelle',
        }),
      ),
      auto.createDepenseFromLotAnimaux(identite.id, {
        id: 990002,
        prixAchatTotal: 50,
        nom: 'Lot fictif',
      }),
    ])
    const piece = await db.depenseManuelle.findFirstOrThrow({
      where: { userId: identite.id, sourceId: 990002 },
    })
    const suivi = await json(
      await api.GET(req('/api/comptabilite/reglements?type=DepenseManuelle&id=' + piece.id)),
    )
    expect(suivi.montantRegle).toBeLessThanOrEqual(piece.montant)
    const paiement = resultats[0]
    expect(
      paiement.status === 'fulfilled' &&
        paiement.value.status === 201 &&
        resultats[1].status === 'fulfilled',
    ).toBe(false)
  })
  it('refuse un accès inter-exploitation aux pièces et aux opérations', async () => {
    const f = await facture(),
      api = await import('@/app/api/comptabilite/reglements/route')
    const autre = await db.user.create({
      data: { email: 'autre-' + randomUUID() + '@example.test' },
    })
    comptes.push(autre.id)
    identite.id = autre.id
    expect(
      (await api.POST(req('/api/comptabilite/reglements', entree(f.id, '30')))).status,
    ).toBe(404)
    expect(await db.reglement.count({ where: { userId: autre.id } })).toBe(0)
  })
  it('retrouve recettes et dépenses manuelles par client, fournisseur, référence et pièce, sans sortir du compte', async () => {
    const { GET } = await import('@/app/api/comptabilite/reglements/cibles/route')
    const chercher = async (q: string) =>
      (
        await json(
          await GET(req('/api/comptabilite/reglements/cibles?' + new URLSearchParams({ q }))),
        )
      ).data as { type: string; id: number; libelle: string }[]
    const trouve = (lignes: { type: string; id: number }[], type: string, id: number) =>
      lignes.some((l) => l.type === type && l.id === id)
    const autre = await db.user.create({
      data: { email: 'autre-' + randomUUID() + '@example.test' },
    })
    comptes.push(autre.id)
    const fiche = await db.client.create({ data: { userId: identite.id, nom: 'FicheClientQA' } })
    const ficheAutre = await db.client.create({ data: { userId: autre.id, nom: 'FicheAutreQA' } })
    const base = {
      userId: identite.id,
      categorie: 'legumes',
      montant: 30,
      date: new Date('2026-10-27'),
      paye: false,
    }
    const saisie = await db.venteManuelle.create({
      data: {
        ...base,
        description: 'Panier fictif',
        clientNom: 'ClientSaisiQA',
        numeroPiece: 'REC-PIECE-QA',
      },
    })
    const parFiche = await db.venteManuelle.create({
      data: { ...base, description: 'Caisse fictive', clientId: fiche.id },
    })
    // Rattachement incohérent (fiche d'un autre compte) : ni recherche ni affichage.
    const incoherente = await db.venteManuelle.create({
      data: { ...base, description: 'Vente rattachée ailleurs', clientId: ficheAutre.id },
    })
    const ailleurs = await db.venteManuelle.create({
      data: { ...base, userId: autre.id, description: 'Panier autre', clientNom: 'ClientSaisiQA' },
    })
    const depense = await db.depenseManuelle.create({
      data: {
        userId: identite.id,
        categorie: 'materiel',
        description: 'Petit outillage fictif',
        montant: 25,
        date: new Date('2026-10-27'),
        paye: false,
        fournisseurNom: 'FournisseurQA',
        refFacture: 'FOUR-REF-QA',
        numeroPiece: 'ACH-PIECE-QA',
      },
    })
    const parClient = await chercher('clientsaisiqa')
    expect(trouve(parClient, 'VenteManuelle', saisie.id)).toBe(true)
    expect(trouve(parClient, 'VenteManuelle', ailleurs.id)).toBe(false)
    expect(parClient.find((l) => l.id === saisie.id)?.libelle).toBe(
      'REC-PIECE-QA · Panier fictif · ClientSaisiQA',
    )
    expect(trouve(await chercher('REC-PIECE'), 'VenteManuelle', saisie.id)).toBe(true)
    const parFicheClient = await chercher('FicheClient')
    expect(trouve(parFicheClient, 'VenteManuelle', parFiche.id)).toBe(true)
    expect(parFicheClient.find((l) => l.id === parFiche.id)?.libelle).toBe(
      'Caisse fictive · FicheClientQA',
    )
    expect(trouve(await chercher('FicheAutreQA'), 'VenteManuelle', incoherente.id)).toBe(false)
    expect(
      (await chercher('rattachée ailleurs')).find((l) => l.id === incoherente.id)?.libelle,
    ).toBe('Vente rattachée ailleurs')
    for (const q of ['FOUR-REF-QA', 'fournisseurqa', 'ACH-PIECE', 'outillage'])
      expect(trouve(await chercher(q), 'DepenseManuelle', depense.id), q).toBe(true)
    expect((await chercher('FOUR-REF-QA')).find((l) => l.id === depense.id)?.libelle).toBe(
      'ACH-PIECE-QA · Petit outillage fictif · FournisseurQA · réf. FOUR-REF-QA',
    )
  })
  it('importe sans recette ni doublon, puis rapproche deux factures sur un seul mouvement', async () => {
    const banque = await import('@/app/api/comptabilite/banque/route')
    const c = (
      await json(
        await banque.POST(
          req('/api/comptabilite/banque', {
            action: 'compte',
            nom: 'Compte fictif',
            devise: 'EUR',
          }),
        ),
        201,
      )
    ).data
    // eslint-disable-next-line no-restricted-syntax -- en-têtes d'un relevé bancaire, sans accent
    const csv = 'Date;Libelle;Montant;Reference\n2026-10-27;Virement fictif;100;REF-FICTIVE'
    expect(
      await json(
        await banque.POST(
          req('/api/comptabilite/banque', { action: 'importer', compteId: c.id, csv }),
        ),
      ),
    ).toMatchObject({ importees: 1 })
    expect(
      await json(
        await banque.POST(
          req('/api/comptabilite/banque', { action: 'importer', compteId: c.id, csv }),
        ),
      ),
    ).toMatchObject({ importees: 0, dejaPresentes: 1 })
    expect(await db.venteManuelle.count({ where: { userId: identite.id } })).toBe(0)
    const o = await db.operationBancaire.findFirstOrThrow({ where: { userId: identite.id } }),
      f1 = await facture(30),
      f2 = await facture(70)
    const rapprocher = (id: number, montant: string) =>
      banque.POST(
        req('/api/comptabilite/banque', {
          action: 'rapprocher',
          rapprochement: {
            operationId: o.id,
            partie: 'principal',
            cible: { type: 'Facture', id },
            montant,
            modeReglement: 'Virement',
            cleIdempotence: randomUUID(),
          },
        }),
      )
    await json(await rapprocher(f1.id, '30'))
    await json(await rapprocher(f2.id, '70'))
    const liste = await json(await banque.GET(req('/api/comptabilite/banque')))
    expect(liste.operations[0]).toMatchObject({
      restePrincipal: 0,
      resteFrais: 0,
      montant: 100,
    })
    expect(
      await db.reglement.count({ where: { userId: identite.id, operationBancaireId: o.id } }),
    ).toBe(2)
  })

  it('applique les avoirs et remboursements sans effacer le détail historique', async () => {
    const f = await facture(),
      api = await import('@/app/api/comptabilite/reglements/route')
    await json(await api.POST(req('/api/comptabilite/reglements', entree(f.id, '100'))), 201)
    await db.facture.create({
      data: {
        userId: identite.id,
        numero: 'AV-QA-' + randomUUID(),
        type: 'avoir',
        factureOrigineId: f.id,
        statut: 'emise',
        clientNom: 'Client fictif',
        totalHT: 20,
        totalTVA: 0,
        totalTTC: 20,
      },
    })
    expect(
      await json(await api.GET(req('/api/comptabilite/reglements?type=Facture&id=' + f.id))),
    ).toMatchObject({ montantTotal: 80, tropPercu: 20, resteAPayer: 0 })
    await json(
      await api.POST(
        req('/api/comptabilite/reglements', { ...entree(f.id, '20'), remboursement: true }),
      ),
      201,
    )
    expect(
      await json(await api.GET(req('/api/comptabilite/reglements?type=Facture&id=' + f.id))),
    ).toMatchObject({ montantRegle: 80, tropPercu: 0, resteAPayer: 0 })
    expect(
      (
        await api.POST(
          req('/api/comptabilite/reglements', { ...entree(f.id, '81'), remboursement: true }),
        )
      ).status,
    ).toBe(409)
  })
  it('préserve les versements lors d’une régénération puis d’une facturation de vente élevage', async () => {
    const auto = await import('@/lib/auto-compta'),
      api = await import('@/app/api/comptabilite/reglements/route')
    const v = await db.venteProduit.create({
      data: {
        userId: identite.id,
        type: 'oeufs',
        quantite: 10,
        unite: 'douzaine',
        prixUnitaire: 10,
        prixTotal: 100,
        paye: false,
        date: new Date('2026-10-27'),
      },
    })
    await auto.createVenteFromVenteProduit(identite.id, v)
    const e = { ...entree(v.id, '30'), type: 'VenteProduit' }
    await json(await api.POST(req('/api/comptabilite/reglements', e)), 201)
    await auto.createVenteFromVenteProduit(identite.id, {
      ...v,
      description: 'Libellé corrigé fictif',
    })
    expect(
      await json(
        await api.GET(req('/api/comptabilite/reglements?type=VenteProduit&id=' + v.id)),
      ),
    ).toMatchObject({ montantRegle: 30, resteAPayer: 70 })
    const f = await facture()
    await db.$transaction(async (tx) => {
      await tx.venteProduit.update({ where: { id: v.id }, data: { factureId: f.id } })
      await auto.createVenteFromVenteProduit(identite.id, { ...v, factureId: f.id }, tx)
    })
    expect(await db.venteManuelle.count({ where: { userId: identite.id } })).toBe(0)
    const suivi = await json(
      await api.GET(req('/api/comptabilite/reglements?type=Facture&id=' + f.id)),
    )
    expect(suivi).toMatchObject({ montantRegle: 30, resteAPayer: 70 })
    expect(await db.reglement.count({ where: { userId: identite.id } })).toBe(1)
    const encours = await (
      await import('@/lib/comptabilite/encours')
    ).chargerEncoursCompta(identite.id, null, new Date('2026-12-31T23:59:59Z'))
    expect(encours.creances.total).toBe(70)
  })
  it('retrouve un miroir régénéré pour annuler un règlement et empêche sa suppression', async () => {
    const auto = await import('@/lib/auto-compta'),
      api = await import('@/app/api/comptabilite/reglements/route')
    const miroir = await db.depenseManuelle.create({
      data: {
        userId: identite.id,
        categorie: 'materiel',
        description: 'Achat fictif',
        montant: 100,
        paye: false,
        auto: true,
        sourceType: 'achat_animal',
        sourceId: 990001,
      },
    })
    const r = (
      await json(
        await api.POST(
          req('/api/comptabilite/reglements', {
            ...entree(miroir.id, '30'),
            type: 'DepenseManuelle',
          }),
        ),
        201,
      )
    ).data
    await auto.createDepenseFromLotAnimaux(identite.id, {
      id: 990001,
      prixAchatTotal: 120,
      nom: 'Lot fictif',
    })
    const nouveau = await db.depenseManuelle.findFirstOrThrow({
      where: { userId: identite.id },
    })
    expect(nouveau.id).not.toBe(miroir.id)
    expect(
      await json(
        await api.GET(
          req('/api/comptabilite/reglements?type=DepenseManuelle&id=' + nouveau.id),
        ),
      ),
    ).toMatchObject({ montantRegle: 30, resteAPayer: 90 })
    await expect(auto.deleteAutoEntry('achat_animal', 990001, 'depense')).rejects.toThrow(
      'règlements',
    )
    await json(
      await api.DELETE(
        req(
          '/api/comptabilite/reglements',
          { id: r.id, motif: 'Correction fictive' },
          'DELETE',
        ),
      ),
    )
    expect(
      await json(
        await api.GET(
          req('/api/comptabilite/reglements?type=DepenseManuelle&id=' + nouveau.id),
        ),
      ),
    ).toMatchObject({ montantRegle: 0, resteAPayer: 120 })
  })
  it('refuse le cumul d’un règlement et d’un virement après révision Stripe, même si le drapeau avait été levé', async () => {
    const banque = await import('@/app/api/comptabilite/banque/route')
    const reglementsApi = await import('@/app/api/comptabilite/reglements/route')
    const { chargerFecReglements } = await import('@/lib/comptabilite/banque/fec-reglements')
    const { genererFec } = await import('@/lib/comptabilite/fec')
    const f = await facture(100)
    const connexion = await db.connexionStripe.create({
      data: {
        userId: identite.id,
        compteStripeId: 'acct_qa' + randomUUID(),
        modeTest: false,
        jetonChiffre: 'aucun-acces',
      },
    })
    const compte = await db.compteBancaire.create({
      data: {
        userId: identite.id,
        nom: 'Stripe fictif révisé',
        connexionStripeId: connexion.id,
      },
    })
    const op = await db.operationBancaire.create({
      data: {
        userId: identite.id,
        compteId: compte.id,
        referenceExterne: randomUUID(),
        famille: 'charge',
        date: new Date('2026-10-27'),
        libelle: 'Encaissement fictif révisé',
        montantCentimes: BigInt(10000),
        brutCentimes: BigInt(10000),
      },
    })
    const r = (
      await json(
        await banque.POST(
          req('/api/comptabilite/banque', {
            action: 'rapprocher',
            rapprochement: {
              operationId: op.id,
              partie: 'principal',
              cible: { type: 'Facture', id: f.id },
              montant: '50',
              modeReglement: 'CB',
              cleIdempotence: randomUUID(),
            },
          }),
        ),
      )
    ).data
    await db.operationBancaire.update({
      where: { id: op.id },
      data: { famille: 'payout_failure', aVerifier: true },
    })
    await json(
      await banque.POST(
        req('/api/comptabilite/banque', { action: 'valider-operation', operationId: op.id }),
      ),
      409,
    )
    expect(
      (await db.operationBancaire.findUniqueOrThrow({ where: { id: op.id } })).aVerifier,
    ).toBe(true)
    // Défense de l'export contre une ancienne validation incorrecte.
    await db.operationBancaire.update({ where: { id: op.id }, data: { aVerifier: false } })
    const debut = new Date('2026-01-01'),
      fin = new Date('2026-12-31T23:59:59Z')
    await expect(chargerFecReglements(identite.id, debut, fin)).rejects.toThrow('virement')
    await json(
      await reglementsApi.DELETE(
        req(
          '/api/comptabilite/reglements',
          { id: r.id, motif: 'Rapprochement fictif incorrect' },
          'DELETE',
        ),
      ),
    )
    const journal = await chargerFecReglements(identite.id, debut, fin)
    const fec = genererFec({
      ventes: [],
      depenses: [],
      factures: [],
      ...journal,
      exercice: 2026,
    })
    const banqueNette = fec
      .filter((l) => l.CompteNum === '511500')
      .reduce(
        (n, l) => n + Number(l.Debit.replace(',', '.')) - Number(l.Credit.replace(',', '.')),
        0,
      )
    // Revue du 2026-10-29 : sans encaissement rapproché sur ce compte Stripe,
    // son versement reste hors FEC ; le règlement et son annulation s'annulent.
    expect(journal.mouvementsInternes).toHaveLength(0)
    expect(banqueNette).toBe(0)
    expect(await db.reglement.count({ where: { userId: identite.id } })).toBe(1)
  })
  it('évalue les liaisons d’un virement à la clôture même après une annulation l’année suivante', async () => {
    const banque = await import('@/app/api/comptabilite/banque/route')
    const reglementsApi = await import('@/app/api/comptabilite/reglements/route')
    const { chargerFecReglements } = await import('@/lib/comptabilite/banque/fec-reglements')
    const { genererFec } = await import('@/lib/comptabilite/fec')
    const f = await facture(100)
    await db.facture.update({ where: { id: f.id }, data: { date: new Date('2025-10-27') } })
    const connexion = await db.connexionStripe.create({
      data: {
        userId: identite.id,
        compteStripeId: 'acct_qa' + randomUUID(),
        modeTest: false,
        jetonChiffre: 'aucun-acces',
      },
    })
    const compte = await db.compteBancaire.create({
      data: {
        userId: identite.id,
        nom: 'Stripe fictif clôture',
        connexionStripeId: connexion.id,
      },
    })
    const op = await db.operationBancaire.create({
      data: {
        userId: identite.id,
        compteId: compte.id,
        referenceExterne: randomUUID(),
        famille: 'charge',
        date: new Date('2025-10-27'),
        libelle: 'Encaissement fictif exercice précédent',
        montantCentimes: BigInt(10000),
        brutCentimes: BigInt(10000),
      },
    })
    const r = (
      await json(
        await banque.POST(
          req('/api/comptabilite/banque', {
            action: 'rapprocher',
            rapprochement: {
              operationId: op.id,
              partie: 'principal',
              cible: { type: 'Facture', id: f.id },
              montant: '50',
              modeReglement: 'CB',
              cleIdempotence: randomUUID(),
            },
          }),
        ),
      )
    ).data
    await db.operationBancaire.update({
      where: { id: op.id },
      data: { famille: 'payout_failure', aVerifier: true },
    })
    await json(
      await reglementsApi.DELETE(
        req(
          '/api/comptabilite/reglements',
          { id: r.id, motif: 'Correction fictive exercice suivant' },
          'DELETE',
        ),
      ),
    )
    await json(
      await banque.POST(
        req('/api/comptabilite/banque', { action: 'valider-operation', operationId: op.id }),
      ),
    )
    await expect(
      chargerFecReglements(
        identite.id,
        new Date('2025-01-01'),
        new Date('2025-12-31T23:59:59Z'),
      ),
    ).rejects.toThrow('virement')
    const journal = await chargerFecReglements(
      identite.id,
      new Date('2026-01-01'),
      new Date('2026-12-31T23:59:59Z'),
    )
    const fec = genererFec({
      ventes: [],
      depenses: [],
      factures: [],
      ...journal,
      exercice: 2026,
    })
    expect(journal.mouvementsInternes).toHaveLength(0)
    expect(
      fec
        .filter((l) => l.CompteNum === '511500')
        .reduce(
          (n, l) => n + Number(l.Debit.replace(',', '.')) - Number(l.Credit.replace(',', '.')),
          0,
        ),
    ).toBe(-50)
  })
  it('sépare les virements des ventes et exporte les deux côtés une seule fois au FEC', async () => {
    const banque = await import('@/app/api/comptabilite/banque/route'),
      f = await facture(97)
    const connexion = await db.connexionStripe.create({
      data: {
        userId: identite.id,
        compteStripeId: 'acct_qa' + randomUUID(),
        jetonChiffre: 'aucun-acces',
        modeTest: false,
      },
    })
    const stripe = await db.compteBancaire.create({
      data: { userId: identite.id, nom: 'Stripe fictif', connexionStripeId: connexion.id },
    })
    const bancaire = await db.compteBancaire.create({
      data: { userId: identite.id, nom: 'Banque fictive' },
    })
    const sortie = await db.operationBancaire.create({
      data: {
        userId: identite.id,
        compteId: stripe.id,
        referenceExterne: 'txn_qa',
        libelle: 'Virement fictif',
        date: new Date('2026-10-27'),
        montantCentimes: BigInt(-9700),
        brutCentimes: BigInt(-9700),
        famille: 'payout',
      },
    })
    const entree = await db.operationBancaire.create({
      data: {
        userId: identite.id,
        compteId: bancaire.id,
        referenceExterne: 'bank_qa',
        libelle: 'Virement fictif',
        date: new Date('2026-10-27'),
        montantCentimes: BigInt(9700),
        brutCentimes: BigInt(9700),
      },
    })
    const d = { action: 'virement', sortieId: sortie.id, entreeId: entree.id }
    const a = await json(await banque.POST(req('/api/comptabilite/banque', d))),
      b = await json(await banque.POST(req('/api/comptabilite/banque', d)))
    expect(a.data.id).toBe(b.data.id)
    expect(
      (
        await banque.POST(
          req('/api/comptabilite/banque', {
            action: 'rapprocher',
            rapprochement: {
              operationId: entree.id,
              cible: { type: 'Facture', id: f.id },
              montant: '97',
              modeReglement: 'Virement',
              cleIdempotence: randomUUID(),
            },
          }),
        )
      ).status,
    ).toBe(409)
    expect(await db.reglement.count({ where: { userId: identite.id } })).toBe(0)
    // Revue du 2026-10-29 : le versement n'entre au FEC que si les encaissements
    // de ce compte Stripe passent eux-mêmes par 511500.
    const encaissement = await db.operationBancaire.create({
      data: {
        userId: identite.id,
        compteId: stripe.id,
        referenceExterne: 'txn_qa_encaissement',
        libelle: 'Encaissement fictif',
        date: new Date('2026-10-26'),
        montantCentimes: BigInt(9700),
        brutCentimes: BigInt(9700),
        famille: 'charge',
      },
    })
    const chargerFec = (
      await import('@/lib/comptabilite/banque/fec-reglements')
    ).chargerFecReglements
    expect(
      (await chargerFec(identite.id, new Date('2026-01-01'), new Date('2026-12-31')))
        .mouvementsInternes,
    ).toHaveLength(0)
    await json(
      await banque.POST(
        req('/api/comptabilite/banque', {
          action: 'rapprocher',
          rapprochement: {
            operationId: encaissement.id,
            cible: { type: 'Facture', id: f.id },
            montant: '97',
            modeReglement: 'CB',
            cleIdempotence: randomUUID(),
          },
        }),
      ),
    )
    const fec = await chargerFec(identite.id, new Date('2026-01-01'), new Date('2026-12-31'))
    expect(fec.mouvementsInternes).toHaveLength(2)
    expect(fec.mouvementsInternes.map((m) => m.compteTresorerie.num).sort()).toEqual([
      '511500',
      '512000',
    ])
  })
  it('rapproche le brut et les frais Stripe séparément avec une trésorerie nette correcte', async () => {
    const banque = await import('@/app/api/comptabilite/banque/route'),
      f = await facture()
    const connexion = await db.connexionStripe.create({
      data: {
        userId: identite.id,
        compteStripeId: 'acct_frais' + identite.id,
        jetonChiffre: 'acces-fictif',
        modeTest: false,
      },
    })
    const compte = await db.compteBancaire.create({
      data: {
        userId: identite.id,
        nom: 'Stripe frais fictif',
        connexionStripeId: connexion.id,
      },
    })
    const op = await db.operationBancaire.create({
      data: {
        userId: identite.id,
        compteId: compte.id,
        referenceExterne: 'txn_frais_qa',
        date: new Date('2026-10-27'),
        libelle: 'Encaissement fictif',
        montantCentimes: BigInt(9700),
        brutCentimes: BigInt(10000),
        fraisCentimes: BigInt(300),
        famille: 'charge',
      },
    })
    const depense = await db.depenseManuelle.create({
      data: {
        userId: identite.id,
        description: 'Frais Stripe fictifs',
        categorie: 'autre',
        montant: 3,
        montantHT: 3,
        montantTVA: 0,
        tauxTVA: 0,
        paye: false,
        date: new Date('2026-10-27'),
      },
    })
    const allouer = (partie: string, type: string, id: number, montant: string) =>
      banque.POST(
        req('/api/comptabilite/banque', {
          action: 'rapprocher',
          rapprochement: {
            operationId: op.id,
            partie,
            cible: { type, id },
            montant,
            modeReglement: 'CB',
            cleIdempotence: randomUUID(),
          },
        }),
      )
    await json(await allouer('principal', 'Facture', f.id, '100'))
    expect((await allouer('frais', 'DepenseManuelle', depense.id, '3.01')).status).toBe(409)
    await json(await allouer('frais', 'DepenseManuelle', depense.id, '3'))
    const liste = await json(await banque.GET(req('/api/comptabilite/banque')))
    expect(liste.operations[0]).toMatchObject({
      montant: 97,
      brut: 100,
      frais: 3,
      restePrincipal: 0,
      resteFrais: 0,
    })
    const journal = await (
      await import('@/lib/comptabilite/banque/fec-reglements')
    ).chargerFecReglements(identite.id, new Date('2026-01-01'), new Date('2026-12-31'))
    expect(
      journal.reglements.reduce(
        (n, r) => n + (r.sens === 'encaissement' ? r.montant : -r.montant),
        0,
      ),
    ).toBe(97)
    expect(journal.reglements.every((r) => r.compteTresorerie?.num === '511500')).toBe(true)
  })
  it('refuse les mutations en lecture seule et la connexion par un membre', async () => {
    const api = await import('@/app/api/comptabilite/reglements/route'),
      banque = await import('@/app/api/comptabilite/banque/route'),
      f = await facture()
    identite.lectureSeule = true
    expect(
      (await api.POST(req('/api/comptabilite/reglements', entree(f.id, '30')))).status,
    ).toBe(403)
    expect(
      (
        await banque.POST(
          req('/api/comptabilite/banque', { action: 'compte', nom: 'Refusé', devise: 'EUR' }),
        )
      ).status,
    ).toBe(403)
    identite.lectureSeule = false
    identite.proprietaire = false
    expect(
      (
        await banque.POST(
          req('/api/comptabilite/banque', {
            action: 'stripe-cle',
            cle: 'rk_test_cle_strictement_fictive',
          }),
        )
      ).status,
    ).toBe(403)
  })
  it('refuse toute connexion Stripe et tout import bancaire sur la démonstration partagée', async () => {
    await db.user.update({ where: { id: identite.id }, data: { email: 'demo@gleba.fr' } })
    const banque = await import('@/app/api/comptabilite/banque/route'),
      oauth = await import('@/app/api/comptabilite/banque/stripe/route')
    const sortant = vi.fn()
    vi.stubGlobal('fetch', sortant)
    const c = await db.compteBancaire.create({
      data: { userId: identite.id, nom: 'Compte fictif de démonstration' },
    })
    expect(
      (
        await banque.POST(
          req('/api/comptabilite/banque', {
            action: 'stripe-cle',
            cle: 'rk_test_entierement_fictive',
          }),
        )
      ).status,
    ).toBe(403)
    expect((await oauth.POST()).status).toBe(403)
    expect(
      (
        await banque.POST(
          req('/api/comptabilite/banque', {
            action: 'importer',
            compteId: c.id,
            csv: 'Date;Libellé;Montant\n27/10/2026;Fictif;10',
          }),
        )
      ).status,
    ).toBe(403)
    expect((await json(await banque.GET(req('/api/comptabilite/banque')))).peutConnecter).toBe(
      false,
    )
    expect(sortant).not.toHaveBeenCalled()
  })
  it('importe un historique Stripe paginé et le rattrapage de plus de 500 nouveaux mouvements sans perte ni doublon', async () => {
    process.env.STRIPE_TOKEN_ENCRYPTION_KEY =
      'cle-de-test-synthetique-longue-au-moins-32-caracteres'
    const banque = await import('@/app/api/comptabilite/banque/route')
    const transaction = (n: number) => ({
      id: 'txn_qa' + n,
      amount: 1000,
      fee: 30,
      net: 970,
      currency: 'eur',
      created: 1793102400 + n,
      description: 'Opération fictive ' + n,
      type: 'charge',
      status: 'available',
    })
    let historique = Array.from({ length: 501 }, (_, i) => transaction(501 - i))
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const u = new URL(url)
        expect(u.origin).toBe('https://api.stripe.com')
        if (u.pathname === '/v1/account')
          return Response.json({ id: 'acct_qa' + identite.id.replace(/[^a-z0-9]/gi, '') })
        if (u.pathname === '/v1/balance')
          return Response.json({
            available: [{ currency: 'eur', amount: 10000 }],
            pending: [],
          })
        if (u.pathname !== '/v1/balance_transactions')
          throw new Error('Chemin Stripe inattendu')
        const apres = u.searchParams.get('starting_after'),
          debut = apres ? historique.findIndex((t) => t.id === apres) + 1 : 0
        const limite = Number(u.searchParams.get('limit'))
        return Response.json({
          data: historique.slice(debut, debut + limite),
          has_more: historique.length > debut + limite,
        })
      }),
    )
    const connectee = await json(
      await banque.POST(
        req('/api/comptabilite/banque', {
          action: 'stripe-cle',
          cle: 'rk_test_cle_strictement_fictive',
        }),
      ),
    )
    const sync = () =>
      banque.POST(
        req('/api/comptabilite/banque', {
          action: 'synchroniser',
          connexionId: connectee.data.id,
        }),
      )
    expect(await json(await sync())).toMatchObject({
      importees: 500,
      historiqueComplet: false,
    })
    expect(await json(await sync())).toMatchObject({ importees: 1, historiqueComplet: true })
    historique = [
      ...Array.from({ length: 501 }, (_, i) => transaction(1002 - i)),
      ...historique,
    ]
    await json(await sync())
    await json(await sync())
    await json(await sync())
    expect(await db.operationBancaire.count({ where: { userId: identite.id } })).toBe(1002)
    expect(await db.venteManuelle.count({ where: { userId: identite.id } })).toBe(0)
    const publicData = await json(await banque.GET(req('/api/comptabilite/banque')))
    expect(JSON.stringify(publicData)).not.toMatch(/jetonChiffre|rk_test_|cle_strictement/)
    const op = await db.operationBancaire.findFirstOrThrow({ where: { userId: identite.id } }),
      f = await facture(10)
    expect(
      (
        await banque.POST(
          req('/api/comptabilite/banque', {
            action: 'rapprocher',
            rapprochement: {
              operationId: op.id,
              cible: { type: 'Facture', id: f.id },
              montant: '10',
              modeReglement: 'CB',
              cleIdempotence: randomUUID(),
            },
          }),
        )
      ).status,
    ).toBe(409)
  }, 75000)
  it('aligne les impayés, le bilan et les KPI sans modifier le chiffre d’affaires', async () => {
    const f = await facture(120),
      api = await import('@/app/api/comptabilite/reglements/route')
    await json(await api.POST(req('/api/comptabilite/reglements', entree(f.id, '40'))), 201)
    const d = await db.depenseManuelle.create({
      data: {
        userId: identite.id,
        description: 'Facture fournisseur fictive',
        categorie: 'autre',
        montant: 60,
        paye: false,
        date: new Date('2026-10-27'),
      },
    })
    await json(
      await api.POST(
        req('/api/comptabilite/reglements', {
          ...entree(d.id, '15'),
          type: 'DepenseManuelle',
        }),
      ),
      201,
    )
    const kpi = await (
      await import('@/lib/kpi/compta')
    ).getKpiCompta(identite.id, 2026, new Date('2026-12-31T12:00:00Z'))
    expect(kpi.revenusYtd).toBe(120)
    expect(kpi.revenusNonPayesYtd).toBe(80)
    const bilan = await import('@/app/api/comptabilite/bilan/route')
    const b = await json(await bilan.GET(req('/api/comptabilite/bilan?year=2026')))
    expect(b.actif.creances).toBe(80)
    expect(b.passif.dettesFournisseurs).toBe(45)
    const factures = await import('@/app/api/comptabilite/factures/route')
    const r = await json(await factures.GET(req('/api/comptabilite/factures?year=2026')))
    expect(r.data.find((l: { id: number }) => l.id === f.id)).toMatchObject({
      montantRegle: 40,
    })
  })
  it('lie le retour OAuth à l’acteur et consomme son état une seule fois', async () => {
    process.env.STRIPE_CONNECT_CLIENT_ID = 'ca_qa1234'
    process.env.STRIPE_SECRET_KEY = 'sk_test_entierement_fictive'
    process.env.STRIPE_TOKEN_ENCRYPTION_KEY = 'chiffrement-pour-test-oauth-entierement-fictif'
    const oauth = await import('@/lib/comptabilite/banque/stripe-oauth')
    const debut = await oauth.preparerConnexionStripe(identite.id, identite.id),
      etat = new URL(debut.url).searchParams.get('state')!
    const reponses = vi.fn(async (url: string) => {
      if (url === 'https://connect.stripe.com/oauth/token')
        return Response.json({
          access_token: 'jeton_fictif_oauth',
          livemode: false,
          stripe_user_id: 'acct_qaOAuth',
        })
      if (url === 'https://api.stripe.com/v1/account')
        return Response.json({ id: 'acct_qaOAuth' })
      if (url === 'https://api.stripe.com/v1/balance')
        return Response.json({ available: [], pending: [] })
      return Response.json({ data: [], has_more: false })
    })
    vi.stubGlobal('fetch', reponses)
    await expect(
      oauth.terminerConnexionStripe(identite.id, 'autre-acteur', etat, 'ac_code_fictif'),
    ).rejects.toThrow('expiré')
    expect(reponses).not.toHaveBeenCalled()
    await oauth.terminerConnexionStripe(identite.id, identite.id, etat, 'ac_code_fictif')
    await expect(
      oauth.terminerConnexionStripe(identite.id, identite.id, etat, 'ac_code_fictif'),
    ).rejects.toThrow('expiré')
    expect(await db.connexionStripe.count({ where: { userId: identite.id } })).toBe(1)
  })
  it('exporte le journal sans accès Stripe et le réimporte avec les pièces remappées', async () => {
    const api = await import('@/app/api/comptabilite/reglements/route'),
      f = await facture()
    await json(await api.POST(req('/api/comptabilite/reglements', entree(f.id, '30'))), 201)
    await db.connexionStripe.create({
      data: {
        userId: identite.id,
        compteStripeId: 'acct_fictif_export',
        jetonChiffre: 'SECRET_FICTIF_A_NE_PAS_EXPORTER',
        modeTest: true,
      },
    })
    const auto = await import('@/lib/auto-compta')
    for (let n = 0; n < 2; n++) {
      const vente = await db.venteProduit.create({
        data: {
          userId: identite.id,
          type: 'oeufs',
          quantite: 10,
          unite: 'douzaine',
          prixUnitaire: 10,
          prixTotal: 100,
          paye: false,
          date: new Date('2026-10-27'),
        },
      })
      await auto.createVenteFromVenteProduit(identite.id, vente)
      await json(
        await api.POST(
          req('/api/comptabilite/reglements', {
            ...entree(vente.id, '20'),
            type: 'VenteProduit',
          }),
        ),
        201,
      )
    }
    const transfert = await import('@/lib/account-transfer'),
      exporte = await transfert.exportAccount(identite.id)
    const brut = JSON.stringify(exporte)
    expect(brut).not.toContain('SECRET_FICTIF')
    expect(exporte.data.ConnexionStripe[0]).toMatchObject({ actif: false, jetonChiffre: '' })
    await db.user.delete({ where: { id: identite.id } })
    const cible = await db.user.create({
      data: { email: 'reimport-' + randomUUID() + '@example.test' },
    })
    comptes.push(cible.id)
    identite.id = cible.id
    const bilan = await transfert.importAccount(cible.id, JSON.parse(brut))
    expect(bilan.skipped.Reglement ?? 0, JSON.stringify(bilan.warnings)).toBe(0)
    const factureReimportee = await db.facture.findFirstOrThrow({
      where: { userId: cible.id },
    })
    expect(factureReimportee.id).not.toBe(f.id)
    expect(
      await json(
        await api.GET(
          req('/api/comptabilite/reglements?type=Facture&id=' + factureReimportee.id),
        ),
      ),
    ).toMatchObject({ montantRegle: 30, resteAPayer: 70 })
    const ventesReimportees = await db.venteProduit.findMany({ where: { userId: cible.id } })
    expect(ventesReimportees).toHaveLength(2)
    for (const vente of ventesReimportees) {
      expect(
        await json(
          await api.GET(req('/api/comptabilite/reglements?type=VenteProduit&id=' + vente.id)),
        ),
      ).toMatchObject({ montantRegle: 20, resteAPayer: 80 })
      expect(
        await db.venteManuelle.count({
          where: { userId: cible.id, sourceType: 'vente_produit', sourceId: vente.id },
        }),
      ).toBe(1)
    }
  }, 20000)
  // Revue du 2026-10-30 : unicité par exploitation et une seule connexion
  // ACTIVE par compte Stripe sur l'instance (index partiel SQL).
  it('n’accepte qu’une connexion Stripe active par compte sur l’instance, sans bloquer après déconnexion', async () => {
    process.env.STRIPE_TOKEN_ENCRYPTION_KEY =
      'cle-de-test-synthetique-longue-au-moins-32-caracteres'
    process.env.STRIPE_CONNECT_CLIENT_ID = 'ca_qa1234'
    process.env.STRIPE_SECRET_KEY = 'sk_test_entierement_fictive'
    const banque = await import('@/app/api/comptabilite/banque/route'),
      transfert = await import('@/lib/account-transfer')
    const compteStripe = 'acct_qaPartage' + randomUUID().replace(/-/g, '')
    const sortant = vi.fn(async (url: string) => {
      const u = new URL(url)
      if (u.origin !== 'https://api.stripe.com') return Response.json({}, { status: 500 })
      if (u.pathname === '/v1/account') return Response.json({ id: compteStripe })
      if (u.pathname === '/v1/balance') return Response.json({ available: [], pending: [] })
      return Response.json({ data: [], has_more: false })
    })
    vi.stubGlobal('fetch', sortant)
    const connecter = () =>
      banque.POST(
        req('/api/comptabilite/banque', {
          action: 'stripe-cle',
          cle: 'rk_test_cle_strictement_fictive',
        }),
      )
    const deconnecter = (connexionId: string) =>
      banque.POST(req('/api/comptabilite/banque', { action: 'deconnecter', connexionId }))
    const nouvelleExploitation = async () => {
      const u = await db.user.create({
        data: { email: 'banque-' + randomUUID() + '@example.test', emailVerified: true },
      })
      comptes.push(u.id)
      return u.id
    }
    const a = identite.id,
      b = await nouvelleExploitation()

    // A active puis B : refus explicite.
    const cxA = (await json(await connecter())).data.id
    identite.id = b
    expect((await json(await connecter(), 409)).error).toMatch(
      /déjà connecté à une autre exploitation/,
    )
    expect(await db.connexionStripe.count({ where: { userId: b } })).toBe(0)

    // A déconnectée puis B : accepté, la ligne inactive de A reste.
    identite.id = a
    await json(await deconnecter(cxA))
    identite.id = b
    const cxB = (await json(await connecter())).data.id
    expect(cxB).not.toBe(cxA)
    const lignes = await db.connexionStripe.findMany({
      where: { compteStripeId: compteStripe },
      select: { userId: true, actif: true },
    })
    expect(lignes).toHaveLength(2)
    expect(lignes).toEqual(
      expect.arrayContaining([
        { userId: a, actif: false },
        { userId: b, actif: true },
      ]),
    )

    // A ne peut plus réactiver sa ligne tant que B est active…
    identite.id = a
    expect((await json(await connecter(), 409)).error).toMatch(
      /déjà connecté à une autre exploitation/,
    )
    // … même hors de l'application : l'index partiel SQL tient.
    await expect(
      db.connexionStripe.update({ where: { id: cxA }, data: { actif: true } }),
    ).rejects.toMatchObject({ code: 'P2002' })
    // Re-déconnecter la ligne inactive de A ne révoque pas l'autorisation
    // Stripe dont B se sert.
    await json(await deconnecter(cxA))
    expect(
      sortant.mock.calls.some(([url]) => String(url).startsWith('https://connect.stripe.com')),
    ).toBe(false)
    expect(
      await db.connexionStripe.findUniqueOrThrow({ where: { id: cxB }, select: { actif: true } }),
    ).toEqual({ actif: true })

    // Import sur la même instance, source encore présente : la connexion
    // arrive inactive, sans jeton, sous un nouvel id, sans conflit.
    const c = await nouvelleExploitation()
    const bilan = await transfert.importAccount(
      c,
      JSON.parse(JSON.stringify(await transfert.exportAccount(b))),
    )
    expect(bilan.imported.ConnexionStripe, JSON.stringify(bilan.warnings)).toBe(1)
    const importee = await db.connexionStripe.findFirstOrThrow({ where: { userId: c } })
    expect(importee).toMatchObject({ compteStripeId: compteStripe, actif: false, jetonChiffre: '' })
    expect(importee.id).not.toBe(cxB)
  }, 20000)

  it('conserve chaque import de relevé avec ses octets d’origine, le rejoue pour l’admin et le purge après 30 jours', async () => {
    const banque = await import('@/app/api/comptabilite/banque/route')
    const admin = await import('@/app/api/admin/imports-releve/route')
    const fichierAdmin = await import('@/app/api/admin/imports-releve/[id]/fichier/route')
    const { purgerTentativesImport } = await import('@/lib/comptabilite/banque/tentatives')
    const c = (
      await json(
        (await banque.POST(req('/api/comptabilite/banque', { action: 'compte', nom: 'Compte fictif', devise: 'EUR' })))!,
        201,
      )
    ).data
    // Export fictif en Windows-1252, une ligne d'information avant l'en-tête.
    const lisible = Buffer.from(
      'Téléchargement du 01/11/2026;\n\nDate;Libellé;Débit euros;Crédit euros;\n02/10/2026;"PAIEMENT CARTE\nCOOP FICTIVE";45,60;;\n',
      'latin1',
    )
    const illisible = Buffer.from('Date;Opération\n02/10/2026;A\n', 'latin1')
    const importer = async (octets: Buffer, nomFichier?: string) =>
      (await banque.POST(
        req('/api/comptabilite/banque', { action: 'importer', compteId: c.id, fichier: octets.toString('base64'), nomFichier }),
      ))!
    expect(await json(await importer(lisible, 'releve-ca.csv'))).toMatchObject({ importees: 1, dejaPresentes: 0 })
    expect((await json(await importer(illisible), 400)).error).toContain('Colonnes requises')
    const traces = await db.tentativeImportReleve.findMany({ where: { userId: identite.id } })
    const reussie = traces.find((t) => t.statut === 'importe')!,
      refusee = traces.find((t) => t.statut === 'refuse')!
    expect(traces).toHaveLength(2)
    expect(reussie).toMatchObject({ compteId: c.id, nomFichier: 'releve-ca.csv', source: 'fichier', importees: 1, dejaPresentes: 0 })
    expect(Buffer.from(reussie.contenu!).equals(lisible)).toBe(true)
    expect(Buffer.from(refusee.contenu!).equals(illisible)).toBe(true)
    expect(refusee.message).toContain('Colonnes requises')

    // Réservé à l'administrateur : liste sans contenu, rejeu sans écriture, fichier brut.
    expect((await admin.GET(req('/api/admin/imports-releve'))).status).toBe(403)
    identite.admin = true
    const liste = (await json(await admin.GET(req('/api/admin/imports-releve?statut=refuse')))).data
    expect(liste.map((t: { id: string }) => t.id)).toContain(refusee.id)
    expect(liste.every((t: { statut: string; contenu?: unknown; fichierConserve: boolean }) => t.statut === 'refuse' && t.contenu === undefined)).toBe(true)
    const operationsAvant = await db.operationBancaire.count({ where: { userId: identite.id } })
    const rejeu = (await json(await admin.POST(req('/api/admin/imports-releve', { ids: [reussie.id, refusee.id] })))).data
    expect(rejeu).toEqual([
      { id: reussie.id, statutInitial: 'importe', lisible: true, operations: 1, du: '2026-10-02', au: '2026-10-02', netCentimes: -4560 },
      { id: refusee.id, statutInitial: 'refuse', lisible: false, message: expect.stringContaining('Colonnes requises') },
    ])
    expect(await db.operationBancaire.count({ where: { userId: identite.id } })).toBe(operationsAvant)
    const brut = await fichierAdmin.GET(req('/api/admin/imports-releve/' + reussie.id + '/fichier'), {
      params: Promise.resolve({ id: reussie.id }),
    })
    expect(brut.status).toBe(200)
    expect(brut.headers.get('content-type')).toBe('application/octet-stream')
    expect(Buffer.from(await brut.arrayBuffer()).equals(lisible)).toBe(true)

    // Purge après 30 jours, et effacement avec le compte.
    await db.tentativeImportReleve.update({
      where: { id: refusee.id },
      data: { createdAt: new Date(Date.now() - 31 * 86_400_000) },
    })
    await purgerTentativesImport()
    expect((await db.tentativeImportReleve.findMany({ where: { userId: identite.id } })).map((t) => t.id)).toEqual([reussie.id])
    const autre = await db.user.create({ data: { email: 'banque-' + randomUUID() + '@example.test', emailVerified: true } })
    await db.tentativeImportReleve.create({
      data: { userId: autre.id, compteId: 'x', tailleOctets: 1, empreinte: 'x', source: 'texte', statut: 'refuse', contenu: Buffer.from('x') },
    })
    await db.user.delete({ where: { id: autre.id } })
    expect(await db.tentativeImportReleve.count({ where: { userId: autre.id } })).toBe(0)
  })
})
