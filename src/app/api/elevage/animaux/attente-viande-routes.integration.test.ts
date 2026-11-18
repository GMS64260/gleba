/**
 * Attente viande et routes publiques de la fiche animal, sur PostgreSQL
 * (suggestions de dev-21, constat de revue-adv-34, 2026-11-13).
 *
 * Trois contournements de la garde « abattu » posée à la main :
 *  1. arrivée reculée ET « abattu » dans la même requête (la garde lisait
 *     l'historique des lots AVANT son redatage) ;
 *  2. date de sortie d'une fiche déjà abattue ramenée dans l'attente ;
 *  3. arrivée d'une fiche déjà abattue reculée avant un soin collectif.
 * Plus le déplacement journalisé par `creerMouvementCheptel` (verrou de la
 * cible, position recalée sur le journal : ELEV-05).
 *
 * Base jetable du banc uniquement : lancer avec DATABASE_URL = TEST_DATABASE_URL
 * (base `gleba_tests`), sinon la suite est ignorée.
 *
 *   DATABASE_URL="$TEST_DATABASE_URL" lourd node node_modules/vitest/vitest.mjs run \
 *     src/app/api/elevage/animaux/attente-viande-routes.integration.test.ts \
 *     --pool=threads --poolOptions.threads.singleThread --testTimeout=30000
 */
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { afterAll, describe, expect, it, vi } from 'vitest'

const identite = vi.hoisted(() => ({ userId: '' }))
const espions = vi.hoisted(() => ({ creerMouvementCheptel: vi.fn() }))
vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({
    error: null,
    session: { user: { id: identite.userId, acteurId: identite.userId, email: 'qa@example.invalid' } },
  }),
}))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: () => {} }))
// Le helper réel s'exécute (verrou de la cible, journal, recalage) ; l'espion
// prouve seulement que la route passe par lui.
vi.mock('@/lib/elevage/creation-mouvement-cheptel', async (importOriginal) => {
  const reel = await importOriginal<typeof import('@/lib/elevage/creation-mouvement-cheptel')>()
  espions.creerMouvementCheptel.mockImplementation(reel.creerMouvementCheptel)
  return { ...reel, creerMouvementCheptel: espions.creerMouvementCheptel }
})

import prisma from '@/lib/prisma'
import { PATCH as patchFiche, PUT as putFiche } from './[id]/route'
import { PATCH as patchListe } from './route'
import { enregistrerChangementLot, MOTIFS_AFFECTATION_INITIALE } from '@/lib/elevage/animal-lot'
import { verifierAttenteViande } from '@/lib/elevage/attente-viande'

const url = process.env.DATABASE_URL
const active = !!url && url === process.env.TEST_DATABASE_URL && new URL(url).pathname === '/gleba_tests'

const jour = (j: string) => new Date(`${j}T00:00:00.000Z`)

type Corps = Record<string, unknown>
type Reponse = { status: number; corps: { error?: string; code?: string; details?: string; data?: Corps } }

