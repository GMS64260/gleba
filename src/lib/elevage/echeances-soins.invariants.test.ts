import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { todayLocalISO } from '@/lib/format-utils'
import { jourLocalISO } from '@/lib/jour-civil'
import { echeanceDuJour, etatEcheance } from '@/lib/accueil/elevage'
import {
  classerEcheanceSoin,
  compterEcheancesSoins,
  jourCivil,
  joursAvantEcheance,
} from './echeances-soins'

const mocks = vi.hoisted(() => ({ soins: vi.fn(), injections: vi.fn() }))
vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: vi.fn().mockResolvedValue({ session: { user: { id: 'ferme-test' } }, error: null }),
}))
vi.mock('@/lib/elevage/attentes-query', () => ({ chargerAttentesConsolidees: vi.fn().mockResolvedValue([]) }))
vi.mock('@/lib/elevage/fenetre-mise-bas', () => ({ chargerFenetresMiseBas: vi.fn().mockResolvedValue([]) }))
vi.mock('@/lib/prisma', () => ({
  default: {
    soinAnimal: { findMany: mocks.soins },
    $queryRaw: mocks.injections,
    saillie: { findMany: vi.fn().mockResolvedValue([]) },
    userStockAliment: { findMany: vi.fn().mockResolvedValue([]) },
    stockMedicamentElevage: { findMany: vi.fn().mockResolvedValue([]) },
    prophylaxieElevage: { findMany: vi.fn().mockResolvedValue([]) },
    tacheTerrainElevage: { findMany: vi.fn().mockResolvedValue([]) },
    echeanceAdministrativeElevage: { findMany: vi.fn().mockResolvedValue([]) },
    productionOeuf: { findMany: vi.fn().mockResolvedValue([]) },
    consommationAliment: { findMany: vi.fn().mockResolvedValue([]) },
    lotAnimaux: { findMany: vi.fn().mockResolvedValue([]) },
    animal: { count: vi.fn().mockResolvedValue(0) },
  },
}))

import { chargerAgendaElevage, type AgendaElevage } from './agenda.server'
import { GET as agendaGET } from '@/app/api/elevage/agenda/route'
import { GET as tachesGET } from '@/app/api/elevage/taches/route'

const GRAINE = 0x20261118
const NB_DATES = 420

function datesGenerees(): Date[] {
  let etat = GRAINE
  const tirer = () => {
    etat = (Math.imul(1664525, etat) + 1013904223) >>> 0
    return etat
  }
  const jours = new Set<number>()
  const dates: Date[] = []
  while (dates.length < NB_DATES) {
    const jour = tirer() % 7305
    if (jours.has(jour)) continue
    jours.add(jour)
    const date = new Date(Date.UTC(2020, 0, 1 + jour))
    const finDeJour = (tirer() >>> 16) % 2 === 0
    dates.push(new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), finDeJour ? 23 : 0, finDeJour ? 59 : 1))
  }
  return dates
}

function dateLocale(now: Date, decalage: number, heure: number, minute: number): Date {
  // Le constructeur civil traverse les jours de 23 h et de 25 h sans ajouter 24 h.
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + decalage, heure, minute)
}

