/**
 * Contre-revue CR-DAR-01 (tour 2), sur PostgreSQL et par les routes réelles :
 * le parcours « saisie libre d'un traitement à la prêle → récolte ».
 *
 * La recette avait créé par l'interface une « Décoction de prêle » sans délai
 * avant récolte : aucune fiche au référentiel, donc aucune classification, et
 * la récolte du lendemain affichait le régime de l'AMM (défaut de 3 jours).
 * La nature se déclare désormais à la saisie ; le corps ci-dessous est celui
 * du formulaire Interventions (chaînes, champs vides compris).
 *
 * Base jetable du banc uniquement : lancer avec DATABASE_URL = TEST_DATABASE_URL
 * (base `gleba_tests`), sinon la suite est ignorée.
 *
 *   DATABASE_URL="$TEST_DATABASE_URL" lourd node node_modules/vitest/vitest.mjs run \
 *     src/lib/phyto/__tests__/dar-saisie-libre.integration.test.ts \
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
import { PATCH as modifierIntervention, POST as creerIntervention } from '@/app/api/interventions/route'
import { POST as creerRecolte } from '@/app/api/recoltes/route'

const url = process.env.DATABASE_URL
const active = !!url && url === process.env.TEST_DATABASE_URL && new URL(url).pathname === '/gleba_tests'

const json = (methode: string, chemin: string, corps: object) =>
  new NextRequest(`http://localhost${chemin}`, { method: methode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })

describe.skipIf(!active)('CR-DAR-01 : traitement saisi librement, puis récolte', () => {
  afterAll(async () => { await prisma.$disconnect() })

  async function ferme() {
    const userId = randomUUID()
    identite.userId = userId
    await prisma.user.create({ data: { id: userId, email: `${userId}@example.invalid` } })
    const espece = await prisma.espece.create({ data: { userId, nom: 'Carotte de contre-revue', uniteRendement: 'kg_m2' } })
    const culture = await prisma.culture.create({ data: { userId, especeId: espece.id } })
    /** Corps du formulaire Interventions pour un traitement réalisé, DAR laissé vide. */
    const traiter = (champs: Record<string, unknown>) => creerIntervention(json('POST', '/api/interventions', {
      date: '2026-06-09', type: 'traitement_phyto', cultureId: culture.id, plancheId: null, description: '',
      dureeMinutes: 30, nbPersonnes: 1, fait: true,
      produitPhyto: 'Décoction de prêle', natureProduit: '', numAMM: '', cibleTraitement: 'Mildiou',
      doseAppliquee: '2', uniteDose: 'L/ha', surfaceTraitee: '100', dar: '', conditionsMeteo: '',
      ...champs,
    }))
    /** Récolte du lendemain : renvoie les avertissements de la réponse. */
    const recolter = async (date = '2026-06-10') => {
      const reponse = await creerRecolte(json('POST', '/api/recoltes', { especeId: espece.id, cultureId: culture.id, date, quantite: 1 }))
      expect(reponse.status).toBe(201)
      return ((await reponse.json()).warnings ?? []) as string[]
    }
    return { userId, culture, traiter, recolter }
  }

  it('prêle déclarée substance de base, sans délai : la récolte rappelle le délai inconnu, pas l’AMM ni les 3 jours', async () => {
    const f = await ferme()
    const reponse = await f.traiter({ natureProduit: 'substance_base' })
    expect(reponse.status).toBe(201)
    const cree = await reponse.json()
    expect(cree).toMatchObject({ produitPhyto: 'Décoction de prêle', natureProduit: 'substance_base', produitPhytoId: null, dar: null })

    const avertissements = await f.recolter()
    expect(avertissements).toHaveLength(1)
    expect(avertissements[0]).toContain('délai inconnu pour Décoction de prêle')
    expect(avertissements[0]).not.toMatch(/AMM|3 jours/)
  })

  it('même nom sans nature déclarée : produit inconnu, défaut légal de l’AMM (le nom libre ne classe rien)', async () => {
    const f = await ferme()
    expect((await f.traiter({})).status).toBe(201)
    const avertissements = await f.recolter()
    expect(avertissements).toHaveLength(1)
    expect(avertissements[0]).toMatch(/3 jours/)
  })

  it('délai connu : appliqué quelle que soit la nature ; zéro saisi pour une substance de base : rien', async () => {
    const f = await ferme()
    expect((await f.traiter({ natureProduit: 'substance_base', dar: '2' })).status).toBe(201)
    const avertissements = await f.recolter()
    expect(avertissements).toHaveLength(1)
    expect(avertissements[0]).toMatch(/2 jours/)

    const g = await ferme()
    expect((await g.traiter({ natureProduit: 'substance_base', dar: '0' })).status).toBe(201)
    expect(await g.recolter()).toEqual([])
  })

  it('biostimulant déclaré sans délai : aucun avertissement', async () => {
    const f = await ferme()
    expect((await f.traiter({ produitPhyto: 'Purin d’ortie', natureProduit: 'biostimulant' })).status).toBe(201)
    expect(await f.recolter()).toEqual([])
  })

  it('correction de la nature après coup : la récolte suivante suit la nature corrigée', async () => {
    const f = await ferme()
    const { id } = await (await f.traiter({})).json()
    const correction = await modifierIntervention(json('PATCH', '/api/interventions', { id, natureProduit: 'substance_base', motif: 'Nature précisée' }))
    expect(correction.status).toBe(200)
    expect(await prisma.intervention.findFirst({ where: { id, userId: f.userId }, select: { natureProduit: true } })).toEqual({ natureProduit: 'substance_base' })
    expect((await f.recolter())[0]).toContain('délai inconnu pour')
  })

  it('refus : nature inconnue, ou substance de base avec un numéro d’AMM (création et correction)', async () => {
    const f = await ferme()
    expect((await f.traiter({ natureProduit: 'homeopathie' })).status).toBe(400)
    const contredit = await f.traiter({ natureProduit: 'substance_base', numAMM: '2010001' })
    expect(contredit.status).toBe(400)
    expect(await contredit.json()).toMatchObject({ champ: 'natureProduit' })
    expect(await prisma.intervention.count({ where: { userId: f.userId } })).toBe(0)

    const { id } = await (await f.traiter({ numAMM: '2010001' })).json()
    const correction = await modifierIntervention(json('PATCH', '/api/interventions', { id, natureProduit: 'biostimulant' }))
    expect(correction.status).toBe(400)
    expect(await correction.json()).toMatchObject({ champ: 'natureProduit' })
    expect(await prisma.intervention.findFirst({ where: { id }, select: { natureProduit: true } })).toEqual({ natureProduit: null })
  })

  it('un autre compte ne reçoit pas l’avertissement de ce traitement', async () => {
    const f = await ferme()
    expect((await f.traiter({ natureProduit: 'substance_base' })).status).toBe(201)
    const voisin = await ferme()
    expect(await voisin.recolter()).toEqual([])
  })
})
