/** Témoins PostgreSQL : seule l'identité est simulée, les API et calculs sont réels. */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'

const auth = vi.hoisted(() => ({ userId: '' }))
vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ session: { user: { id: auth.userId }, acteurId: auth.userId, peutEcrire: true }, error: null }),
}))

const qaUrl = process.env.GLEBA_ELEVAGE_QA_DATABASE_URL
const active = Boolean(qaUrl && /^\/gleba_reglements_qa_[a-z0-9_]+$/.test(new URL(qaUrl).pathname))
let db: PrismaClient
const comptes: string[] = []

const request = (path: string, data?: object, method = data ? 'POST' : 'GET') => new NextRequest(`http://localhost${path}`, {
  method, ...(data ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) } : {}),
})
async function resultat(response: Response, status = 200) {
  const json = await response.json()
  expect(response.status, JSON.stringify(json)).toBe(status)
  return json
}

async function ferme() {
  const user = await db.user.create({ data: { email: `chaine-${randomUUID()}@example.test`, emailVerified: true } })
  comptes.push(user.id); auth.userId = user.id
  await db.exploitation.create({ data: { userId: user.id, raisonSociale: 'Ferme témoin QA', formeJuridique: 'EI', regimeFiscal: 'micro-BA', regimeTva: 'reel-normal', emailContact: 'qa@example.test', adresseSiege: '1 chemin QA', codePostal: '64000', ville: 'Commune QA' } })
  const espece = await db.especeAnimale.create({ data: { id: `poule_qa_${randomUUID()}`, nom: 'Poule pondeuse QA', type: 'Volaille', production: 'oeufs', dureeElevage: 150, userId: user.id } })
  const lot = await db.lotAnimaux.create({ data: { userId: user.id, especeAnimaleId: espece.id, nom: 'Pondeuses du témoin', dateArrivee: new Date('2026-01-01'), quantiteInitiale: 10, quantiteActuelle: 8, prixAchatTotal: 105.5 } })
  const { createDepenseFromLotAnimaux } = await import('@/lib/auto-compta')
  await createDepenseFromLotAnimaux(user.id, lot)
  const mere = await db.animal.create({ data: { userId: user.id, especeAnimaleId: espece.id, lotId: lot.id, sexe: 'femelle', dateNaissance: new Date('2025-01-01'), dateArrivee: new Date('2026-01-01') } })
  await db.animal.create({ data: { userId: user.id, especeAnimaleId: espece.id, lotId: lot.id, sexe: 'male', dateNaissance: new Date('2025-01-01'), dateArrivee: new Date('2026-01-01') } })
  return { user, espece, lot, mere }
}

