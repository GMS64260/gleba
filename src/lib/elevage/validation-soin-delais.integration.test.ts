/**
 * ADV88 — revues QA115 / ADV116, concurrence réelle sur PostgreSQL : une
 * validation (PATCH soin `fait: true`, ou injection réalisée) lisait le type,
 * le produit, la cible et les délais AVANT le verrou des écritures de soins.
 * Une correction concurrente (type devenu médicamenteux, délai retiré) qui
 * aboutissait entre-temps laissait passer le soin à « fait » sans délai
 * d'attente viande : l'animal restait abattable.
 *
 * Ordonnancement déterministe, avec les vraies routes : une transaction témoin
 * tient le verrou ; la validation passe le refus anticipé (le soin lu est
 * conforme) puis se met en file ; la correction concurrente est validée en
 * base ; le verrou relâché, la validation doit relire le soin et refuser
 * (422 DELAIS_ATTENTE_REQUIS) sans rien écrire.
 *
 * Base jetable du banc uniquement : lancer avec DATABASE_URL = TEST_DATABASE_URL
 * (base `gleba_tests`), sinon la suite est ignorée.
 *
 *   DATABASE_URL="$TEST_DATABASE_URL" lourd node node_modules/vitest/vitest.mjs run \
 *     src/lib/elevage/validation-soin-delais.integration.test.ts \
 *     --pool=threads --poolOptions.threads.singleThread --testTimeout=30000
 */
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { afterAll, describe, expect, it, vi } from 'vitest'

const identite = vi.hoisted(() => ({ userId: '' }))
vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({
    error: null,
    session: { user: { id: identite.userId, acteurId: identite.userId, peutEcrireExploitation: true, estProprietaireExploitation: true } },
  }),
}))

import prisma from '@/lib/prisma'
import { PATCH as modifierSoin } from '@/app/api/elevage/soins/route'
import { PATCH as modifierInjection } from '@/app/api/elevage/soins/[id]/injections/route'
import { verrouillerReglements } from '@/lib/comptabilite/verrou-reglements'
import { lireInjections, synchroniserInjections } from '@/lib/elevage/injections-protocole'

const url = process.env.DATABASE_URL
const active = !!url && url === process.env.TEST_DATABASE_URL && new URL(url).pathname === '/gleba_tests'

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Nombre de sessions en attente d'un verrou consultatif (base de tests, suite en file unique). */
async function enAttenteDuVerrou(): Promise<number> {
  const [{ n }] = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM pg_locks WHERE locktype = 'advisory' AND NOT granted AND database = (SELECT oid FROM pg_database WHERE datname = current_database())`
  return Number(n)
}
async function attendreFile(taille: number) {
  for (let i = 0; i < 100; i++) {
    if ((await enAttenteDuVerrou()) >= taille) return
    await pause(50)
  }
  throw new Error(`File d'attente du verrou jamais atteinte (${taille})`)
}

const DATE_SOIN = new Date('2026-11-12T08:00:00Z')
type Surface = 'patch-soin' | 'patch-injection'

