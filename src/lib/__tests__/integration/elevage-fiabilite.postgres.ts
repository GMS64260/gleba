/** PostgreSQL jetable exclusivement. Seule l'authentification est simulée. */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { NextRequest } from 'next/server'

const auth = vi.hoisted(() => ({ tenant: '' }))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: async () => ({ session: { user: { id: auth.tenant } }, error: null }) }))
const qaUrl = process.env.GLEBA_ELEVAGE_QA_DATABASE_URL
const active = Boolean(qaUrl && /^\/gleba_reglements_qa_elevage_20261028_[0-9a-f]{6}$/.test(new URL(qaUrl).pathname))
let db: PrismaClient
let ventes: typeof import('@/app/api/elevage/ventes/route')
let abattages: typeof import('@/app/api/elevage/abattages/route')
let collectes: typeof import('@/app/api/elevage/collectes-lait/route')
let fromages: typeof import('@/app/api/elevage/lots-fromage/route')
let especeId: string, lotId: number
const req = (path: string, method: string, body?: object) => new NextRequest('http://local.test' + path, {
  method, ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
})
async function json(response: Response, statut: number) {
  const body = await response.json()
  expect(response.status, JSON.stringify(body)).toBe(statut)
  return body
}
const postAbattage = (body: object) => abattages.POST(req('/api/elevage/abattages', 'POST', body))
const patchAbattage = (body: object) => abattages.PATCH(req('/api/elevage/abattages', 'PATCH', body))
async function animal(dansLot = false) {
  return db.animal.create({ data: { userId: auth.tenant, especeAnimaleId: especeId, sexe: 'femelle', statut: 'actif', ...(dansLot ? { lotId } : {}) } })
}
async function vendreOeufs() {
  await db.productionOeuf.create({ data: { userId: auth.tenant, date: new Date('2026-10-27'), quantite: 12 } })
  return (await json(await ventes.POST(req('/api/elevage/ventes', 'POST', { date: '2026-10-28', type: 'oeufs', quantite: 12, unite: 'unite', prixUnitaire: 1, paye: false })), 201)).data
}