async function verifierSurfaces(now: Date) {
  vi.setSystemTime(now)
  const jour = todayLocalISO() // Référence utilisée par le dashboard.
  expect(jourCivil(now)).toBe(jour)
  const cas = [
    { decalage: -1, date: dateLocale(now, -1, 23, 55) },
    { decalage: 0, date: dateLocale(now, 0, 0, 5) },
    { decalage: 0, date: dateLocale(now, 0, 23, 55) },
    { decalage: 1, date: dateLocale(now, 1, 0, 5) },
  ]
  const soins = cas.map(({ date }, index) => ({
    id: index + 1, date, datePrevue: date, type: 'Vaccination', fait: false,
    description: null, produit: null, dose: null, voie: null, cout: null,
    finAttenteLait: null, finAttenteOeufs: null, finAttenteViande: null,
    animal: null, lot: { id: 1, nom: 'Lot test' },
  }))
  const injections = cas.map(({ date }, index) => ({
    id: `i-${index}`, injectionId: `i-${index}`, soinId: 100 + index,
    numero: 2, nombreInjections: 2, datePrevue: date, dateRealisee: null, statut: 'a_faire',
    type: 'Vaccination', description: null, produit: null, dose: null, voie: null, cout: null,
    finAttenteLait: null, finAttenteOeufs: null, finAttenteViande: null,
    animalId: null, animalNom: null, animalIdentifiant: null, lotId: 1, lotNom: 'Lot test',
  }))
  const avant = JSON.stringify({ soins, injections })
  mocks.soins.mockResolvedValue(soins)
  mocks.injections.mockResolvedValue(injections)

  // Composition de l'accueil puis réponse réellement servie au Calendrier et à la Tournée.
  // Les lectures de base et la session sont simulées ; aucun calcul de date ne l'est.
  const agenda = await chargerAgendaElevage('ferme-test', { maintenant: now })
  const reponseAgenda = await agendaGET(new NextRequest('http://localhost/api/elevage/agenda?jours=21'))
  expect(reponseAgenda.status).toBe(200)
  const calendrierAgenda = await reponseAgenda.json() as AgendaElevage
  expect(calendrierAgenda).toEqual(agenda)

  const params = new URLSearchParams({
    start: dateLocale(now, -2, 0, 0).toISOString(),
    end: dateLocale(now, 2, 23, 59).toISOString(),
    retards: '1',
  })
  const reponseTaches = await tachesGET(new NextRequest(`http://localhost/api/elevage/taches?${params}`))
  expect(reponseTaches.status).toBe(200)
  const calendrier = await reponseTaches.json() as {
    soins: { id: number; injectionId: string | null; date: string; datePrevue: string }[]
    stats: { soinsRestants: number; echeancesSoins: ReturnType<typeof compterEcheancesSoins> }
  }
  expect(calendrier.soins).toHaveLength(8)
  expect(calendrier.stats.soinsRestants).toBe(8)
  expect(calendrier.stats.echeancesSoins).toEqual({ total: 8, enRetard: 2, aVenir: 6, auDela: 0, horizonJours: 30 })
  expect(compterEcheancesSoins(calendrier.soins.map((s) => s.datePrevue), jour)).toEqual(calendrier.stats.echeancesSoins)
  expect(agenda.counts).toMatchObject({ total: 8, soins: 8, urgent: 2 })

  for (const [index, { decalage, date }] of cas.entries()) {
    expect(joursAvantEcheance(date, jour)).toBe(decalage)
    expect(joursAvantEcheance(date.toISOString(), jour)).toBe(decalage)
    expect(classerEcheanceSoin(date, jour)).toBe(decalage < 0 ? 'en_retard' : 'a_venir')
    for (const injection of [false, true]) {
      const id = injection ? `injection-i-${index}` : `soin-${index + 1}`
      const ligne = agenda.echeances.find((e) => e.id === id)!
      expect(ligne, id).toMatchObject({
        kind: decalage < 0 ? 'soin_retard' : 'soin_planifie',
        joursRestants: decalage,
        gravite: decalage < 0 ? 'urgent' : injection ? 'attention' : 'info',
        date: date.toISOString(),
        action: injection ? { soinId: 100 + index, injectionId: `i-${index}` } : { soinId: index + 1 },
      })
      expect(echeanceDuJour(ligne)).toBe(decalage <= 0)
      expect(etatEcheance(ligne)).toBe(decalage < 0 ? 'critique' : injection ? 'attention' : 'info')
      const tache = calendrier.soins.find((s) => injection ? s.injectionId === `i-${index}` : s.id === index + 1)!
      expect(tache.date).toBe(date.toISOString())
      // Même case de la grille locale du calendrier, même retard dans le dashboard.
      expect(jourLocalISO(new Date(tache.date))).toBe(jourCivil(date))
      expect(classerEcheanceSoin(tache.datePrevue, jour) === 'en_retard').toBe(ligne.kind === 'soin_retard')
    }
  }
  expect(JSON.stringify({ soins, injections })).toBe(avant)
}

describe('soins et injections : agenda, accueil, dashboard et calendrier au même jour civil', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  // Instants explicites autour du minuit parisien et des deux changements d'heure.
  // Les attendus suivent le jour local du processus, comme les écrans : exécuter
  // ce fichier sous TZ=UTC puis TZ=Europe/Paris, sans changer TZ dans les tests.
  it.each([
    '2026-01-14T23:59:00+01:00', '2026-01-15T00:01:00+01:00',
    '2026-07-14T23:59:00+02:00', '2026-07-15T00:01:00+02:00',
    '2026-03-28T23:59:00+01:00', '2026-03-29T00:01:00+01:00',
    '2026-03-29T01:59:00+01:00', '2026-03-29T03:01:00+02:00',
    '2026-03-29T23:59:00+02:00', '2026-03-30T00:01:00+02:00',
    '2026-10-24T23:59:00+02:00', '2026-10-25T00:01:00+02:00',
    '2026-10-25T02:59:00+02:00', '2026-10-25T02:01:00+01:00',
    '2026-10-25T23:59:00+01:00', '2026-10-26T00:01:00+01:00',
    '2028-02-29T00:01:00+01:00', '2026-12-31T23:59:00+01:00',
  ])('hier en retard, aujourd’hui J0, demain à venir à %s', async (instant) => {
    await verifierSurfaces(new Date(instant))
  })

  it(`invariants sur ${NB_DATES} dates distinctes, graine fixe 0x${GRAINE.toString(16)}`, async () => {
    const dates = datesGenerees()
    expect(new Set(dates.map((d) => jourLocalISO(d))).size).toBe(NB_DATES)
    for (const [index, now] of dates.entries()) {
      await verifierSurfaces(now)
      const jour = jourLocalISO(now)
      const horizon = 1 + index % 90
      const echeances = [-1, 0, 1, horizon, horizon + 1].map((decalage) => dateLocale(now, decalage, 12, 0))
      expect(echeances.map((d) => joursAvantEcheance(d, jour))).toEqual([-1, 0, 1, horizon, horizon + 1])
      expect(echeances.map((d) => classerEcheanceSoin(d, jour, horizon))).toEqual(['en_retard', 'a_venir', 'a_venir', 'a_venir', 'au_dela'])
      expect(compterEcheancesSoins(echeances, jour, horizon)).toEqual({ total: 5, enRetard: 1, aVenir: 3, auDela: 1, horizonJours: horizon })
    }
  }, 30_000)
})
