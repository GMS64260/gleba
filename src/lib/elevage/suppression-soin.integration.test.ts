/**
 * Contre-revue CR-SOI-01 (2026-11-12), concurrence réelle sur PostgreSQL : un
 * soin lu « planifié » était supprimé sans nature, motif ni journal alors
 * qu'une autre requête venait de l'administrer. Règlement (UE) 2019/6,
 * art. 108 ; arrêté du 5 juin 2000, art. 7 et 11.
 *
 * Ordonnancement déterministe, avec les deux vraies routes : une transaction
 * témoin tient le verrou des écritures de soins ; l'administration (PATCH
 * `fait: true`) puis la suppression (DELETE sans motif) se mettent en file
 * derrière lui, dans cet ordre ; le verrou relâché, PostgreSQL les sert dans
 * l'ordre d'arrivée. La suppression décide donc APRÈS l'administration.
 *
 * Base jetable du banc uniquement : lancer avec DATABASE_URL = TEST_DATABASE_URL
 * (base `gleba_tests`), sinon la suite est ignorée.
 *
 *   DATABASE_URL="$TEST_DATABASE_URL" lourd node node_modules/vitest/vitest.mjs run \
 *     src/lib/elevage/suppression-soin.integration.test.ts \
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
import { DELETE as supprimerRoute, PATCH as modifierRoute } from '@/app/api/elevage/soins/route'
import { verrouillerReglements } from '@/lib/comptabilite/verrou-reglements'

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

describe.skipIf(!active)('CR-SOI-01 : suppression d’un soin administré entre la lecture et la suppression', () => {
  afterAll(async () => { await prisma.$disconnect() })

  async function soinPlanifie() {
    const userId = randomUUID()
    identite.userId = userId
    await prisma.user.create({ data: { id: userId, email: `${userId}@example.invalid` } })
    const espece = await prisma.especeAnimale.create({
      data: { id: `brebis_test_${userId.slice(0, 8)}`, nom: 'Brebis de test', type: 'mammifere_petit', production: 'lait' },
    })
    const animal = await prisma.animal.create({ data: { userId, especeAnimaleId: espece.id, nom: 'Brebis fictive' } })
    const soin = await prisma.soinAnimal.create({
      data: {
        userId, animalId: animal.id, type: 'Traitement', produit: 'Antibiotique fictif',
        fait: false, date: new Date('2026-11-12T08:00:00Z'), datePrevue: new Date('2026-11-12T08:00:00Z'),
        // ADV88 : sans médicament de la pharmacie, le passage à « fait » exige
        // les délais prescrits (viande, et lait pour cette brebis laitière).
        tempsAttenteViandeJ: 3, tempsAttenteLaitJ: 3, delaiAttenteSource: 'prescription',
      },
    })
    return { userId, soin }
  }
  const administrer = (id: number) =>
    modifierRoute(new NextRequest('http://localhost/api/elevage/soins', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, fait: true }),
    }))
  const supprimer = (id: number, corps?: object) =>
    supprimerRoute(new NextRequest(`http://localhost/api/elevage/soins?id=${id}`, {
      method: 'DELETE', ...(corps ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) } : {}),
    }))

  it('la suppression mise en file derrière l’administration exige motif et journal ; motivée, elle journalise l’original', async () => {
    const { userId, soin } = await soinPlanifie()

    // Témoin : tient le verrou tant que la porte n'est pas ouverte.
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

    // 1. L'administration arrive : elle attend le verrou, le soin est encore « à faire ».
    const administration = administrer(soin.id)
    await attendreFile(1)
    // 2. La suppression sans motif arrive ensuite : elle lit encore un soin planifié.
    const suppression = supprimer(soin.id)
    await attendreFile(2)
    expect((await prisma.soinAnimal.findUniqueOrThrow({ where: { id: soin.id } })).fait).toBe(false)

    ouvrir()
    await temoin
    const [reponseAdministration, reponseSuppression] = await Promise.all([administration, suppression])

    // L'acte a été administré, puis la suppression a décidé sous le verrou.
    expect(reponseAdministration.status).toBe(200)
    expect(reponseSuppression.status).toBe(409)
    expect(await reponseSuppression.json()).toMatchObject({ code: 'ANNULATION_MOTIVEE_REQUISE' })
    expect(await prisma.soinAnimal.findUnique({ where: { id: soin.id } })).toMatchObject({ fait: true })
    expect(await prisma.annulationSoinAnimal.count({ where: { userId } })).toBe(0)

    // « Administré » déclaré : l'acte reste, toujours sans journal.
    const conserve = await supprimer(soin.id, { annulation: { nature: 'administre', motif: 'doublon' } })
    expect(conserve.status).toBe(409)
    expect(await conserve.json()).toMatchObject({ code: 'SOIN_ADMINISTRE_CONSERVE' })
    expect(await prisma.soinAnimal.count({ where: { id: soin.id } })).toBe(1)

    // Erreur de saisie motivée : l'original est journalisé, puis le soin effacé.
    const motivee = await supprimer(soin.id, { annulation: { nature: 'erreur_saisie', motif: 'Soin saisi sur la mauvaise brebis' } })
    expect(motivee.status).toBe(200)
    expect(await prisma.soinAnimal.count({ where: { id: soin.id } })).toBe(0)
    const journal = await prisma.annulationSoinAnimal.findMany({ where: { userId } })
    expect(journal).toHaveLength(1)
    expect(journal[0]).toMatchObject({
      soinIdOrigine: soin.id, action: 'suppression', nature: 'erreur_saisie',
      motif: 'Soin saisi sur la mauvaise brebis', acteurId: userId,
    })
    expect(JSON.stringify(journal[0].instantane)).toContain('Antibiotique fictif')
  })

  it('un soin resté planifié se supprime sans motif ni journal', async () => {
    const { userId, soin } = await soinPlanifie()
    expect((await supprimer(soin.id)).status).toBe(200)
    expect(await prisma.soinAnimal.count({ where: { id: soin.id } })).toBe(0)
    expect(await prisma.annulationSoinAnimal.count({ where: { userId } })).toBe(0)
  })

  it('le soin d’un autre compte n’est ni lu ni supprimé', async () => {
    const { soin } = await soinPlanifie()
    const intrus = randomUUID()
    await prisma.user.create({ data: { id: intrus, email: `${intrus}@example.invalid` } })
    identite.userId = intrus
    expect((await supprimer(soin.id)).status).toBe(404)
    expect(await prisma.soinAnimal.count({ where: { id: soin.id } })).toBe(1)
  })
})