describe.skipIf(!active)('Fiabilité élevage sur PostgreSQL', () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL !== qaUrl) throw new Error('URL QA unique obligatoire')
    db = (await import('@/lib/prisma')).default
    ventes = await import('@/app/api/elevage/ventes/route')
    abattages = await import('@/app/api/elevage/abattages/route')
    collectes = await import('@/app/api/elevage/collectes-lait/route')
    fromages = await import('@/app/api/elevage/lots-fromage/route')
  })
  beforeEach(async () => {
    const user = await db.user.create({ data: { email: `elevage-${randomUUID()}@example.invalid`, emailVerified: true } })
    auth.tenant = user.id
    await db.exploitation.create({ data: { userId: user.id, raisonSociale: 'Ferme synthétique QA', formeJuridique: 'EI', regimeFiscal: 'micro-BA', regimeTva: 'reel-normal', adresseSiege: '1 voie QA', codePostal: '64000', ville: 'Commune QA', emailContact: 'qa@example.invalid' } })
    const espece = await db.especeAnimale.create({ data: { id: 'chevre_qa_' + randomUUID(), userId: user.id, nom: 'Chèvre QA', type: 'Mammifère', production: 'mixte' } })
    especeId = espece.id
    const lot = await db.lotAnimaux.create({ data: { userId: user.id, especeAnimaleId: espece.id, quantiteInitiale: 6, quantiteActuelle: 6, nom: 'Lot QA' } })
    lotId = lot.id
  })
  afterAll(async () => { if (db) await db.$disconnect() })

  it('une seule vente et une seule recette pour deux ventes concurrentes du même animal', async () => {
    const a = await animal()
    const body = { date: '2026-10-28', type: 'animal_vivant', animalId: a.id, quantite: 1, unite: 'unite', prixUnitaire: 100, paye: false, client: 'Client QA', validationVente: true }
    const reponses = await Promise.all([ventes.POST(req('/api/elevage/ventes', 'POST', body)), ventes.POST(req('/api/elevage/ventes', 'POST', body))])
    expect(reponses.map((r) => r.status).sort()).toEqual([201, 409])
    expect(await db.venteProduit.count({ where: { userId: auth.tenant, animalId: a.id } })).toBe(1)
    expect(await db.venteManuelle.count({ where: { userId: auth.tenant, sourceType: 'vente_produit' } })).toBe(1)
    expect((await db.animal.findUniqueOrThrow({ where: { id: a.id } })).statut).toBe('vendu')
  })

  // Décision du 2026-10-30 : une vente démarre payée ; décochée, elle part à crédit.
  it('une vente sans statut explicite est présumée payée en banque ; « À crédit » reste à encaisser', async () => {
    await db.exploitation.update({ where: { userId: auth.tenant }, data: { siren: '123456789' } })
    const vendre = async (modeReglement: string) => (await json(await ventes.POST(req('/api/elevage/ventes', 'POST', {
      date: '2026-10-28', type: 'animal_vivant', animalId: (await animal()).id, quantite: 1,
      unite: 'unite', prixUnitaire: 100, client: 'Client QA', modeReglement,
    })), 201)).data
    const payee = await vendre('Virement')
    expect(payee.paye).toBe(true)
    const miroir = await db.venteManuelle.findFirstOrThrow({ where: { userId: auth.tenant, sourceType: 'vente_produit', sourceId: payee.id } })
    expect(miroir).toMatchObject({ paye: true, modeReglement: 'Virement' })
    const { chargerEncoursCompta } = await import('@/lib/comptabilite/encours')
    expect((await chargerEncoursCompta(auth.tenant, null, new Date('2026-12-31T23:59:59Z'))).creances.total).toBe(0)
    const fec = await import('@/app/api/comptabilite/export/fec/route')
    const res = await fec.GET(req('/api/comptabilite/export/fec?exercice=2026', 'GET'))
    expect(res.status).toBe(200)
    const lignes = (await res.text()).trim().split('\n').map((l) => l.split('\t'))
    const idx = (n: string) => lignes[0].indexOf(n)
    const net = (prefixe: string) => lignes.slice(1).filter((l) => l[idx('CompteNum')].startsWith(prefixe))
      .reduce((n, l) => n + Number(l[idx('Debit')].replace(',', '.')) - Number(l[idx('Credit')].replace(',', '.')), 0)
    expect(net('512')).toBeCloseTo(100, 2)
    expect(net('411')).toBeCloseTo(0, 2)
    const aCredit = await vendre('À crédit')
    expect(aCredit.paye).toBe(false)
    expect((await chargerEncoursCompta(auth.tenant, null, new Date('2026-12-31T23:59:59Z'))).creances.total).toBe(100)
    expect(await db.reglement.count({ where: { userId: auth.tenant } })).toBe(0)
  })

  it('une vente décochée (à crédit) reste en créance jusqu’aux versements 30/70', async () => {
    const a = await animal()
    const v = (await json(await ventes.POST(req('/api/elevage/ventes', 'POST', {
      date: '2026-10-28', type: 'animal_vivant', animalId: a.id, quantite: 1,
      unite: 'unite', prixUnitaire: 100, client: 'Client QA', paye: false, modeReglement: 'Virement',
    })), 201)).data
    expect(v.paye).toBe(false)
    await db.exploitation.update({ where: { userId: auth.tenant }, data: { siren: '123456789' } })
    const reglements = await import('@/app/api/comptabilite/reglements/route')
    const revenus = await import('@/app/api/comptabilite/revenus/route')
    const fec = await import('@/app/api/comptabilite/export/fec/route')
    const { chargerEncoursCompta } = await import('@/lib/comptabilite/encours')
    for (const regle of [0, 30, 100]) {
      if (regle) await json(await reglements.POST(req('/api/comptabilite/reglements', 'POST', {
        type: 'VenteProduit', id: v.id, montant: String(regle === 30 ? 30 : 70),
        date: '2026-10-28', modeReglement: 'Virement', cleIdempotence: randomUUID(),
      })), 201)
      const liste = await json(await revenus.GET(req('/api/comptabilite/revenus?annee=2026', 'GET')), 200)
      const ligne = liste.data.find((r: { source: string }) => r.source === 'VenteProduit')
      expect(ligne.paye).toBe(regle === 100)
      expect(ligne.ecriture.suivi.modeReglement).toBe('Virement')
      expect((await chargerEncoursCompta(auth.tenant, null, new Date('2026-12-31T23:59:59Z'))).creances.total).toBe(100 - regle)
      expect((await db.venteProduit.findUniqueOrThrow({ where: { id: v.id } })).paye).toBe(regle === 100)
      const res = await fec.GET(req('/api/comptabilite/export/fec?exercice=2026', 'GET'))
      expect(res.status).toBe(200)
      const lignes = (await res.text()).trim().split('\n').map((l) => l.split('\t'))
      const idx = (n: string) => lignes[0].indexOf(n)
      const net = (prefixe: string) => lignes.slice(1).filter((l) => l[idx('CompteNum')].startsWith(prefixe))
        .reduce((n, l) => n + Number(l[idx('Debit')].replace(',', '.')) - Number(l[idx('Credit')].replace(',', '.')), 0)
      expect(net('411')).toBeCloseTo(100 - regle, 2)
      expect(net('512')).toBeCloseTo(regle, 2)
    }
    expect(await db.venteProduit.count({ where: { userId: auth.tenant } })).toBe(1)
    expect(await db.venteManuelle.count({ where: { userId: auth.tenant, sourceType: 'vente_produit' } })).toBe(1)
    expect(await db.reglement.count({ where: { userId: auth.tenant } })).toBe(2)
    expect((await db.animal.findUniqueOrThrow({ where: { id: a.id } })).statut).toBe('vendu')
  })

  // Migration 20261030150000_ventes_payees_par_defaut.
  it('le défaut SQL présume la vente payée et les impayés explicites sont conservés', async () => {
    const colonnes = await db.$queryRaw<Array<{ column_default: string }>>`
      SELECT column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'ventes_produits' AND column_name = 'paye'`
    expect(colonnes[0].column_default).toBe('true')
    const data = { userId: auth.tenant, type: 'autre', quantite: 1, unite: 'unite', prixUnitaire: 100, prixTotal: 100 }
    expect((await db.venteProduit.create({ data })).paye).toBe(true)
    const impayee = await db.venteProduit.create({ data: { ...data, paye: false } })
    await (await import('@/lib/auto-compta')).createVenteFromVenteProduit(auth.tenant, impayee)
    expect((await db.venteManuelle.findFirstOrThrow({ where: { userId: auth.tenant, sourceType: 'vente_produit', sourceId: impayee.id } })).paye).toBe(false)
    expect(await db.reglement.count({ where: { userId: auth.tenant } })).toBe(0)
  })

  it('les abattages concurrents respectent l’effectif et deux annulations ne le rendent qu’une fois', async () => {
    const body = { lotId, date: '2026-10-28', quantite: 4, destination: 'auto_consommation' }
    const reponses = await Promise.all([postAbattage(body), postAbattage(body)])
    expect(reponses.map((r) => r.status).sort()).toEqual([201, 422])
    expect((await db.lotAnimaux.findUniqueOrThrow({ where: { id: lotId } })).quantiteActuelle).toBe(2)
    const a = await db.abattage.findFirstOrThrow({ where: { userId: auth.tenant } })
    expect(a.quantite).toBe(4)
    const supprimer = () => abattages.DELETE(req(`/api/elevage/abattages?id=${a.id}`, 'DELETE'))
    const annulations = await Promise.all([supprimer(), supprimer()])
    expect(annulations.map((r) => r.status).sort()).toEqual([200, 409])
    expect((await db.lotAnimaux.findUniqueOrThrow({ where: { id: lotId } })).quantiteActuelle).toBe(6)
  })

  it('le soin du lot et l’antidatage sont contrôlés avant toute sortie ou recette', async () => {
    const a = await animal(true)
    await db.soinAnimal.create({ data: { userId: auth.tenant, lotId, type: 'traitement', date: new Date('2026-10-25T08:00:00Z'), fait: true, finAttenteViande: new Date('2026-10-30'), tempsAttenteViandeJ: 5 } })
    await json(await postAbattage({ animalId: a.id, date: '2026-10-28', destination: 'vente', prixVente: 100 }), 409)
    expect((await db.animal.findUniqueOrThrow({ where: { id: a.id } })).statut).toBe('actif')
    const admis = (await json(await postAbattage({ animalId: a.id, date: '2026-10-31', destination: 'vente', prixVente: 100 }), 201)).data
    await json(await patchAbattage({ id: admis.id, date: '2026-10-28' }), 409)
    expect((await db.abattage.findUniqueOrThrow({ where: { id: admis.id } })).date.toISOString()).toBe('2026-10-31T00:00:00.000Z')
  })

  // Décision du 2026-10-30 : miroir et facture présumés réglés, comme avant le 2026-10-28.
  it('une vente d’abattage est présumée payée, sa facture aussi, sans mode inventé', async () => {
    const a = (await json(await postAbattage({ lotId, quantite: 1, date: '2026-10-28', destination: 'vente', prixVente: 100 }), 201)).data
    const miroir = await db.venteManuelle.findFirstOrThrow({ where: { userId: auth.tenant, sourceType: 'abattage', sourceId: a.id } })
    expect(miroir).toMatchObject({ paye: true, modeReglement: null })
    const facturee = (await json(await patchAbattage({ id: a.id, creerFacture: true }), 200)).data
    const f = await db.facture.findUniqueOrThrow({ where: { id: facturee.factureId } })
    expect(f).toMatchObject({ statut: 'payee', modePaiement: null, totalTTC: 100 })
    expect(f.datePaiement).not.toBeNull()
    expect(await db.venteManuelle.count({ where: { userId: auth.tenant, sourceType: 'abattage', sourceId: a.id } })).toBe(0)
    expect(await db.reglement.count({ where: { userId: auth.tenant } })).toBe(0)
  })

  it('une facture d’abattage dépointé reste émise, à TVA zéro, et fige prix, quantité et date', async () => {
    const a = (await json(await postAbattage({ lotId, quantite: 1, date: '2026-10-28', destination: 'vente', prixVente: 100 }), 201)).data
    await db.venteManuelle.updateMany({ where: { userId: auth.tenant, sourceType: 'abattage', sourceId: a.id }, data: { paye: false } })
    const facturee = (await json(await patchAbattage({ id: a.id, creerFacture: true, tauxTVA: 0 }), 200)).data
    const f = await db.facture.findUniqueOrThrow({ where: { id: facturee.factureId } })
    expect(f).toMatchObject({ statut: 'emise', modePaiement: null, datePaiement: null, totalTTC: 100, totalTVA: 0 })
    for (const correction of [{ prixVente: 200 }, { quantite: 2 }, { date: '2026-10-27' }]) await json(await patchAbattage({ id: a.id, ...correction }), 409)
    expect((await db.abattage.findUniqueOrThrow({ where: { id: a.id } })).prixVente).toBe(100)
    expect((await db.facture.findUniqueOrThrow({ where: { id: f.id } })).totalTTC).toBe(100)
  })

  it('la régénération conserve aussi bien un pointage qu’un dépointage historique', async () => {
    const a = (await json(await postAbattage({ lotId, date: '2026-10-28', destination: 'vente', prixVente: 100 }), 201)).data
    for (const paye of [true, false]) {
      await db.venteManuelle.updateMany({ where: { userId: auth.tenant, sourceType: 'abattage', sourceId: a.id }, data: { paye } })
      await json(await patchAbattage({ id: a.id, notes: `Pointage QA ${paye}` }), 200)
      expect((await db.venteManuelle.findFirstOrThrow({ where: { userId: auth.tenant, sourceType: 'abattage', sourceId: a.id } })).paye).toBe(paye)
    }
  })

  it('le lait transformé reste lié au fromage et sa quantité ne peut pas être corrigée seule', async () => {
    const a = await animal()
    const body = { date: '2026-10-28', traite: 'Matin', animalId: a.id, quantiteLitres: 2 }
    const c = (await json(await collectes.POST(req('/api/elevage/collectes-lait', 'POST', body)), 201)).data
    const f = (await json(await fromages.POST(req('/api/elevage/lots-fromage', 'POST', { dateFabrication: '2026-10-28', typeFromage: 'Frais', volumeLaitUtiliseL: 2, nbPieces: 4, poidsTotalKg: 0.3, collecteIds: [c.id] })), 201)).data
    await json(await collectes.POST(req('/api/elevage/collectes-lait', 'POST', { ...body, quantiteLitres: 2.1 })), 409)
    await json(await collectes.PATCH(req('/api/elevage/collectes-lait', 'PATCH', { id: c.id, lotFromageId: null })), 409)
    await json(await collectes.DELETE(req(`/api/elevage/collectes-lait?id=${c.id}`, 'DELETE')), 409)
    await json(await collectes.POST(req('/api/elevage/collectes-lait', 'POST', body)), 200)
    const conservee = await db.collecteLait.findUniqueOrThrow({ where: { id: c.id } })
    expect(conservee.lotFromageId).toBe(f.id)
    expect(Number(conservee.quantiteLitres)).toBe(2)
    await json(await fromages.DELETE(req(`/api/elevage/lots-fromage?id=${f.id}`, 'DELETE')), 200)
    await json(await collectes.POST(req('/api/elevage/collectes-lait', 'POST', { ...body, quantiteLitres: 2.1 })), 200)
  })

  it('une correction de volume conserve l’écartement manuel et la qualité du lait', async () => {
    const a = await animal()
    const body = { date: '2026-10-28', traite: 'Matin', animalId: a.id, quantiteLitres: 2 }
    const c = (await json(await collectes.POST(req('/api/elevage/collectes-lait', 'POST', { ...body, ecarteAttente: true, mgGpl: 36, mpGpl: 32, cellulesParMl: 120, notes: 'Analyse QA' })), 201)).data
    await json(await collectes.POST(req('/api/elevage/collectes-lait', 'POST', { ...body, quantiteLitres: 2.1 })), 200)
    const conservee = await db.collecteLait.findUniqueOrThrow({ where: { id: c.id } })
    expect(conservee.ecarteAttente).toBe(true)
    expect(Number(conservee.mgGpl)).toBe(36)
    expect(Number(conservee.mpGpl)).toBe(32)
    expect(conservee.cellulesParMl).toBe(120)
    expect(conservee.notes).toBe('Analyse QA')
  })

  it('changer le type d’une vente est refusé et son annulation restitue correctement les œufs', async () => {
    const v = await vendreOeufs()
    await json(await ventes.PATCH(req('/api/elevage/ventes', 'PATCH', { id: v.id, type: 'fromage' })), 409)
    expect(await db.mouvementStockOeuf.count({ where: { userId: auth.tenant } })).toBe(1)
    await json(await ventes.DELETE(req(`/api/elevage/ventes?id=${v.id}`, 'DELETE')), 200)
    expect(await db.mouvementStockOeuf.count({ where: { userId: auth.tenant } })).toBe(0)
    expect(await db.venteManuelle.count({ where: { userId: auth.tenant, sourceType: 'vente_produit' } })).toBe(0)
  })

  it('une annulation en attente relit la facture ajoutée par la transaction précédente', async () => {
    const v = await vendreOeufs()
    let verrouille!: () => void, liberer!: () => void
    const verrou = new Promise<void>((r) => { verrouille = r })
    const suite = new Promise<void>((r) => { liberer = r })
    let factureId = 0
    const facturation = db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'gleba:reglements:' + auth.tenant}))`
      verrouille()
      await suite
      const f = await tx.facture.create({ data: { userId: auth.tenant, numero: 'F-QA-' + randomUUID(), type: 'facture', statut: 'emise', clientNom: 'Client QA', date: new Date('2026-10-28'), totalHT: 12, totalTVA: 0, totalTTC: 12 } })
      factureId = f.id
      await tx.venteProduit.update({ where: { id: v.id }, data: { factureId } })
      await tx.venteManuelle.deleteMany({ where: { userId: auth.tenant, sourceType: 'vente_produit', sourceId: v.id } })
    }, { timeout: 10000 })
    await verrou
    const annulation = ventes.DELETE(req(`/api/elevage/ventes?id=${v.id}`, 'DELETE'))
    try {
      // Attend le véritable mutex PostgreSQL, pas une durée arbitraire.
      let enAttente = false
      for (let i = 0; i < 100 && !enAttente; i++) {
        const lignes = await db.$queryRaw<Array<{ n: bigint }>>`SELECT count(*)::bigint AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event = 'advisory'`
        enAttente = Number(lignes[0].n) > 0
        if (!enAttente) await new Promise((r) => setTimeout(r, 10))
      }
      expect(enAttente).toBe(true)
    } finally { liberer() }
    await facturation
    await json(await annulation, 200)
    expect((await db.facture.findUniqueOrThrow({ where: { id: factureId } })).statut).toBe('annulee')
    expect(await db.mouvementStockOeuf.count({ where: { userId: auth.tenant } })).toBe(0)
  })

  it('Transactions, créances et FEC suivent le règlement réel de l’abattage', async () => {
    const a = (await json(await postAbattage({ lotId, date: '2026-10-28', destination: 'vente', prixVente: 100 }), 201)).data
    await db.exploitation.update({ where: { userId: auth.tenant }, data: { siren: '123456789' } })
    await db.venteManuelle.updateMany({ where: { userId: auth.tenant, sourceType: 'abattage', sourceId: a.id }, data: { modeReglement: 'Virement' } })
    const revenus = await import('@/app/api/comptabilite/revenus/route')
    const fec = await import('@/app/api/comptabilite/export/fec/route')
    const { chargerEncoursCompta } = await import('@/lib/comptabilite/encours')
    for (const paye of [false, true]) {
      await db.venteManuelle.updateMany({ where: { userId: auth.tenant, sourceType: 'abattage', sourceId: a.id }, data: { paye } })
      const liste = await json(await revenus.GET(req('/api/comptabilite/revenus?annee=2026', 'GET')), 200)
      expect(liste.data.find((r: { source: string }) => r.source === 'Abattage').paye).toBe(paye)
      expect((await chargerEncoursCompta(auth.tenant, new Date('2026-01-01'), new Date('2026-12-31T23:59:59Z'))).creances.total).toBe(paye ? 0 : 100)
      const res = await fec.GET(req('/api/comptabilite/export/fec?exercice=2026', 'GET'))
      expect(res.status).toBe(200)
      const lignes = (await res.text()).trim().split('\n').map((l) => l.split('\t'))
      const index = lignes[0].indexOf('CompteNum')
      expect(index).toBeGreaterThan(-1)
      const comptes = lignes.slice(1).map((l) => l[index])
      expect(comptes.some((c) => c.startsWith('512'))).toBe(paye)
      expect(comptes.some((c) => c.startsWith('411'))).toBe(!paye)
    }
  })
})