describe.skipIf(!active)('chaîne naissance → calculs élevage → comptabilité sur PostgreSQL', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = qaUrl
    const clientImport = await import('@/lib/prisma'); db = clientImport.default
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-27T12:00:00+01:00'))
  })
  afterAll(async () => {
    if (db) {
      for (const id of comptes) await db.user.delete({ where: { id } })
      await db.$disconnect()
    }
    vi.useRealTimers()
  })

  const naissance = async (farm: Awaited<ReturnType<typeof ferme>>, date = '2026-08-01') => {
    const { POST } = await import('@/app/api/elevage/naissances/route')
    return (await resultat(await POST(request('/api/elevage/naissances', {
      mereId: farm.mere.id, lotId: farm.lot.id, date, nombreNes: 4, nombreVivants: 3, nombreMales: 1, nombreFemelles: 2,
      petits: [{ sexe: 'male', vivant: true }, { sexe: 'femelle', vivant: true }, { sexe: 'femelle', vivant: true }, { vivant: false }],
    })), 201)).data
  }

  it('un compte vide affiche des zéros et des ratios indisponibles, sans NaN ni coûts inventés', async () => {
    const user = await db.user.create({ data: { email: `vide-${randomUUID()}@example.test`, emailVerified: true } })
    comptes.push(user.id); auth.userId = user.id
    const dashboard = await import('@/app/api/elevage/stats/route')
    const zero = (await resultat(await dashboard.GET(request('/api/elevage/stats?annee=2026')))).stats
    expect(zero).toMatchObject({ animauxActifs: 0, animauxHorsLot: 0, animauxRattachesLots: 0, animauxTotal: 0, animauxEnLots: 0, lotsActifs: 0, productionOeufsAnnee: 0, ventesAnnee: 0, stockOeufs: 0, stockOeufsCommercialisables: 0, nbPondeuses: 0, nbOeufsPeriode7j: 0, tauxPonte: null, tauxPonteRatio: null, mortaliteAnnee: 0, tauxMortalite: 0, consoAlimentsKg: 0, fcr: null, laitTotalAnnee: 0 })
    const { getKpiCompta } = await import('@/lib/kpi/compta')
    expect(await getKpiCompta(user.id, 2026)).toMatchObject({ revenusYtd: 0, depensesYtd: 0, beneficeYtd: 0, margePercentYtd: 0 })
    const economie = await import('@/app/api/elevage/economie-lait/route')
    expect((await resultat(await economie.GET(request('/api/elevage/economie-lait?annee=2026')))).indicateurs).toMatchObject({ valorisation: 0, coutTotal: 0, marge: 0, mca: 0, mcaPour1000L: null, coutAlimentaireLitre: null, coutRevientLitre: null, prixMoyenLitreValorise: null, rendementFromager: null, litresParKgFromage: null, coutRevientKgFromage: null })
  })

  it('une année invalide ne produit pas des chiffres d’un autre exercice ou une erreur serveur', async () => {
    await ferme()
    const dashboard = await import('@/app/api/elevage/stats/route')
    const economie = await import('@/app/api/elevage/economie-lait/route')
    expect.soft((await dashboard.GET(request('/api/elevage/stats?annee=invalide'))).status).toBe(400)
    expect.soft((await economie.GET(request('/api/elevage/economie-lait?annee=invalide'))).status).toBe(400)
  })

  it('compte les pondeuses individuelles hors lot actif avec leur âge et leur sexe', async () => {
    const user = await db.user.create({ data: { email: `individuels-${randomUUID()}@example.test`, emailVerified: true } })
    comptes.push(user.id); auth.userId = user.id
    const espece = await db.especeAnimale.create({ data: { id: `poule_qa_${randomUUID()}`, userId: user.id, nom: 'Marans QA', type: 'Volaille', production: 'oeufs', dureeElevage: 150 } })
    const lot = await db.lotAnimaux.create({ data: { userId: user.id, especeAnimaleId: espece.id, nom: 'Ancien lot QA', quantiteInitiale: 1, quantiteActuelle: 0, statut: 'termine' } })
    await db.animal.createMany({ data: [
      { userId: user.id, especeAnimaleId: espece.id, sexe: 'femelle', dateNaissance: new Date('2025-01-01') },
      { userId: user.id, especeAnimaleId: espece.id, sexe: 'femelle', dateNaissance: new Date('2025-01-01') },
      { userId: user.id, especeAnimaleId: espece.id, sexe: 'male', dateNaissance: new Date('2025-01-01') },
      { userId: user.id, especeAnimaleId: espece.id, sexe: 'femelle', dateNaissance: new Date('2026-10-01') },
      { userId: user.id, especeAnimaleId: espece.id, lotId: lot.id, sexe: 'femelle', dateNaissance: new Date('2025-01-01') },
    ] })
    const ponte = await import('@/app/api/elevage/production-oeufs/route')
    const pondeuses = await db.animal.findMany({ where: { userId: user.id, sexe: 'femelle', dateNaissance: { lt: new Date('2026-01-01') } }, select: { id: true } })
    for (let jour = 21; jour <= 27; jour++) {
      for (const animal of pondeuses) await resultat(await ponte.POST(request('/api/elevage/production-oeufs', { animalId: animal.id, date: `2026-10-${jour}`, quantite: 1 })), 201)
    }
    const dashboard = await import('@/app/api/elevage/stats/route')
    const result = await resultat(await dashboard.GET(request('/api/elevage/stats?annee=2026')))
    expect.soft(result.stats).toMatchObject({ animauxActifs: 5, animauxTotal: 5, animauxHorsLot: 5, lotsActifs: 0, nbPondeuses: 3, nbOeufsPeriode7j: 21, tauxPonte: 100, tauxPonteSaisonAttendu: 40, tauxPonteRatio: 2.5 })
    const { chargerCheptelEnStock } = await import('@/lib/elevage/stock-cheptel')
    const stocks = await chargerCheptelEnStock(user.id)
    expect.soft([...stocks.individuels, ...stocks.lots].reduce((sum, v) => sum + v.tetes, 0)).toBe(result.stats.animauxTotal)
  })

  it('rattache les collectes au mois civil et inclut la dernière milliseconde de l’exercice', async () => {
    const farm = await ferme()
    await db.productionOeuf.createMany({ data: [
      { userId: farm.user.id, lotId: farm.lot.id, date: new Date('2025-01-01T00:30:00+01:00'), quantite: 2 },
      { userId: farm.user.id, lotId: farm.lot.id, date: new Date('2025-12-31T23:59:59.500+01:00'), quantite: 3 },
    ] })
    const dashboard = await import('@/app/api/elevage/stats/route')
    const result = await resultat(await dashboard.GET(request('/api/elevage/stats?annee=2025')))
    expect.soft(result.stats.productionOeufsAnnee).toBe(5)
    expect.soft(result.productionOeufsMois).toEqual([{ mois: 1, total: 2 }, { mois: 12, total: 3 }])
    const productions = await import('@/app/api/elevage/production-oeufs/route')
    expect.soft((await resultat(await productions.GET(request('/api/elevage/production-oeufs?annee=2025')))).stats.total).toBe(5)
  })

  it('les KPI de naissance et leurs douze mois portent tout le registre, même avec une liste limitée', async () => {
    const farm = await ferme()
    await naissance(farm, '2026-02-01'); await naissance(farm, '2026-08-01')
    const { GET } = await import('@/app/api/elevage/naissances/route')
    const { stats, data } = await resultat(await GET(request('/api/elevage/naissances?annee=2026&limit=1')))
    expect(data).toHaveLength(1)
    expect.soft(stats).toMatchObject({ totalNaissances: 2, totalNes: 8, totalVivants: 6, totalMales: 2, totalFemelles: 4, tauxSurvie: 75 })
    expect.soft(stats.parMois[1]).toMatchObject({ nes: 4, vivants: 3 })
    expect.soft(stats.parMois[7]).toMatchObject({ nes: 4, vivants: 3 })
  })

  it('deux demandes simultanées de fiches ne créent pas deux fois les mêmes petits', async () => {
    const farm = await ferme(); const n = await naissance(farm)
    const { POST } = await import('@/app/api/elevage/naissances/[id]/fiches/route')
    const call = () => POST(request(`/api/elevage/naissances/${n.id}/fiches`, {}, 'POST'), { params: Promise.resolve({ id: String(n.id) }) })
    const responses = await Promise.all([call(), call()])
    for (const response of responses) expect([200, 201]).toContain(response.status)
    expect(await db.animal.count({ where: { userId: farm.user.id, provenance: 'Naissance' } })).toBe(3)
    expect(await db.petitNaissance.count({ where: { naissanceId: n.id, animalId: { not: null } } })).toBe(3)
    const { reconstituerEffectifsLots } = await import('@/lib/elevage/effectif')
    const lot = await db.lotAnimaux.findUniqueOrThrow({ where: { id: farm.lot.id } })
    expect((await reconstituerEffectifsLots(farm.user.id, [lot])).get(lot.id)?.effectifCalcule).toBe(13)
  })

  it('conserve les liens des petits quand le formulaire de naissance est réenregistré', async () => {
    const farm = await ferme(); const n = await naissance(farm)
    const fiches = await import('@/app/api/elevage/naissances/[id]/fiches/route')
    await resultat(await fiches.POST(request(`/api/elevage/naissances/${n.id}/fiches`, {}, 'POST'), { params: Promise.resolve({ id: String(n.id) }) }), 201)
    const route = await import('@/app/api/elevage/naissances/route')
    await resultat(await route.PATCH(request('/api/elevage/naissances', {
      id: n.id, mereId: farm.mere.id, lotId: farm.lot.id, date: '2026-08-01', nombreNes: 4, nombreVivants: 3, nombreMales: 1, nombreFemelles: 2, notes: 'Note corrigée',
      petits: [{ sexe: 'male', vivant: true }, { sexe: 'femelle', vivant: true }, { sexe: 'femelle', vivant: true }, { vivant: false }],
    }, 'PATCH')))
    expect.soft(await db.petitNaissance.count({ where: { naissanceId: n.id, animalId: { not: null } } })).toBe(3)
    expect.soft((await route.DELETE(request(`/api/elevage/naissances?id=${n.id}`, undefined, 'DELETE'))).status).toBe(409)
    expect.soft(await db.naissanceAnimale.count({ where: { id: n.id } })).toBe(1)
  })

  it('borne la mortalité sur le même exercice civil que le tableau de bord', async () => {
    const farm = await ferme()
    await db.animal.update({ where: { id: farm.mere.id }, data: { statut: 'mort', dateSortie: new Date('2027-01-01T00:30:00+01:00') } })
    const mortalites = await import('@/app/api/elevage/mortalites/route')
    expect((await resultat(await mortalites.GET(request('/api/elevage/mortalites?annee=2026')))).stats.total).toBe(0)
    expect((await resultat(await mortalites.GET(request('/api/elevage/mortalites?annee=2027')))).stats.total).toBe(1)
  })

  it('la moyenne laitière sur 30 jours ignore une collecte future', async () => {
    const farm = await ferme()
    await db.collecteLait.createMany({ data: [
      { userId: farm.user.id, animalId: farm.mere.id, date: new Date('2026-10-26'), traite: 'Unique', quantiteLitres: 30 },
      { userId: farm.user.id, animalId: farm.mere.id, date: new Date('2026-10-28'), traite: 'Unique', quantiteLitres: 300 },
      { userId: farm.user.id, animalId: farm.mere.id, date: new Date('2026-09-27T15:00:00+02:00'), traite: 'Unique', quantiteLitres: 300 },
    ] })
    const dashboard = await import('@/app/api/elevage/stats/route')
    const stats = (await resultat(await dashboard.GET(request('/api/elevage/stats?annee=2026')))).stats
    expect(stats.laitMoyenJourJ30).toBe(1)
    expect(stats.laitStockTransformable).toBe(330)
  })

  it('refuse l’annulation intégrale d’une vente payée sur un avoir brouillon ou partiel', async () => {
    const farm = await ferme()
    const facture = await db.facture.create({ data: { userId: farm.user.id, numero: `F-QA-${randomUUID()}`, clientNom: 'Client QA', date: new Date('2026-10-27'), totalHT: 3, totalTVA: 0, totalTTC: 3, statut: 'payee' } })
    const avoir = await db.facture.create({ data: { userId: farm.user.id, numero: `BR-QA-${randomUUID()}`, clientNom: 'Client QA', date: new Date('2026-10-27'), totalHT: 3, totalTVA: 0, totalTTC: 3, type: 'avoir', factureOrigineId: facture.id, statut: 'brouillon' } })
    const { annulerFactureLiee } = await import('@/lib/facture-utils')
    expect.soft((await db.$transaction((tx) => annulerFactureLiee(tx, farm.user.id, facture.id))).ok).toBe(false)
    await db.facture.update({ where: { id: avoir.id }, data: { statut: 'emise', totalHT: 1, totalTTC: 1 } })
    expect.soft((await db.$transaction((tx) => annulerFactureLiee(tx, farm.user.id, facture.id))).ok).toBe(false)
    await db.facture.update({ where: { id: avoir.id }, data: { totalHT: 3, totalTTC: 3 } })
    expect.soft((await db.$transaction((tx) => annulerFactureLiee(tx, farm.user.id, facture.id))).ok).toBe(true)
    await db.facture.update({ where: { id: facture.id }, data: { statut: 'emise' } })
    await db.facture.update({ where: { id: avoir.id }, data: { totalHT: 1, totalTTC: 1 } })
    expect.soft((await db.$transaction((tx) => annulerFactureLiee(tx, farm.user.id, facture.id))).ok).toBe(false)
    expect.soft((await db.facture.findUniqueOrThrow({ where: { id: facture.id } })).statut).toBe('emise')
    await db.facture.update({ where: { id: avoir.id }, data: { totalHT: 3, totalTTC: 3 } })
    expect.soft((await db.$transaction((tx) => annulerFactureLiee(tx, farm.user.id, facture.id))).ok).toBe(true)
    expect.soft((await db.facture.findUniqueOrThrow({ where: { id: facture.id } })).statut).toBe('emise')
    const factures = await import('@/app/api/comptabilite/factures/route')
    expect.soft((await factures.PATCH(request('/api/comptabilite/factures', { id: facture.id, statut: 'annulee' }, 'PATCH'))).status).toBe(409)
    expect.soft((await factures.DELETE(request(`/api/comptabilite/factures?id=${facture.id}`, undefined, 'DELETE'))).status).toBe(409)
    expect.soft((await db.facture.findUniqueOrThrow({ where: { id: facture.id } })).statut).toBe('emise')
  })

  it('une facture ne peut pas effacer le revenu d’une vente native par un simple changement de statut', async () => {
    const farm = await ferme()
    const ponte = await import('@/app/api/elevage/production-oeufs/route')
    await resultat(await ponte.POST(request('/api/elevage/production-oeufs', { lotId: farm.lot.id, date: '2026-10-27', quantite: 9 })), 201)
    const ventes = await import('@/app/api/elevage/ventes/route')
    const vente = (await resultat(await ventes.POST(request('/api/elevage/ventes', { date: '2026-10-27', type: 'oeufs', quantite: 6, unite: 'unite', prixUnitaire: 0.5, paye: false, modeReglement: 'Chèque' })), 201)).data
    const facturee = (await resultat(await ventes.PATCH(request('/api/elevage/ventes', { id: vente.id, creerFacture: true }, 'PATCH')))).data
    const factures = await import('@/app/api/comptabilite/factures/route')
    expect.soft((await factures.PATCH(request('/api/comptabilite/factures', { id: facturee.factureId, statut: 'annulee' }, 'PATCH'))).status).toBe(409)
    expect.soft((await db.facture.findUniqueOrThrow({ where: { id: facturee.factureId } })).statut).toBe('emise')
    expect.soft((await db.venteProduit.findUniqueOrThrow({ where: { id: vente.id } })).annule).toBe(false)
  })

  it('les sorties viande, l’indice alimentaire et l’annulation portent le même effectif et le même revenu', async () => {
    const farm = await ferme()
    const espece = await db.especeAnimale.create({ data: { id: `lapin_qa_${randomUUID()}`, userId: farm.user.id, nom: 'Lapin viande QA', type: 'Cuniculture', production: 'viande' } })
    const lot = await db.lotAnimaux.create({ data: { userId: farm.user.id, especeAnimaleId: espece.id, nom: 'Lot viande QA', quantiteInitiale: 4, quantiteActuelle: 4, dateArrivee: new Date('2026-01-01'), prixAchatTotal: 40 } })
    const aliment = await db.aliment.create({ data: { id: `qa-${randomUUID()}`, nom: 'Aliment viande QA', ownerUserId: farm.user.id, origine: 'prive', prix: 0.5 } })
    await db.userStockAliment.create({ data: { userId: farm.user.id, alimentId: aliment.id, stock: 30, prix: 0.5 } })
    const conso = await import('@/app/api/elevage/consommations-aliments/route')
    await resultat(await conso.POST(request('/api/elevage/consommations-aliments', { date: '2026-10-21', lotId: lot.id, alimentId: aliment.id, quantite: 10 })), 201)
    const abattages = await import('@/app/api/elevage/abattages/route')
    const abat = (await resultat(await abattages.POST(request('/api/elevage/abattages', { date: '2026-10-27', lotId: lot.id, quantite: 2, poidsVif: 6, poidsCarcasse: 3.5, destination: 'vente', prixVente: 21 })), 201)).data
    const dashboard = await import('@/app/api/elevage/stats/route')
    expect.soft((await resultat(await dashboard.GET(request('/api/elevage/stats?annee=2026')))).stats).toMatchObject({ animauxEnLots: 12, animauxTotal: 12, abattagesAnnee: 2, poidsCarcasseAnnee: 3.5, consoAlimentsKg: 10, fcr: 2.86 })
    const { getKpiCompta } = await import('@/lib/kpi/compta')
    expect.soft((await getKpiCompta(farm.user.id, 2026)).revenusYtd).toBe(21)
    await resultat(await abattages.DELETE(request(`/api/elevage/abattages?id=${abat.id}`, undefined, 'DELETE')))
    expect.soft((await db.lotAnimaux.findUniqueOrThrow({ where: { id: lot.id } })).quantiteActuelle).toBe(4)
    expect.soft((await getKpiCompta(farm.user.id, 2026)).revenusYtd).toBe(0)
    expect.soft((await resultat(await dashboard.GET(request('/api/elevage/stats?annee=2026')))).stats).toMatchObject({ animauxTotal: 14, abattagesAnnee: 0, poidsCarcasseAnnee: 0, fcr: null })
  })

  it('rapproche miel en grammes et kilos, FIFO, recettes et retour de stock sans additionner des unités différentes', async () => {
    const farm = await ferme()
    const espece = await db.especeAnimale.create({ data: { id: `abeille_qa_${randomUUID()}`, userId: farm.user.id, nom: 'Ruche QA', type: 'Apiculture', production: 'miel' } })
    const lot = await db.lotAnimaux.create({ data: { userId: farm.user.id, especeAnimaleId: espece.id, nom: 'Ruche témoin', quantiteInitiale: 1, quantiteActuelle: 1 } })
    const recoltes = await import('@/app/api/elevage/production-ruche/route')
    await resultat(await recoltes.POST(request('/api/elevage/production-ruche', { date: '2026-10-27', lotId: lot.id, produit: 'miel', quantite: 500, unite: 'g' })), 201)
    await resultat(await recoltes.POST(request('/api/elevage/production-ruche', { date: '2026-10-27', lotId: lot.id, produit: 'miel', quantite: 1.5, unite: 'kg' })), 201)
    const ventes = await import('@/app/api/elevage/ventes/route')
    const a = (await resultat(await ventes.POST(request('/api/elevage/ventes', { date: '2026-10-27', type: 'miel', quantite: 750, unite: 'g', prixUnitaire: 0.012, paye: false, modeReglement: 'Virement' })), 201)).data
    const b = (await resultat(await ventes.POST(request('/api/elevage/ventes', { date: '2026-10-27', type: 'miel', quantite: 0.25, unite: 'kg', prixUnitaire: 12, paye: true, modeReglement: 'Espèces' })), 201)).data
    const { calculerStocksRuche } = await import('@/lib/elevage/stock-ruche')
    const stock = async () => calculerStocksRuche(await db.productionRuche.findMany({ where: { userId: farm.user.id }, include: { mouvementsStock: true } }))[0]
    expect.soft(await stock()).toMatchObject({ produit: 'miel', unite: 'kg', quantiteProduite: 2, sorti: 1, disponible: 1 })
    const stats = (await resultat(await ventes.GET(request('/api/elevage/ventes?annee=2026')))).stats
    expect.soft(stats.totalVentes).toBe(12)
    expect.soft(stats.parType.find((v: { type: string }) => v.type === 'miel')).toMatchObject({ quantite: null, quantiteParUnite: { g: 750, kg: 0.25 }, total: 12, count: 2 })
    const { getKpiCompta } = await import('@/lib/kpi/compta')
    expect.soft((await getKpiCompta(farm.user.id, 2026)).revenusYtd).toBe(12)
    await resultat(await ventes.DELETE(request(`/api/elevage/ventes?id=${a.id}`, undefined, 'DELETE')))
    expect.soft((await stock()).disponible).toBe(1.75)
    await resultat(await ventes.DELETE(request(`/api/elevage/ventes?id=${b.id}`, undefined, 'DELETE')))
    expect.soft((await stock()).disponible).toBe(2)
    expect.soft((await getKpiCompta(farm.user.id, 2026)).revenusYtd).toBe(0)
  })

  it('rapproche les calculs lait/fromage, les coûts individuels, les ventes et la paie du lait', async () => {
    const farm = await ferme()
    const bovin = await db.especeAnimale.create({ data: { id: `vache_qa_${randomUUID()}`, userId: farm.user.id, nom: 'Vache laitière QA', type: 'Bovin', production: 'lait' } })
    const vache = await db.animal.create({ data: { userId: farm.user.id, especeAnimaleId: bovin.id, sexe: 'femelle', dateNaissance: new Date('2022-01-01'), dateArrivee: new Date('2026-01-01') } })
    const aliment = await db.aliment.create({ data: { id: `qa-${randomUUID()}`, ownerUserId: farm.user.id, origine: 'prive', nom: 'Ration QA', prix: 7 } })
    await db.userStockAliment.create({ data: { userId: farm.user.id, alimentId: aliment.id, stock: 100, prix: 2, coutUnitaire: 2 } })
    await db.consommationAliment.createMany({ data: [
      { userId: farm.user.id, alimentId: aliment.id, animalId: vache.id, date: new Date('2026-10-21'), quantite: 10 },
      { userId: farm.user.id, alimentId: aliment.id, animalId: farm.mere.id, date: new Date('2026-10-21'), quantite: 2 },
      { userId: farm.user.id, alimentId: aliment.id, date: new Date('2026-10-21'), quantite: 11 },
    ] })
    await db.soinAnimal.create({ data: { userId: farm.user.id, animalId: vache.id, date: new Date('2026-10-21'), type: 'Autre', fait: true, cout: 3 } })
    const fromage = await db.lotFromage.create({ data: { userId: farm.user.id, numeroLot: `QA-${randomUUID()}`, dateFabrication: new Date('2026-10-21'), typeFromage: 'Tomme QA', volumeLaitUtiliseL: 10, poidsTotalKg: 1, nbPieces: 2, etat: 'pret' } })
    await db.collecteLait.createMany({ data: [
      { userId: farm.user.id, animalId: vache.id, traite: 'Unique', date: new Date('2026-10-20'), quantiteLitres: 10, lotFromageId: fromage.id },
      { userId: farm.user.id, animalId: vache.id, traite: 'Unique', date: new Date('2026-10-21'), quantiteLitres: 20 },
      { userId: farm.user.id, animalId: vache.id, traite: 'Unique', date: new Date('2026-10-22'), quantiteLitres: 4, ecarteAttente: true },
    ] })
    const ventes = await import('@/app/api/elevage/ventes/route')
    await resultat(await ventes.POST(request('/api/elevage/ventes', { date: '2026-10-27', type: 'lait', quantite: 5, unite: 'L', prixUnitaire: 2, paye: true, modeReglement: 'Espèces' })), 201)
    await resultat(await ventes.POST(request('/api/elevage/ventes', { date: '2026-10-27', type: 'fromage', quantite: 1, unite: 'pièce', prixUnitaire: 6, paye: true, lotFromageId: fromage.id, modeReglement: 'CB' })), 201)
    const paies = await import('@/app/api/elevage/paies-lait/route')
    const paie = { annee: 2026, mois: 10, litres: 10, prixBaseMille: 1000 }
    await resultat(await paies.POST(request('/api/elevage/paies-lait', paie)), 201)
    await resultat(await paies.POST(request('/api/elevage/paies-lait', paie)), 201)
    expect.soft(await db.venteManuelle.count({ where: { userId: farm.user.id, sourceType: 'paie_lait' } })).toBe(1)
    const economie = await import('@/app/api/elevage/economie-lait/route')
    const eco = await resultat(await economie.GET(request('/api/elevage/economie-lait?annee=2026')))
    expect.soft(eco.production).toMatchObject({ litresProduits: 34, litresTransformes: 10, litresVendusCru: 5, litresLivres: 10, litresEcartes: 4, kgFromage: 1 })
    expect.soft(eco.couts).toMatchObject({ alimentaire: 22, sanitaire: 3 })
    expect.soft(eco.valorisation).toMatchObject({ laitCru: 10, fromage: 6, laitLivre: 10.55 })
    expect.soft(eco.methode).toMatchObject({ tetesLaitieres: 1, tetesTotales: 11, partGlobaleLaitiere: 0.091 })
    expect.soft(eco.indicateurs).toMatchObject({ valorisation: 26.55, coutTotal: 25, marge: 1.55, mca: 4.55, mcaPour1000L: 151.67, coutAlimentaireLitre: 0.733, coutRevientLitre: 0.833, prixMoyenLitreValorise: 0.885, rendementFromager: 0.1, litresParKgFromage: 10, coutRevientKgFromage: 8.33 })
    expect.soft(eco.fromages[0]).toMatchObject({ type: 'Tomme QA', volumeLaitL: 10, kg: 1, pieces: 2, rendementKgParL: 0.1, litresParKg: 10, ca: 6, prixMoyenKg: 12 })
    const { getKpiCompta } = await import('@/lib/kpi/compta')
    expect.soft((await getKpiCompta(farm.user.id, 2026)).revenusYtd).toBe(26.55)
  })

  it('vérifie les effectifs, ponte, stock, coûts, vente, impayé, TVA, bénéfice et FEC sur le même troupeau', async () => {
    const farm = await ferme(); const n = await naissance(farm)
    const fiches = await import('@/app/api/elevage/naissances/[id]/fiches/route')
    await resultat(await fiches.POST(request(`/api/elevage/naissances/${n.id}/fiches`, {}, 'POST'), { params: Promise.resolve({ id: String(n.id) }) }), 201)
    const petit = await db.animal.findFirstOrThrow({ where: { userId: farm.user.id, provenance: 'Naissance', sexe: 'male' } })
    const animaux = await import('@/app/api/elevage/animaux/route')
    await resultat(await animaux.PATCH(request('/api/elevage/animaux', { id: petit.id, statut: 'mort', dateSortie: '2026-10-20', causeSortie: 'Cause QA' }, 'PATCH')))
    const auto = await import('@/lib/auto-compta')
    await auto.createDepenseFromLotAnimaux(farm.user.id, farm.lot)
    const achat = await db.depenseManuelle.findFirstOrThrow({ where: { userId: farm.user.id, sourceType: 'achat_animal' } })
    await db.depenseManuelle.update({ where: { id: achat.id }, data: { paye: false, modeReglement: 'Virement' } })
    const aliment = await db.aliment.create({ data: { id: `qa-${randomUUID()}`, ownerUserId: farm.user.id, origine: 'prive', nom: 'Aliment QA', prix: 0.5 } })
    await db.userStockAliment.create({ data: { userId: farm.user.id, alimentId: aliment.id, stock: 100, stockMin: 90, prix: 0.5, coutUnitaire: 0.5 } })
    const consommations = await import('@/app/api/elevage/consommations-aliments/route')
    await resultat(await consommations.POST(request('/api/elevage/consommations-aliments', { lotId: farm.lot.id, alimentId: aliment.id, date: '2026-10-21', quantite: 20 })), 201)
    const alimentation = await db.userStockAliment.findFirstOrThrow({ where: { userId: farm.user.id, alimentId: aliment.id } })
    expect.soft(alimentation.stock).toBe(80)
    await db.depenseManuelle.create({ data: { userId: farm.user.id, categorie: 'aliments', description: 'Facture fournisseur QA', date: new Date('2026-10-21'), montant: 12, montantHT: 10, montantTVA: 2, tauxTVA: 20, paye: true, modeReglement: 'CB' } })
    const soins = await import('@/app/api/elevage/soins/route')
    await resultat(await soins.POST(request('/api/elevage/soins', { lotId: farm.lot.id, date: '2026-10-21', type: 'Autre', fait: true, cout: 4 })), 201)
    const ponte = await import('@/app/api/elevage/production-oeufs/route')
    for (let jour = 21; jour <= 27; jour++) {
      await resultat(await ponte.POST(request('/api/elevage/production-oeufs', { lotId: farm.lot.id, date: `2026-10-${jour}`, quantite: 9, casses: jour === 27 ? 1 : 0, sales: jour === 27 ? 1 : 0 })), 201)
    }
    const ventes = await import('@/app/api/elevage/ventes/route')
    const vente = (await resultat(await ventes.POST(request('/api/elevage/ventes', { date: '2026-10-27', type: 'oeufs', description: 'Vente des œufs QA', quantite: 2, unite: 'douzaine', prixUnitaire: 3, paye: false, modeReglement: 'Chèque' })), 201)).data
    const dashboard = await import('@/app/api/elevage/stats/route')
    const { stats, animauxParType } = await resultat(await dashboard.GET(request('/api/elevage/stats?annee=2026')))
    expect.soft(stats).toMatchObject({ animauxActifs: 4, animauxHorsLot: 0, animauxRattachesLots: 4, lotsActifs: 1, animauxEnLots: 12, animauxTotal: 12, productionOeufsAnnee: 63, productionOeufsAnneePrecedente: 0, ventesAnnee: 6, ventesAnneePrecedente: 0, nbVentes: 1, stockOeufs: 37, stockOeufsCommercialisables: 37, nbPondeuses: 9, nbOeufsPeriode7j: 63, tauxPonte: 100, tauxPonteSaisonAttendu: 40, tauxPonteRatio: 2.5, alimentsStockBas: 1, consoAlimentsKg: 20, mortaliteAnnee: 1, tauxMortalite: 20, fcr: null, laitTotalAnnee: 0, nbCollectesAnnee: 0 })
    expect.soft(animauxParType.reduce((s: number, e: { count: number }) => s + e.count, 0)).toBe(12)
    const economie = await import('@/app/api/elevage/analyse-couts/route')
    const eco = await resultat(await economie.GET(request('/api/elevage/analyse-couts?annee=2026')))
    expect.soft(eco.stats).toMatchObject({ totalCouts: 119.5, totalRevenus: 6, margeGlobale: -113.5 })
    const atelier = eco.ateliers.find((a: { code: string }) => a.code === farm.espece.id)
    expect.soft(atelier).toMatchObject({ effectif: 12, couts: { achat: 105.5, soins: 4, alimentation: 10, total: 119.5 }, production: { oeufs: 63 }, metriques: { coutParOeuf: 1.897 } })
    const { getKpiCompta } = await import('@/lib/kpi/compta')
    const kpi = await getKpiCompta(farm.user.id, 2026)
    expect.soft(kpi).toMatchObject({ revenusYtd: 6, depensesYtd: 117.5, beneficeYtd: -111.5 })
    const tva = await import('@/lib/kpi/tva')
    const detailTva = await tva.computeTvaPeriode(farm.user.id, new Date('2026-01-01'), new Date('2027-01-01'))
    expect.soft(detailTva).toMatchObject({ collectee: { total: 0.31 }, deductible: { total: 7.5 }, solde: { creditTVA: 7.19, tvaAPayer: 0 } })
    const mortalites = await import('@/app/api/elevage/mortalites/route')
    expect.soft((await resultat(await mortalites.GET(request('/api/elevage/mortalites?annee=2026')))).stats).toMatchObject({ total: 1, tauxMortalite: 20 })
    const impayees = await import('@/lib/comptabilite/impayees')
    const miroirs = await db.venteManuelle.findMany({ where: { userId: farm.user.id, paye: false } })
    expect.soft(impayees.construireImpayees({ ventes: [vente], ventesManuelles: miroirs.map((m) => ({ ...m, date: m.date.toISOString() })) }).total).toBe(6)
    const fec = await import('@/app/api/comptabilite/export/fec/route')
    const controle = await resultat(await fec.GET(request('/api/comptabilite/export/fec?exercice=2026&check=1')))
    expect.soft(controle.validation.equilibre).toBe(true)
    expect.soft(controle.ventilation).toMatchObject({ ventes: 0, factures: 0, depenses: 2 })
  })
})