describe.skipIf(!active)('ADV88 : correction concurrente avant le verrou d’une validation de soin (PostgreSQL)', () => {
  afterAll(async () => { await prisma.$disconnect() })

  async function soinPlanifie(extra: { type: string; tempsAttenteViandeJ?: number | null }) {
    const userId = randomUUID()
    identite.userId = userId
    await prisma.user.create({ data: { id: userId, email: `${userId}@example.invalid` } })
    const espece = await prisma.especeAnimale.create({
      data: { id: `bovin_test_${userId.slice(0, 8)}`, nom: 'Bovin de test', type: 'mammifere_grand', production: 'viande' },
    })
    const animal = await prisma.animal.create({
      data: { userId, especeAnimaleId: espece.id, nom: 'Taurillon fictif', sexe: 'male', orientationProduction: 'viande' },
    })
    const soin = await prisma.soinAnimal.create({
      data: { userId, animalId: animal.id, fait: false, date: DATE_SOIN, datePrevue: DATE_SOIN, ...extra },
    })
    await synchroniserInjections(prisma, userId, soin.id, { debut: DATE_SOIN, nombre: 1, intervalleHeures: null }, {
      calendrierChange: false, marquerPremiereFaite: false, rouvrirPremiere: false, dateRealiseePremiere: DATE_SOIN,
    })
    const [injection] = await lireInjections(prisma, userId, soin.id)
    return { userId, soin, injection }
  }

  function valider(surface: Surface, soinId: number, injectionId: string) {
    if (surface === 'patch-soin') {
      return modifierSoin(new NextRequest('http://localhost/api/elevage/soins', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: soinId, fait: true }),
      }))
    }
    return modifierInjection(new NextRequest(`http://localhost/api/elevage/soins/${soinId}/injections`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ injectionId, statut: 'realisee', dateRealisee: DATE_SOIN.toISOString() }),
    }), { params: Promise.resolve({ id: String(soinId) }) })
  }

  /** La validation se met en file derrière le témoin ; `corriger` aboutit pendant l'attente. */
  async function validerPendantCorrection(surface: Surface, userId: string, soinId: number, injectionId: string, corriger: () => Promise<unknown>) {
    let ouvrir!: () => void
    const porte = new Promise<void>((resolve) => { ouvrir = resolve })
    let verrouTenu!: () => void
    const tenu = new Promise<void>((resolve) => { verrouTenu = resolve })
    const temoin = prisma.$transaction(async (tx) => {
      await verrouillerReglements(tx, userId)
      verrouTenu()
      await porte
    }, { timeout: 25_000, maxWait: 10_000 })
    await tenu
    const validation = valider(surface, soinId, injectionId)
    await attendreFile(1)
    await corriger()
    ouvrir()
    await temoin
    return validation
  }

  async function rienEcrit(userId: string, soinId: number) {
    expect(await prisma.soinAnimal.findUniqueOrThrow({ where: { id: soinId } })).toMatchObject({
      fait: false, finAttenteViande: null, tempsAttenteViandeJ: null,
    })
    expect((await lireInjections(prisma, userId, soinId)).map((i) => i.statut)).toEqual(['a_faire'])
  }

  it.each<Surface>(['patch-soin', 'patch-injection'])('%s : type corrigé de Tonte en Traitement vétérinaire pendant l’attente → 422, rien d’écrit', async (surface) => {
    const { userId, soin, injection } = await soinPlanifie({ type: 'Tonte' })
    const reponse = await validerPendantCorrection(surface, userId, soin.id, injection.id, () =>
      prisma.soinAnimal.update({ where: { id: soin.id }, data: { type: 'Traitement vétérinaire' } }))
    expect(reponse.status).toBe(422)
    expect(await reponse.json()).toMatchObject({ code: 'DELAIS_ATTENTE_REQUIS', delaisManquants: ['viande'] })
    await rienEcrit(userId, soin.id)
  })

  it.each<Surface>(['patch-soin', 'patch-injection'])('%s : délai viande retiré pendant l’attente → 422, rien d’écrit', async (surface) => {
    const { userId, soin, injection } = await soinPlanifie({ type: 'Traitement vétérinaire', tempsAttenteViandeJ: 3 })
    const reponse = await validerPendantCorrection(surface, userId, soin.id, injection.id, () =>
      prisma.soinAnimal.update({ where: { id: soin.id }, data: { tempsAttenteViandeJ: null } }))
    expect(reponse.status).toBe(422)
    expect(await reponse.json()).toMatchObject({ code: 'DELAIS_ATTENTE_REQUIS', delaisManquants: ['viande'] })
    await rienEcrit(userId, soin.id)
  })

  it.each<Surface>(['patch-soin', 'patch-injection'])('%s : délai viande corrigé de 3 à 5 pendant l’attente → validé, fin d’attente sur 5 jours', async (surface) => {
    const { userId, soin, injection } = await soinPlanifie({ type: 'Traitement vétérinaire', tempsAttenteViandeJ: 3 })
    const reponse = await validerPendantCorrection(surface, userId, soin.id, injection.id, () =>
      prisma.soinAnimal.update({ where: { id: soin.id }, data: { tempsAttenteViandeJ: 5 } }))
    expect(reponse.status).toBe(200)
    // Ancrée sur l'administration réelle (PATCH sans date : l'instant de la validation).
    const [administree] = await lireInjections(prisma, userId, soin.id)
    expect(administree.statut).toBe('realisee')
    const apres = await prisma.soinAnimal.findUniqueOrThrow({ where: { id: soin.id } })
    expect(apres).toMatchObject({ fait: true, tempsAttenteViandeJ: 5 })
    expect(apres.finAttenteViande!.getTime() - administree.dateRealisee!.getTime()).toBe(5 * 86_400_000)
  })
})
