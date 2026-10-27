/**
 * Parcours réel sur une base PostgreSQL jetable migrée, hors suite par défaut.
 * DATABASE_URL et GLEBA_COMMERCIAL_QA_DATABASE_URL doivent être identiques ;
 * le garde ci-dessous refuse tout nom de base qui ne porte pas le préfixe QA.
 * Lancer via scripts/qa/controle-borne.sh : vitest run --config scripts/qa/vitest-maraichage.config.mjs.
 */
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import type { User, Espece, Culture } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
const auth = vi.hoisted(() => ({ tenant: '' }))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: vi.fn(async () => ({ error: null, session: { user: { id: auth.tenant } } })), getUserId: (s: { user: { id: string } }) => s.user.id }))
import db from '@/lib/prisma'
import { POST as CREER_CULTURE } from '@/app/api/cultures/route'
import { PUT as MODIFIER_CULTURE } from '@/app/api/cultures/[id]/route'
import { POST as RECOLTER } from '@/app/api/recoltes/route'
import { calculerStocksNet } from '@/lib/stocks-helpers'
import { PATCH as VENDRE_RECOLTE } from '@/app/api/recoltes/[id]/route'
import { POST as INTERVENIR, GET as INTERVENTIONS, PATCH as MODIFIER_INTERVENTION, DELETE as SUPPRIMER_INTERVENTION } from '@/app/api/interventions/route'
import { GET as FEC } from '@/app/api/comptabilite/export/fec/route'
import { computeTvaPeriode } from '@/lib/kpi/tva'
import { getKpiCompta } from '@/lib/kpi/compta'
import { computeCoutsProduction } from '@/lib/comptabilite/couts-production'
import { getBesoinsSemences, getRecoltesPrevuesDetail } from '@/lib/planification'
import { creerDocument, agirSurDocument, facturerDocuments } from '@/lib/commercial/service'
import { contenuDocumentSchema } from '@/lib/commercial/regles'
let u: User, autre: User, e: Espece, c: Culture
const maintenant = new Date()
const hier = new Date(maintenant.getTime() - 86400000)
const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(maintenant)
const annee = maintenant.getFullYear()
const req = (url: string, method: string, body?: Record<string, unknown>) => new NextRequest('http://localhost' + url, { method, headers: { 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })
beforeAll(() => {
  const url = process.env.DATABASE_URL || ''
  if (!/^\/gleba_devis_qa_(?:review_20261027|maraichage)_[0-9a-f]{8}$/.test(new URL(url).pathname) || process.env.GLEBA_COMMERCIAL_QA_DATABASE_URL !== url) throw new Error('Base jetable dédiée obligatoire')
})
beforeEach(async () => {
  const suffixe = randomUUID()
  u = await db.user.create({ data: { email: `revue-${suffixe}@example.invalid`, emailVerified: true } })
  autre = await db.user.create({ data: { email: `revue-autre-${suffixe}@example.invalid`, emailVerified: true } })
  auth.tenant = u.id
  await db.exploitation.create({ data: { userId: u.id, raisonSociale: 'Ferme temoin revue', formeJuridique: 'EI', regimeFiscal: 'micro-BA', emailContact: 'temoin@example.invalid', adresseSiege: '1 voie temoin', codePostal: '64000', ville: 'Essai', regimeTva: 'reel-normal' } })
  e = await db.espece.create({ data: { userId: u.id, nom: `Radis revue ${suffixe}`, rendement: 2, uniteRendement: 'kg_m2', modeSemis: 'graine_directe', doseSemis: 2, uniteDose: 'g_m2', tauxGermination: 100, margeSecuritePct: 0 } })
  c = await db.culture.create({ data: { userId: u.id, especeId: e.id, annee } })
})
afterEach(() => vi.restoreAllMocks())
afterAll(async () => db.$disconnect())
it('PostgreSQL: refuse les liens inter-comptes et masque les anciennes références invalides', async () => {
  const p = await db.planche.create({ data: { userId: autre.id, nom: 'Planche privee temoin', notes: 'NOTE_PRIVEE_TEMOIN', largeur: 1, longueur: 10 } })
  const res = await MODIFIER_CULTURE(req(`/api/cultures/${c.id}`, 'PUT', { plancheId: p.id }), params(c.id))
  expect(res.status).toBe(400)
  const eAutre = await db.espece.create({ data: { userId: autre.id, nom: 'Espèce privée témoin' } })
  const remplace = await MODIFIER_CULTURE(req(`/api/cultures/${c.id}`, 'PUT', { especeId: eAutre.id }), params(c.id))
  expect(remplace.status).toBe(400)
  const cAutre = await db.culture.create({ data: { userId: autre.id, especeId: eAutre.id, plancheId: p.id, annee } })
  const poste = await INTERVENIR(req('/api/interventions', 'POST', { type: 'binage', date: hier.toISOString(), fait: true, cultureId: cAutre.id }))
  expect(poste.status).toBe(400)
  // Cas historique injecté uniquement dans la base jetable : la lecture ne doit pas le divulguer.
  await db.intervention.create({ data: { userId: u.id, type: 'binage', date: hier, fait: true, cultureId: cAutre.id } })
  const liste = await INTERVENTIONS(req(`/api/interventions?annee=${annee}`, 'GET'))
  const texte = JSON.stringify(await liste.json())
  expect(texte).not.toContain('Espèce privée témoin')
  expect(texte).not.toContain('Planche privee temoin')
  expect(texte).not.toContain('NOTE_PRIVEE_TEMOIN')
})
it('PostgreSQL: deux ventes parallèles sur 10 kg conservent 10 kg et une facture', async () => {
  const r = await db.recolte.create({ data: { userId: u.id, especeId: e.id, cultureId: c.id, quantite: 10, unite: 'kg', date: hier } })
  const body = { statut: 'vendu', dateVente: maintenant.toISOString(), prixKg: 2, prixTotal: 12, quantiteVendue: 6, clientNom: 'Marche temoin', creerFacture: true }
  const reponses = await Promise.all([VENDRE_RECOLTE(req(`/api/recoltes/${r.id}`, 'PATCH', body), params(r.id)), VENDRE_RECOLTE(req(`/api/recoltes/${r.id}`, 'PATCH', body), params(r.id))])
  expect(reponses.map(r => r.status).sort()).toEqual([200, 409])
  const quantite = await db.recolte.aggregate({ where: { userId: u.id }, _sum: { quantite: true } })
  const factures = await db.facture.count({ where: { userId: u.id } })
  expect(quantite._sum.quantite).toBe(10)
  expect(factures).toBe(1)
  console.log('PostgreSQL concurrence:', { status: reponses.map(r => r.status), quantite: quantite._sum.quantite, factures })
})
it('PostgreSQL: vente au seul PU : CA, TVA et FEC concordent', async () => {
  const r = await db.recolte.create({ data: { userId: u.id, especeId: e.id, cultureId: c.id, quantite: 10, unite: 'kg', date: hier } })
  const vente = await VENDRE_RECOLTE(req(`/api/recoltes/${r.id}`, 'PATCH', { statut: 'vendu', dateVente: maintenant.toISOString(), prixKg: 2, clientNom: 'Marche temoin' }), params(r.id))
  expect(vente.status).toBe(200)
  const kpi = await getKpiCompta(u.id, annee)
  const tva = await computeTvaPeriode(u.id, new Date(annee,0,1), new Date(annee+1,0,1))
  const fec = await FEC(req(`/api/comptabilite/export/fec?exercice=${annee}&check=1`, 'GET'))
  const json = await fec.json()
  expect(kpi.revenusYtd).toBe(20)
  expect(tva.collectee.total).toBeCloseTo(1.04, 2)
  expect(json.nbEcritures).toBe(1)
  console.log('PostgreSQL export:', { CA: kpi.revenusYtd, TVA: tva.collectee.total, ecrituresFec: json.nbEcritures })
})
it('PostgreSQL: un BL facturé affecte 12 euros au CA, à l’atelier et à la culture', async () => {
  const r = await db.recolte.create({ data: { userId: u.id, especeId: e.id, cultureId: c.id, quantite: 10, unite: 'kg', date: hier } })
  const client = await db.client.create({ data: { userId: u.id, nom: 'Client temoin' } })
  const contenu = contenuDocumentSchema.parse({ type: 'livraison', clientId: client.id, date: jour, dateValidite: null, dateLivraison: null, objet: 'BL temoin revue', lignes: [{ description: 'Radis temoin', quantite: 4, unite: 'kg', prixUnitaire: 3, tauxTVA: 0, articleStockType: 'recolte', articleStockId: String(r.id) }] })
  const bl = await creerDocument(u.id, randomUUID(), contenu)
  await agirSurDocument(u.id, bl.id, 'emettre')
  await agirSurDocument(u.id, bl.id, 'livrer', jour)
  await facturerDocuments(u.id, [bl.id], jour)
  const couts = await computeCoutsProduction(u.id, annee)
  expect(couts.totaux.revenus).toBe(12)
  expect(couts.parModule.potager.revenus).toBe(12)
  expect(couts.parCulture[0].revenus).toBe(12)
  console.log('PostgreSQL BL -> facture:', { CA: couts.totaux.revenus, CApotager: couts.parModule.potager.revenus, CAculture: couts.parCulture[0].revenus })
})

it('PostgreSQL: un échec comptable annule aussi la vente partielle et son reliquat', async () => {
  const r = await db.recolte.create({ data: { userId: u.id, especeId: e.id, cultureId: c.id, quantite: 10, unite: 'kg', date: hier } })
  await db.$executeRawUnsafe("ALTER TABLE ventes_manuelles ADD CONSTRAINT revue_refus_miroir CHECK (source_type IS DISTINCT FROM 'recolte') NOT VALID")
  try {
    const vente = await VENDRE_RECOLTE(req(`/api/recoltes/${r.id}`, 'PATCH', { statut: 'vendu', dateVente: maintenant.toISOString(), prixKg: 2, prixTotal: 12, quantiteVendue: 6, clientNom: 'Marche temoin' }), params(r.id))
    expect(vente.status).toBe(500)
    expect((await db.recolte.findUniqueOrThrow({ where: { id: r.id } })).statut).toBe('en_stock')
    expect(await db.venteManuelle.count({ where: { userId: u.id } })).toBe(0)
    expect(await db.recolte.count({ where: { userId: u.id } })).toBe(1)
    expect((await db.recolte.findUniqueOrThrow({ where: { id: r.id } })).quantite).toBe(10)
  } finally { await db.$executeRawUnsafe('ALTER TABLE ventes_manuelles DROP CONSTRAINT revue_refus_miroir') }
})
it('PostgreSQL: corriger le total seul met aussi à jour le miroir et le prix unitaire', async () => {
  const r = await db.recolte.create({ data: { userId: u.id, especeId: e.id, cultureId: c.id, quantite: 10, unite: 'kg', date: hier } })
  const vente = await VENDRE_RECOLTE(req(`/api/recoltes/${r.id}`, 'PATCH', { statut: 'vendu', dateVente: maintenant.toISOString(), prixKg: 2, prixTotal: 20, clientNom: 'Marche temoin' }), params(r.id))
  expect(vente.status).toBe(200)
  const correction = await VENDRE_RECOLTE(req(`/api/recoltes/${r.id}`, 'PATCH', { prixTotal: 30 }), params(r.id))
  expect(correction.status).toBe(200)
  expect((await db.recolte.findUniqueOrThrow({ where: { id: r.id } })).prixTotal).toBe(30)
  expect((await db.venteManuelle.findFirstOrThrow({ where: { userId: u.id, sourceType: 'recolte', sourceId: r.id } })).montant).toBe(30)
  expect((await db.recolte.findUniqueOrThrow({ where: { id: r.id } })).prixKg).toBe(3)
})
it('PostgreSQL: deux doses sur 10 m² donnent exactement 40 g', async () => {
  await db.culture.delete({ where: { id: c.id } })
  for (let i=0; i<2; i++) {
    const p = await db.planche.create({ data: { userId: u.id, nom: `Dose ${i}`, largeur: 1, longueur: 10, surface: 10 } })
    const itp = await db.iTP.create({ data: { userId: u.id, especeId: e.id, nom: `Dose ${i}`, semaineSemis: 10+i, semaineRecolte: 20+i, doseSemis: i===0 ? 1 : 3 } })
    await db.culture.create({ data: { userId: u.id, especeId: e.id, plancheId: p.id, itpId: itp.id, longueur: 10, annee } })
  }
  const besoins = await getBesoinsSemences(u.id, annee)
  const b = besoins.find(b => b.especeId === e.id)!
  expect(b.surfaceTotale).toBe(20)
  expect(b.grainesNecessaires).toBe(40)
  console.log('PostgreSQL semences:', { attendu: 40, resultat: b.grainesNecessaires })
})
it('PostgreSQL: les prévisions de semaine 53 restent dans le total', async () => {
  const p = await db.planche.create({ data: { userId: u.id, nom: 'Fin 2026', largeur: 1, longueur: 10, surface: 10 } })
  await db.culture.update({ where: { id: c.id }, data: { plancheId: p.id, longueur: 10, annee: 2026, dateRecolte: new Date('2026-12-30T00:00:00Z') } })
  const r = await getRecoltesPrevuesDetail(u.id, 2026, 'semaine')
  expect(r.projectionCreeesKg).toBe(20)
  expect(r.periodes.reduce((s,p) => s+p.totalKg,0)).toBe(20)

})
it('PostgreSQL: la création refuse un ITP d’une autre espèce', async () => {
  const e2 = await db.espece.create({ data: { userId: u.id, nom: 'Tomate temoin' } })
  const itp = await db.iTP.create({ data: { userId: u.id, especeId: e2.id, nom: 'ITP tomate temoin', semaineSemis: 10, semaineRecolte: 20 } })
  const res = await CREER_CULTURE(req('/api/cultures', 'POST', { especeId: e.id, itpId: itp.id, semisFait: false, plantationFaite: false, recolteFaite: false }))
  const corps = await res.json()
  expect(res.status).toBe(400)
  expect(corps.champ).toBe('itpId')

})

it('PostgreSQL: une ancienne vente sans total reste exportée en TVA et FEC', async () => {
  await db.recolte.create({ data: { userId: u.id, especeId: e.id, cultureId: c.id, quantite: 10, unite: 'kg', date: hier,
    statut: 'vendu', dateVente: maintenant, prixKg: 2, prixTotal: null } })
  const tva = await computeTvaPeriode(u.id, new Date(annee,0,1), new Date(annee+1,0,1))
  const fec = await FEC(req(`/api/comptabilite/export/fec?exercice=${annee}&check=1`, 'GET'))
  expect(tva.collectee.total).toBeCloseTo(1.04,2)
  expect((await fec.json()).nbEcritures).toBe(1)
})

it('PostgreSQL: du semis à la vente partielle puis à son annulation, les quantités et euros se conservent', async () => {
  const p = await db.planche.create({ data: { userId: u.id, nom: 'Parcours complet', largeur: 1, longueur: 10, surface: 10 } })
  const cultureRes = await CREER_CULTURE(req('/api/cultures', 'POST', { especeId: e.id, plancheId: p.id,
    annee, longueur: 10, nbRangs: 2, espacement: 20, dateSemis: hier.toISOString(),
    semisFait: true, plantationFaite: false, recolteFaite: false }))
  expect(cultureRes.status).toBe(201)
  const culture = await cultureRes.json()
  expect(culture.quantite).toBe(100)
  const besoin = (await getBesoinsSemences(u.id, annee)).find(b => b.especeId === e.id)!
  expect(besoin.grainesNecessaires).toBe(20) // 10 m² × 2 g/m², sans marge
  const recolteRes = await RECOLTER(req('/api/recoltes', 'POST', { especeId: e.id, cultureId: culture.id,
    quantite: 10, date: hier.toISOString() }))
  expect(recolteRes.status).toBe(201)
  const recolte = await recolteRes.json()
  expect((await calculerStocksNet(u.id, e.id))[e.id].stockNet).toBe(10)
  const vente = await VENDRE_RECOLTE(req(`/api/recoltes/${recolte.id}`, 'PATCH', { statut: 'vendu',
    dateVente: maintenant.toISOString(), quantiteVendue: 6, prixKg: 2, clientNom: 'Marché fictif' }), params(recolte.id))
  expect(vente.status).toBe(200)
  expect((await vente.json()).prixTotal).toBe(12)
  expect((await calculerStocksNet(u.id, e.id))[e.id].stockNet).toBe(4)
  expect((await getKpiCompta(u.id, annee)).revenusYtd).toBe(12)
  const couts = await computeCoutsProduction(u.id, annee)
  expect(couts.parCulture.find(c => c.cultureId === culture.id)?.revenus).toBe(12)
  expect(couts.parModule.potager.revenus).toBe(12)
  const correction = await VENDRE_RECOLTE(req(`/api/recoltes/${recolte.id}`, 'PATCH', {
    statut: 'en_stock', dateVente: null, prixKg: null, prixTotal: null, clientNom: null,
  }), params(recolte.id))
  expect(correction.status).toBe(200)
  expect((await calculerStocksNet(u.id, e.id))[e.id].stockNet).toBe(10)
  expect((await db.recolte.aggregate({ where: { userId: u.id }, _sum: { quantite: true } }))._sum.quantite).toBe(10)
  expect(await db.venteManuelle.count({ where: { userId: u.id } })).toBe(0)
  expect((await getKpiCompta(u.id, annee)).revenusYtd).toBe(0)
})
it('PostgreSQL: facturer une vente conserve son suivi non encaissé et son mode', async () => {
  const r = await db.recolte.create({ data: { userId: u.id, especeId: e.id, cultureId: c.id,
    quantite: 10, unite: 'kg', date: hier } })
  expect((await VENDRE_RECOLTE(req(`/api/recoltes/${r.id}`, 'PATCH', { statut: 'vendu', prixKg: 2,
    dateVente: maintenant.toISOString(), clientNom: 'Client témoin' }), params(r.id))).status).toBe(200)
  await db.venteManuelle.updateMany({ where: { userId: u.id, sourceType: 'recolte', sourceId: r.id },
    data: { paye: false, modeReglement: 'Virement' } })
  const res = await VENDRE_RECOLTE(req(`/api/recoltes/${r.id}`, 'PATCH', { creerFacture: true }), params(r.id))
  expect(res.status).toBe(200)
  const source = await db.recolte.findUniqueOrThrow({ where: { id: r.id } })
  const f = await db.facture.findUniqueOrThrow({ where: { id: source.factureId! } })
  expect(f.statut).toBe('emise'); expect(f.datePaiement).toBeNull(); expect(f.modePaiement).toBe('virement')
  expect(await db.venteManuelle.count({ where: { userId: u.id, sourceType: 'recolte', sourceId: r.id } })).toBe(0)
})
it('PostgreSQL: la retouche d’une vente facturée protège son montant mais accepte une note', async () => {
  const r = await db.recolte.create({ data: { userId: u.id, especeId: e.id, cultureId: c.id, quantite: 10, unite: 'kg', date: hier } })
  expect((await VENDRE_RECOLTE(req(`/api/recoltes/${r.id}`, 'PATCH', { statut: 'vendu', prixKg: 2,
    dateVente: maintenant.toISOString(), clientNom: 'Client témoin', creerFacture: true }), params(r.id))).status).toBe(200)
  expect((await VENDRE_RECOLTE(req(`/api/recoltes/${r.id}`, 'PATCH', { prixTotal: 30 }), params(r.id))).status).toBe(409)
  expect((await VENDRE_RECOLTE(req(`/api/recoltes/${r.id}`, 'PATCH', { notes: 'Calibre contrôlé' }), params(r.id))).status).toBe(200)
  const source = await db.recolte.findUniqueOrThrow({ where: { id: r.id } })
  expect(source.prixTotal).toBe(20)
  expect((await db.facture.findUniqueOrThrow({ where: { id: source.factureId! } })).modePaiement).toBeNull()
})

it('PostgreSQL: un échec comptable refuse aussi la création de l’intervention', async () => {
  await db.$executeRawUnsafe("ALTER TABLE depenses_manuelles ADD CONSTRAINT revue_refus_depense CHECK (source_type IS DISTINCT FROM 'intervention') NOT VALID")
  try {
    const res = await INTERVENIR(req('/api/interventions', 'POST', { type: 'binage', date: hier.toISOString(),
      fait: true, dureeMinutes: 30, coutTotal: 20, intrantCout: 20, cultureId: c.id }))
    expect(res.status).toBe(500)
    expect(await db.intervention.count({ where: { userId: u.id } })).toBe(0)
    expect(await db.depenseManuelle.count({ where: { userId: u.id } })).toBe(0)
  } finally { await db.$executeRawUnsafe('ALTER TABLE depenses_manuelles DROP CONSTRAINT revue_refus_depense') }
})

it('PostgreSQL: correction et suppression d’une intervention sont annulées avec leur miroir en cas d’échec', async () => {
  const creation = await INTERVENIR(req('/api/interventions', 'POST', { type: 'binage', date: hier.toISOString(),
    fait: true, dureeMinutes: 30, coutTotal: 20, intrantCout: 20, cultureId: c.id }))
  expect(creation.status).toBe(201)
  const intervention = await creation.json()
  await db.$executeRawUnsafe("ALTER TABLE depenses_manuelles ADD CONSTRAINT revue_refus_depense CHECK (source_type IS DISTINCT FROM 'intervention') NOT VALID")
  try {
    const res = await MODIFIER_INTERVENTION(req('/api/interventions', 'PATCH', { id: intervention.id, coutTotal: 30 }))
    expect(res.status).toBe(500)
    expect((await db.intervention.findUniqueOrThrow({ where: { id: intervention.id } })).coutTotal).toBe(20)
    expect((await db.depenseManuelle.findFirstOrThrow({ where: { userId: u.id, sourceType: 'intervention' } })).montant).toBe(20)
  } finally { await db.$executeRawUnsafe('ALTER TABLE depenses_manuelles DROP CONSTRAINT revue_refus_depense') }
  // Échec forcé de la suppression de la source, uniquement dans cette base vide QA.
  await db.$executeRawUnsafe('CREATE TABLE revue_garde_intervention (intervention_id INTEGER REFERENCES interventions(id))')
  try {
    await db.$executeRaw`INSERT INTO revue_garde_intervention VALUES (${intervention.id})`
    const res = await SUPPRIMER_INTERVENTION(req(`/api/interventions?id=${intervention.id}`, 'DELETE'))
    expect(res.status).toBe(500)
    expect(await db.intervention.count({ where: { id: intervention.id } })).toBe(1)
    expect((await db.depenseManuelle.findFirstOrThrow({ where: { userId: u.id, sourceType: 'intervention' } })).montant).toBe(20)
  } finally { await db.$executeRawUnsafe('DROP TABLE revue_garde_intervention') }
})
it('PostgreSQL: planifier, réaliser, corriger et annuler une charge actualise aussi les KPI déjà en cache', async () => {
  const creation = await INTERVENIR(req('/api/interventions', 'POST', { type: 'binage', date: hier.toISOString(),
    fait: false, dureeMinutes: 30, coutTotal: 20, intrantCout: 20, cultureId: c.id }))
  expect(creation.status).toBe(201)
  const i = await creation.json()
  expect((await getKpiCompta(u.id, annee)).depensesYtd).toBe(0)
  expect((await MODIFIER_INTERVENTION(req('/api/interventions', 'PATCH', { id: i.id, fait: true }))).status).toBe(200)
  expect((await getKpiCompta(u.id, annee)).depensesYtd).toBe(20)
  expect((await MODIFIER_INTERVENTION(req('/api/interventions', 'PATCH', { id: i.id, coutTotal: 30 }))).status).toBe(200)
  expect((await getKpiCompta(u.id, annee)).depensesYtd).toBe(30)
  expect((await MODIFIER_INTERVENTION(req('/api/interventions', 'PATCH', { id: i.id, fait: false }))).status).toBe(200)
  expect((await getKpiCompta(u.id, annee)).depensesYtd).toBe(0)
  expect((await SUPPRIMER_INTERVENTION(req(`/api/interventions?id=${i.id}`, 'DELETE'))).status).toBe(200)
  expect(await db.intervention.count({ where: { id: i.id } })).toBe(0)
})