describe.skipIf(!active)('fiche animal : l’attente viande ne se contourne pas par les routes publiques', () => {
  afterAll(async () => { await prisma.$disconnect() })

  /**
   * Chèvre dans un lot traité le 03/11 : attente viande jusqu'au 25/11 inclus.
   * `debutLot` : début de l'appartenance au lot connue de l'historique (fiche
   * saisie le 10/11 pour un animal réellement arrivé le 01/11, ou bien datée).
   */
  async function elevage(debutLot: string) {
    const userId = randomUUID()
    identite.userId = userId
    await prisma.user.create({ data: { id: userId, email: `${userId}@example.invalid` } })
    const espece = await prisma.especeAnimale.create({
      data: { id: `chevre-test-${userId}`, nom: 'Chèvre synthétique', type: 'mammifere_petit', production: 'viande', userId },
    })
    const lot = await prisma.lotAnimaux.create({
      data: { userId, especeAnimaleId: espece.id, nom: 'Lot synthétique', quantiteInitiale: 0, quantiteActuelle: 0 },
    })
    const animal = await prisma.animal.create({
      data: { userId, especeAnimaleId: espece.id, nom: 'Synthèse', lotId: lot.id, dateArrivee: jour(debutLot), statut: 'actif' },
    })
    await enregistrerChangementLot(prisma, userId, animal.id, null, lot.id, jour(debutLot), MOTIFS_AFFECTATION_INITIALE[0])
    await prisma.soinAnimal.create({
      data: {
        userId, lotId: lot.id, type: 'Traitement', produit: 'Antibiotique synthétique', fait: true,
        date: new Date('2026-11-03T08:00:00.000Z'), finAttenteViande: jour('2026-11-25'),
      },
    })
    const lire = async (reponse: Response): Promise<Reponse> => ({ status: reponse.status, corps: await reponse.json() })
    const requete = (methode: string, corps: Corps, chemin = '') =>
      new NextRequest(`http://localhost/api/elevage/animaux${chemin}`, {
        method: methode, body: JSON.stringify(corps), headers: { 'content-type': 'application/json' },
      })
    const params = { params: Promise.resolve({ id: String(animal.id) }) }
    const routes = {
      'PUT /api/elevage/animaux/[id]': async (corps: Corps) => lire(await putFiche(requete('PUT', corps, `/${animal.id}`), params)),
      'PATCH /api/elevage/animaux': async (corps: Corps) => lire(await patchListe(requete('PATCH', { id: animal.id, ...corps }))),
      'PATCH /api/elevage/animaux/[id]': async (corps: Corps) => lire(await patchFiche(requete('PATCH', corps, `/${animal.id}`), params)),
    }
    const fiche = () => prisma.animal.findUniqueOrThrow({ where: { id: animal.id } })
    const debutHistorique = async () => (await prisma.historiqueLotAnimal.findFirstOrThrow({
      where: { userId, animalId: animal.id }, orderBy: { dateDebut: 'asc' },
    })).dateDebut
    return { userId, animal, lot, routes, fiche, debutHistorique }
  }

  function attendreRefus(reponse: Reponse) {
    expect(reponse.status).toBe(409)
    expect(reponse.corps.code).toBe('ATTENTE_VIANDE_ACTIVE')
    expect(reponse.corps.error).toBe("Abattage interdit : animal en temps d'attente vétérinaire")
    // Le soin et la fin d'attente sont nommés.
    expect(reponse.corps.details).toContain('Antibiotique synthétique')
    expect(reponse.corps.details).toContain("jusqu'au 25/11/2026 inclus")
  }

  /**
   * Entrelacement de deux requêtes sur la même fiche (revues QA et adverse du
   * 2026-11-13) : `ancienne` lit la fiche hors transaction puis attend ;
   * `entreTemps` s'exécute en entier ; `ancienne` reprend avec son instantané
   * périmé. Seule la remise de cette première lecture est retardée : verrous,
   * transactions et helpers sont réels.
   */
  async function avecLecturePerimee(animalId: number, ancienne: () => Promise<Reponse>, entreTemps: () => Promise<void>) {
    let signalerLecture!: () => void
    let reprendre!: () => void
    const lectureFaite = new Promise<void>((resolve) => { signalerLecture = resolve })
    const reprise = new Promise<void>((resolve) => { reprendre = resolve })
    const lireReel = prisma.animal.findFirst.bind(prisma.animal)
    let intercepter = true
    vi.spyOn(prisma.animal, 'findFirst').mockImplementation((async (args: { where?: { id?: number }; select?: unknown }) => {
      const valeur = await lireReel(args as never)
      if (intercepter && args.where?.id === animalId && !args.select) {
        intercepter = false
        signalerLecture()
        await reprise
      }
      return valeur
    }) as never)
    try {
      const enAttente = ancienne()
      await lectureFaite
      try { await entreTemps() } finally { reprendre() }
      return await enAttente
    } finally {
      // Pas de `mockRestore` : sur le délégué Prisma (un proxy), il retire la méthode.
      prisma.animal.findFirst = lireReel as never
    }
  }

  const ROUTES_AVEC_ARRIVEE = ['PUT /api/elevage/animaux/[id]', 'PATCH /api/elevage/animaux'] as const
  const TOUTES = [...ROUTES_AVEC_ARRIVEE, 'PATCH /api/elevage/animaux/[id]'] as const

  describe.each(ROUTES_AVEC_ARRIVEE)('%s', (route) => {
    it('scénario 1 — arrivée reculée avant le soin collectif ET « abattu » dans la même requête : 409, rien n’est écrit', async () => {
      const f = await elevage('2026-11-10')
      const reponse = await f.routes[route]({ dateArrivee: '2026-11-01', statut: 'abattu', dateSortie: '2026-11-13', notes: 'Ne doit pas être écrit' })
      attendreRefus(reponse)
      expect(await f.fiche()).toMatchObject({ statut: 'actif', dateSortie: null, notes: null, dateArrivee: jour('2026-11-10') })
      expect(await f.debutHistorique()).toEqual(jour('2026-11-10'))
    })

    it('scénario 3 — fiche abattue le 13/11, arrivée reculée ensuite avant le soin collectif : 409, ni la fiche ni l’historique ne changent', async () => {
      const f = await elevage('2026-11-10')
      // Abattage accepté : l'historique dit que l'animal est arrivé après le soin.
      expect((await f.routes[route]({ statut: 'abattu', dateSortie: '2026-11-13' })).status).toBe(200)
      const reponse = await f.routes[route]({ dateArrivee: '2026-11-01', notes: 'Ne doit pas être écrit' })
      attendreRefus(reponse)
      expect(await f.fiche()).toMatchObject({ statut: 'abattu', dateSortie: jour('2026-11-13'), notes: null, dateArrivee: jour('2026-11-10') })
      expect(await f.debutHistorique()).toEqual(jour('2026-11-10'))
    })

    it('légitime — arrivée reculée ET « abattu » après la fin de l’attente : accepté', async () => {
      const f = await elevage('2026-11-10')
      const reponse = await f.routes[route]({ dateArrivee: '2026-11-01', statut: 'abattu', dateSortie: '2026-11-26' })
      expect(reponse.status).toBe(200)
      expect(await f.fiche()).toMatchObject({ statut: 'abattu', dateSortie: jour('2026-11-26'), dateArrivee: jour('2026-11-01') })
      expect(await f.debutHistorique()).toEqual(jour('2026-11-01'))
    })
  })

  describe.each(TOUTES)('%s', (route) => {
    it('scénario 2 — fiche abattue après la fin d’attente, date de sortie ramenée dans l’attente : 409, rien n’est écrit', async () => {
      const f = await elevage('2026-11-01')
      expect((await f.routes[route]({ statut: 'abattu', dateSortie: '2026-11-26' })).status).toBe(200)
      // Sans statut, puis en renvoyant le statut déjà posé (ce que fait un formulaire).
      for (const corps of [{ dateSortie: '2026-11-13' }, { statut: 'abattu', dateSortie: '2026-11-13' }]) {
        const reponse = await f.routes[route]({ ...corps, causeSortie: 'Ne doit pas être écrit' })
        attendreRefus(reponse)
        expect(await f.fiche()).toMatchObject({ statut: 'abattu', dateSortie: jour('2026-11-26'), causeSortie: null })
      }
    })

    it('légitime — « abattu » pendant l’attente refusé, le lendemain de la fin accepté, et la fiche abattue reste modifiable', async () => {
      const f = await elevage('2026-11-01')
      attendreRefus(await f.routes[route]({ statut: 'abattu', dateSortie: '2026-11-25' }))
      expect(await f.fiche()).toMatchObject({ statut: 'actif', dateSortie: null })

      expect((await f.routes[route]({ statut: 'abattu', dateSortie: '2026-11-26' })).status).toBe(200)
      expect(await f.fiche()).toMatchObject({ statut: 'abattu', dateSortie: jour('2026-11-26') })

      // Une correction sans rapport, ou une date de sortie repoussée, passe toujours.
      expect((await f.routes[route]({ statut: 'abattu', dateSortie: '2026-11-26', poidsActuel: 41 })).status).toBe(200)
      expect((await f.routes[route]({ dateSortie: '2026-11-28' })).status).toBe(200)
      expect(await f.fiche()).toMatchObject({ statut: 'abattu', dateSortie: jour('2026-11-28'), poidsActuel: 41 })
    })
  })

  describe.each(TOUTES)('%s', (route) => {
    it('fiche déjà abattue pendant une attente (saisie antérieure à la garde) : une correction sans rapport reste possible', async () => {
      const f = await elevage('2026-11-01')
      await prisma.animal.update({ where: { id: f.animal.id }, data: { statut: 'abattu', dateSortie: jour('2026-11-13') } })
      expect((await f.routes[route]({ statut: 'abattu', dateSortie: '2026-11-13', poidsActuel: 38 })).status).toBe(200)
      expect(await f.fiche()).toMatchObject({ statut: 'abattu', dateSortie: jour('2026-11-13'), poidsActuel: 38 })
      // Mais déplacer le jour de sortie à l'intérieur de l'attente reste refusé.
      attendreRefus(await f.routes[route]({ dateSortie: '2026-11-14' }))
    })
  })

  describe.each(TOUTES)('%s — concurrence', (route) => {
    it('un ancien formulaire ne ramène pas dans l’attente une sortie corrigée entre-temps : 409, rien n’est écrit', async () => {
      const f = await elevage('2026-11-01')
      // Fiche saisie avant la garde : abattue le 13/11, pendant l'attente.
      await prisma.animal.update({ where: { id: f.animal.id }, data: { statut: 'abattu', dateSortie: jour('2026-11-13') } })
      const reponse = await avecLecturePerimee(
        f.animal.id,
        () => f.routes[route]({ statut: 'abattu', dateSortie: '2026-11-13', poidsActuel: 37 }),
        async () => {
          expect((await f.routes[route]({ dateSortie: '2026-11-26' })).status).toBe(200)
          expect(await f.fiche()).toMatchObject({ dateSortie: jour('2026-11-26') })
        },
      )
      // L'instantané périmé disait « rien ne change » ; la fiche relue sous
      // verrou dit que la sortie revient du 26/11 au 13/11.
      attendreRefus(reponse)
      expect(await f.fiche()).toMatchObject({ statut: 'abattu', dateSortie: jour('2026-11-26'), poidsActuel: null })
    })
  })

  describe.each(ROUTES_AVEC_ARRIVEE)('%s — concurrence', (route) => {
    it('une arrivée corrigée entre-temps : la requête suivante redate l’historique depuis l’état réel, fiche et journal restent cohérents', async () => {
      const f = await elevage('2026-11-10')
      expect((await f.routes[route]({ statut: 'abattu', dateSortie: '2026-11-13' })).status).toBe(200)
      const reponse = await avecLecturePerimee(
        f.animal.id,
        () => f.routes[route]({ statut: 'abattu', dateSortie: '2026-11-13', dateArrivee: '2026-11-10', notes: 'Formulaire ancien' }),
        async () => {
          expect((await f.routes[route]({ dateSortie: '2026-11-26' })).status).toBe(200)
          expect((await f.routes[route]({ dateArrivee: '2026-11-01' })).status).toBe(200)
          expect(await f.debutHistorique()).toEqual(jour('2026-11-01'))
        },
      )
      // Les requêtes sont sérialisées : la dernière l'emporte, mais elle
      // redate l'historique (01/11 → 10/11) et la garde juge cet état-là.
      expect(reponse.status).toBe(200)
      expect(await f.fiche()).toMatchObject({ statut: 'abattu', dateSortie: jour('2026-11-13'), dateArrivee: jour('2026-11-10'), notes: 'Formulaire ancien' })
      expect(await f.debutHistorique()).toEqual(jour('2026-11-10'))
      await expect(verifierAttenteViande(prisma, f.userId, { animalId: f.animal.id, lotId: null, date: jour('2026-11-13') })).resolves.toBeUndefined()
    })

    it('un ancien formulaire ne recule pas l’arrivée d’une fiche abattue entre-temps : 409, historique inchangé', async () => {
      const f = await elevage('2026-11-10')
      const reponse = await avecLecturePerimee(
        f.animal.id,
        // Fiche lue « active » : reculer l'arrivée seule ne posait aucun contrôle.
        () => f.routes[route]({ dateArrivee: '2026-11-01', notes: 'Ne doit pas être écrit' }),
        async () => { expect((await f.routes[route]({ statut: 'abattu', dateSortie: '2026-11-13' })).status).toBe(200) },
      )
      attendreRefus(reponse)
      expect(await f.fiche()).toMatchObject({ statut: 'abattu', dateSortie: jour('2026-11-13'), dateArrivee: jour('2026-11-10'), notes: null })
      expect(await f.debutHistorique()).toEqual(jour('2026-11-10'))
    })
  })

  describe.each(TOUTES)('%s — concurrence', (route) => {
    it('un ancien formulaire ne remet pas « actif » un animal abattu entre-temps par un abattage toujours actif : 409', async () => {
      const f = await elevage('2026-11-10')
      const reponse = await avecLecturePerimee(
        f.animal.id,
        () => f.routes[route]({ statut: 'actif', notes: 'Ne doit pas être écrit' }),
        async () => {
          await prisma.abattage.create({ data: { userId: f.userId, animalId: f.animal.id, date: jour('2026-11-13'), destination: 'vente' } })
          await prisma.animal.update({ where: { id: f.animal.id }, data: { statut: 'abattu', dateSortie: jour('2026-11-13') } })
        },
      )
      expect(reponse.status).toBe(409)
      expect(reponse.corps.code).toBe('SORTIE_ACTIVE')
      expect(reponse.corps.error).toContain('annulez l’abattage')
      expect(await f.fiche()).toMatchObject({ statut: 'abattu', dateSortie: jour('2026-11-13') })
    })
  })

  describe.each(ROUTES_AVEC_ARRIVEE)('%s — déplacement', (route) => {
    it('journalise le changement de parcelle par creerMouvementCheptel : cible verrouillée, position recalée sur le journal (ELEV-05)', async () => {
      const f = await elevage('2026-11-01')
      const parcelle = (nom: string) => prisma.parcelleGeo.create({
        data: { userId: f.userId, nom, geometry: '{"type":"Polygon","coordinates":[]}' },
      })
      const [pre, bois] = [await parcelle('Pré synthétique'), await parcelle('Bois synthétique')]
      espions.creerMouvementCheptel.mockClear()

      const reponse = await f.routes[route]({ parcelleGeoId: pre.id })
      expect(reponse.status).toBe(200)
      expect(reponse.corps.data?.parcelleGeoId).toBe(pre.id)
      expect(espions.creerMouvementCheptel).toHaveBeenCalledTimes(1)
      expect(espions.creerMouvementCheptel.mock.calls[0][1]).toBe(f.userId)
      expect(espions.creerMouvementCheptel.mock.calls[0][2]).toMatchObject({
        animalId: f.animal.id, parcelleAvantId: null, parcelleApresId: pre.id, motif: 'Modification de la fiche animal',
      })
      expect(await prisma.mouvementCheptel.count({ where: { userId: f.userId, animalId: f.animal.id } })).toBe(1)
      expect((await f.fiche()).parcelleGeoId).toBe(pre.id)

      // Un déplacement daté de demain est déjà au journal : la fiche modifiée
      // aujourd'hui ajoute son mouvement, mais la position reste la destination
      // du mouvement le plus récent (recalage ELEV-05), y compris dans la réponse.
      await prisma.mouvementCheptel.create({
        data: { userId: f.userId, animalId: f.animal.id, parcelleAvantId: pre.id, parcelleApresId: bois.id, date: new Date(Date.now() + 86_400_000) },
      })
      const second = await f.routes[route]({ parcelleGeoId: null })
      expect(second.status).toBe(200)
      expect(await prisma.mouvementCheptel.count({ where: { userId: f.userId, animalId: f.animal.id } })).toBe(3)
      expect((await f.fiche()).parcelleGeoId).toBe(bois.id)
      expect(second.corps.data?.parcelleGeoId).toBe(bois.id)

      // Parcelle inchangée : aucun mouvement.
      espions.creerMouvementCheptel.mockClear()
      expect((await f.routes[route]({ parcelleGeoId: bois.id, notes: 'Sans déplacement' })).status).toBe(200)
      expect(espions.creerMouvementCheptel).not.toHaveBeenCalled()
    })
  })
})
