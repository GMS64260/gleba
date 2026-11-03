/** PostgreSQL jetable migré ; aucune copie des données d'une exploitation. */
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'

const auth = vi.hoisted(() => ({ tenant: '' }))
vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: vi.fn(async () => ({ error: null, session: { user: { id: auth.tenant } } })),
}))
import db from '@/lib/prisma'
import { GET as registre } from '@/app/api/tracabilite/registre-culture/route'
import { PUT as modifierAnimal } from '@/app/api/elevage/animaux/[id]/route'
import { composerLot } from '@/lib/elevage/composition-lot'
import { isAssignableAnimalLot } from '@/lib/elevage/animal-lot'

let userId: string, autreId: string
beforeAll(() => {
  const url = process.env.DATABASE_URL || ''
  if (!/^\/gleba_parcours_qa_[0-9a-f]{8}$/.test(new URL(url).pathname)
    || process.env.GLEBA_PARCOURS_QA_DATABASE_URL !== url) {
    throw new Error('Base PostgreSQL jetable dédiée obligatoire')
  }
})
beforeEach(async () => {
  const suffixe = randomUUID()
  const users = await Promise.all(['ferme', 'autre'].map(cle => db.user.create({
    data: { email: `parcours-${cle}-${suffixe}@example.com` },
  })))
  userId = users[0].id
  autreId = users[1].id
  auth.tenant = userId
})
afterAll(async () => db.$disconnect())

const get = (path: string) => new NextRequest('http://localhost' + path)
const put = (id: number, body: Record<string, unknown>) => modifierAnimal(
  new NextRequest('http://localhost/api/elevage/animaux/' + id, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }),
  { params: Promise.resolve({ id: String(id) }) },
)

it('le registre utilise les dimensions cultivées et reste isolé par exploitation', async () => {
  const espece = await db.espece.create({ data: { userId, nom: 'Légume témoin' } })
  const planche = await db.planche.create({ data: { userId, nom: 'Planche témoin', largeur: 1.2, longueur: 20, surface: 24 } })
  const culture = await db.culture.create({ data: { userId, especeId: espece.id, plancheId: planche.id, longueur: 4, annee: 2026 } })
  const reponse = await registre(get('/api/tracabilite/registre-culture?annee=2026'))
  expect(reponse.status).toBe(200)
  const json = await reponse.json()
  expect(json.registre).toHaveLength(1)
  expect(json.registre[0].identification.surface).toBe(4.8)
  expect((await db.planche.findUniqueOrThrow({ where: { id: planche.id } })).surface).toBe(24)
  await db.culture.update({ where: { id: culture.id }, data: { longueur: null } })
  expect((await (await registre(get('/api/tracabilite/registre-culture?annee=2026'))).json()).registre[0].identification.surface).toBe(24)
  auth.tenant = autreId
  expect((await (await registre(get('/api/tracabilite/registre-culture?annee=2026'))).json()).registre).toEqual([])
})

async function cheptel() {
  const suffixe = randomUUID()
  const [profil1, profil2] = await Promise.all([
    db.especeAnimale.create({ data: { id: `ferme_canard_${suffixe}`, userId, nom: 'Canard témoin', type: 'volaille', production: 'oeufs' } }),
    db.especeAnimale.create({ data: { id: `ferme_bovin_${suffixe}`, userId, nom: 'Bovin témoin', type: 'mammifere_grand', production: 'lait' } }),
  ])
  const lot = await db.lotAnimaux.create({ data: { userId, especeAnimaleId: profil1.id, nom: 'Lot témoin', quantiteInitiale: 2, quantiteActuelle: 2 } })
  const animal = await db.animal.create({ data: { userId, especeAnimaleId: profil1.id, lotId: lot.id, nom: 'Animal témoin' } })
  return { profil1, profil2, lot, animal }
}

it('deux profils personnels avec un même premier segment ne deviennent pas une même espèce', async () => {
  const { profil1, profil2, lot } = await cheptel()
  expect(await isAssignableAnimalLot(userId, lot.id, profil2.id)).toBe(false)
  expect(await isAssignableAnimalLot(userId, lot.id, profil1.id)).toBe(true)
  expect(await isAssignableAnimalLot(autreId, lot.id, profil1.id)).toBe(false)
})

it('la composition groupée refuse tout changement si un profil est incompatible', async () => {
  const { profil1, profil2, lot } = await cheptel()
  const candidats = await Promise.all([profil1, profil2].map(profil => db.animal.create({ data: {
    userId, especeAnimaleId: profil.id, nom: 'Candidat témoin',
  } })))
  const reponse = await composerLot(userId, lot.id, { ajouter: candidats.map(a => a.id), retirer: [] })
  expect(reponse.ok).toBe(false)
  expect(await db.animal.count({ where: { userId, id: { in: candidats.map(a => a.id) }, lotId: lot.id } })).toBe(0)
  expect(await db.$queryRaw<Array<{ nombre: bigint }>>`SELECT COUNT(*) AS nombre FROM historique_lots_animaux WHERE user_id = ${userId}`).toEqual([{ nombre: BigInt(0) }])
  expect((await composerLot(userId, lot.id, { ajouter: [candidats[0].id], retirer: [] })).ok).toBe(true)
  expect((await db.animal.findUniqueOrThrow({ where: { id: candidats[0].id } })).lotId).toBe(lot.id)
})

it.each([false, true])('le changement de profil revalide le lot conservé (lot envoyé : %s)', async envoyerLot => {
  const { profil1, profil2, lot, animal } = await cheptel()
  const reponse = await put(animal.id, { especeAnimaleId: profil2.id, ...(envoyerLot ? { lotId: lot.id } : {}) })
  expect(reponse.status).toBe(400)
  const stocke = await db.animal.findUniqueOrThrow({ where: { id: animal.id } })
  expect(stocke.especeAnimaleId).toBe(profil1.id)
  expect(stocke.lotId).toBe(lot.id)
  const note = await put(animal.id, { especeAnimaleId: profil1.id, lotId: lot.id, notes: 'Observation corrigée' })
  expect(note.status).toBe(200)
})

it('le changement de profil reste possible en retirant explicitement l’animal du lot', async () => {
  const { profil2, animal } = await cheptel()
  const reponse = await put(animal.id, { especeAnimaleId: profil2.id, lotId: null })
  expect(reponse.status).toBe(200)
  const stocke = await db.animal.findUniqueOrThrow({ where: { id: animal.id } })
  expect(stocke.especeAnimaleId).toBe(profil2.id)
  expect(stocke.lotId).toBeNull()
})

it('les profils du catalogue avec une même espèce connue restent compatibles', async () => {
  const suffixe = randomUUID()
  const profils = await Promise.all(['alpine', 'laitiere'].map(race => db.especeAnimale.create({ data: {
    id: `chevre_${race}_${suffixe}`, userId, nom: `Chèvre ${race} témoin`, type: 'mammifere_grand', production: 'lait',
  } })))
  const lot = await db.lotAnimaux.create({ data: { userId, especeAnimaleId: profils[0].id, quantiteInitiale: 2, quantiteActuelle: 2 } })
  expect(await isAssignableAnimalLot(userId, lot.id, profils[1].id)).toBe(true)
})

// Relecture de la PR #47 (2026-11-03) : identifiants issus d'un nom saisi au
// pluriel, et correction d'espèce d'un animal resté dans un lot terminé.
async function profilsPluriel(noms: string[]) {
  const suffixe = randomUUID().slice(0, 8)
  return Promise.all(noms.map(nom => db.especeAnimale.create({ data: {
    id: `${nom}_${suffixe}`, userId, nom: `${nom} témoin`, type: 'volaille', production: 'oeufs',
  } })))
}

it('deux profils au pluriel d’une espèce connue se composent dans un même lot', async () => {
  const [pondeuses, marans, chevres] = await profilsPluriel(['poules_pondeuses', 'poules_marans', 'chevres_alpines'])
  const lot = await db.lotAnimaux.create({ data: { userId, especeAnimaleId: pondeuses.id, nom: 'Pondeuses témoin', quantiteInitiale: 2, quantiteActuelle: 2 } })
  expect(await isAssignableAnimalLot(userId, lot.id, marans.id)).toBe(true)
  expect(await isAssignableAnimalLot(userId, lot.id, chevres.id)).toBe(false)
  const poule = await db.animal.create({ data: { userId, especeAnimaleId: marans.id, nom: 'Marans témoin' } })
  expect((await composerLot(userId, lot.id, { ajouter: [poule.id], retirer: [] })).ok).toBe(true)
  expect((await db.animal.findUniqueOrThrow({ where: { id: poule.id } })).lotId).toBe(lot.id)
})

it('corrige l’espèce d’un animal resté dans un lot terminé, sans accepter une espèce incompatible', async () => {
  const [alpines, saanen, pondeuses] = await profilsPluriel(['chevres_alpines', 'chevres_saanen', 'poules_pondeuses'])
  const lot = await db.lotAnimaux.create({ data: { userId, especeAnimaleId: alpines.id, nom: 'Chèvres témoin', quantiteInitiale: 1, quantiteActuelle: 1, statut: 'termine' } })
  const chevre = await db.animal.create({ data: { userId, especeAnimaleId: alpines.id, lotId: lot.id, nom: 'Chèvre témoin' } })
  // Un nouveau rattachement à ce lot terminé reste refusé.
  expect(await isAssignableAnimalLot(userId, lot.id, saanen.id)).toBe(false)
  const correction = await put(chevre.id, { especeAnimaleId: saanen.id })
  expect(correction.status).toBe(200)
  expect(await db.animal.findUniqueOrThrow({ where: { id: chevre.id } })).toMatchObject({ especeAnimaleId: saanen.id, lotId: lot.id })
  const incompatible = await put(chevre.id, { especeAnimaleId: pondeuses.id })
  expect(incompatible.status).toBe(400)
  expect((await db.animal.findUniqueOrThrow({ where: { id: chevre.id } })).especeAnimaleId).toBe(saanen.id)
})

