/**
 * PostgreSQL réel, données fictives sur gleba_tests ; l'authentification est
 * simulée (aucune preuve de garde HTTP ici).
 *
 * Contre-revue PR #73 (revue-adv-97) : bulk-fait et reporter déplaçaient les
 * dates d'une culture sans le contrôle d'occupation ni le verrou d'exploitation
 * de PUT/PATCH. Les deux témoins de la contre-revue sont repris ici avec
 * l'attente corrigée, complétés par les états successifs d'un lot, le
 * dépassement hérité non aggravé et une concurrence sous le verrou commun.
 *
 * Planche de 0,80 m, marges 0,20 m : une culture de 3 rangs à 25 cm (0,50 m)
 * tient seule ; deux en même temps (1,00 m) débordent.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import type { Culture, User } from '@prisma/client'
const auth = vi.hoisted(() => ({ userId: '' }))
vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: auth.userId } } }),
  getUserId: () => auth.userId,
}))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
import db from '@/lib/prisma'
import { PATCH, PUT } from './[id]/route'
import { POST as bulkFait } from './bulk-fait/route'
import { POST as reporter } from './[id]/reporter/route'
import { evaluerModificationOccupation, evaluerOccupationPlanche } from '@/lib/planche-validation'
import { selectCulturesOccupation } from '@/lib/planches/occupation'
import { debutOccupation, estVivaceEnPlace, finDeCycle } from '@/lib/cultures/fenetre-recolte'
import { dateJourSeul, jourCivilStocke } from '@/lib/jour-civil'

const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })
const req = (method: string, data: object) => new NextRequest('http://localhost/api/cultures', {
  method, body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' },
})
/** Minuit UTC du jour civil courant décalé de `delta` jours (bulk-fait recale sur « maintenant »). */
const jour = (delta: number) => {
  const d = dateJourSeul(new Date())
  d.setUTCDate(d.getUTCDate() + delta)
  return d
}

describe.skipIf(process.env.GLEBA_PR73_POSTGRES !== '1')('occupation : bulk-fait et reporter sous le contrôle commun', () => {
  let user: User
  let especeId: string, itpId: string, plancheId: string, plancheLibreId: string
  beforeAll(async () => {
    if (new URL(process.env.DATABASE_URL || '').pathname !== '/gleba_tests'
      || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) throw new Error('Base gleba_tests obligatoire')
    user = await db.user.create({ data: { email: `pr73-chemins-${randomUUID()}@example.invalid`, emailVerified: true } })
    auth.userId = user.id
    especeId = (await db.espece.create({ data: { userId: user.id, nom: 'Espèce fictive PR73 chemins' } })).id
    itpId = (await db.iTP.create({ data: { userId: user.id, especeId, nom: 'ITP fictif PR73 chemins', espacementRangs: 25 } })).id
    plancheId = (await db.planche.create({ data: { userId: user.id, nom: 'Planche fictive pleine', largeur: 0.8, longueur: 20 } })).id
    plancheLibreId = (await db.planche.create({ data: { userId: user.id, nom: 'Planche fictive libre', largeur: 0.8, longueur: 20 } })).id
  })
  afterAll(async () => {
    if (user) await db.user.delete({ where: { id: user.id } })
    await db.$disconnect()
  })
  beforeEach(async () => { await db.culture.deleteMany({ where: { userId: user.id } }) })

  async function creer(debut: number, fin: number, extra: Partial<Culture> = {}) {
    return db.culture.create({ data: { userId: user.id, especeId, itpId, plancheId, longueur: 20, nbRangs: 3,
      annee: 2026, semisFait: false, plantationFaite: false, recolteFaite: false,
      dateSemis: jour(debut), dateRecolte: jour(fin), ...extra } })
  }
  async function verdict(id: number) {
    const c = await db.culture.findUniqueOrThrow({ where: { id } })
    const voisines = await db.culture.findMany({
      where: { userId: user.id, plancheId: c.plancheId, id: { not: id }, terminee: null }, select: selectCulturesOccupation,
    })
    return evaluerOccupationPlanche({ planche: { largeur: 0.8, longueur: 20 }, culturesEnPlace: voisines,
      espacementRangs: 25, nbRangs: c.nbRangs, longueur: c.longueur, debut: debutOccupation(c), fin: finDeCycle(c) })
  }
  const lire = (id: number) => db.culture.findUniqueOrThrow({ where: { id } })

  it('bulk-fait : le recalage qui déborde est enregistré et signalé (un fait accompli s’enregistre)', async () => {
    await creer(-10, 10)
    const c = await creer(20, 60)
    const libre = await creer(20, 60, { plancheId: plancheLibreId })
    expect((await verdict(c.id)).possible).toBe(true)
    const res = await bulkFait(req('POST', { ids: [c.id, libre.id], type: 'semis' }))
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.updated).toBe(2)
    expect(corps.refusees).toEqual([])
    expect(corps.avertissements.map((a: { id: number }) => a.id)).toEqual([c.id])
    expect(corps.avertissements[0].message).toMatch(/planche|largeur/i)

    const apres = await lire(c.id)
    expect(apres.semisFait).toBe(true)
    expect(jourCivilStocke(apres.dateSemis)).toBe(jourCivilStocke(jour(0)))
    const libreApres = await lire(libre.id)
    expect(libreApres.semisFait).toBe(true)
    expect(jourCivilStocke(libreApres.dateSemis)).toBe(jourCivilStocke(jour(0)))
  })

  it('bulk-fait signale chaque recalage face aux écritures déjà faites du lot', async () => {
    // a (20→25) puis b (30→40), traitées dans l'ordre des identifiants. Recalée
    // à aujourd'hui, a (0→25) tient à côté de b encore en place ; b recalée
    // (0→40) chevauche a TELLE QU'ÉCRITE par le lot : elle est enregistrée et
    // signalée.
    const a = await creer(20, 25)
    const b = await creer(30, 40)
    const res = await bulkFait(req('POST', { ids: [b.id, a.id], type: 'semis' }))
    const corps = await res.json()
    expect(corps.updated).toBe(2)
    expect(corps.avertissements.map((r: { id: number }) => r.id)).toEqual([b.id])
    expect((await lire(a.id)).semisFait).toBe(true)
    expect((await lire(b.id)).semisFait).toBe(true)
  })

  it('reporter (témoin 2 de revue-adv-97) : un report vers une planche pleine renvoie 400 sans rien écrire', async () => {
    await creer(-10, 10)
    const c = await creer(-60, -40)
    expect((await verdict(c.id)).possible).toBe(true)
    expect((await PATCH(req('PATCH', { dateSemis: jour(0).toISOString(), dateRecolte: jour(20).toISOString() }),
      params(c.id))).status).toBe(400)

    const res = await reporter(req('POST', { etape: 'semis', date: jour(0).toISOString() }), params(c.id))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/planche|largeur/i)
    const apres = await lire(c.id)
    expect(apres.updatedAt.getTime()).toBe(c.updatedAt.getTime())
    expect(jourCivilStocke(apres.dateSemis)).toBe(jourCivilStocke(c.dateSemis))
    expect(jourCivilStocke(apres.dateRecolte)).toBe(jourCivilStocke(c.dateRecolte))
  })

  it('reporter vers une période libre : le cycle est déplacé', async () => {
    await creer(-10, 10)
    const c = await creer(-60, -40)
    const res = await reporter(req('POST', { etape: 'semis', date: jour(30).toISOString() }), params(c.id))
    expect(res.status).toBe(200)
    const apres = await lire(c.id)
    expect(jourCivilStocke(apres.dateSemis)).toBe(jourCivilStocke(jour(30)))
    expect(jourCivilStocke(apres.dateRecolte)).toBe(jourCivilStocke(jour(50)))
  })

  it('un dépassement hérité, non aggravé, reste modifiable par reporter et bulk-fait', async () => {
    // Deux cultures de 3 rangs déjà superposées : la planche déborde avant toute mutation.
    await creer(-10, 40)
    const viaReport = await creer(-5, 30)
    expect((await verdict(viaReport.id)).possible).toBe(false)
    const report = await reporter(req('POST', { etape: 'semis', date: jour(-4).toISOString() }), params(viaReport.id))
    expect(report.status).toBe(200)
    expect(jourCivilStocke((await lire(viaReport.id)).dateSemis)).toBe(jourCivilStocke(jour(-4)))

    await db.culture.deleteMany({ where: { userId: user.id } })
    await creer(5, 40)
    const viaLot = await creer(10, 35)
    expect((await verdict(viaLot.id)).possible).toBe(false)
    const lot = await bulkFait(req('POST', { ids: [viaLot.id], type: 'semis' }))
    expect(await lot.json()).toMatchObject({ updated: 1, refusees: [] })
    const apres = await lire(viaLot.id)
    expect(apres.semisFait).toBe(true)
    expect(jourCivilStocke(apres.dateSemis)).toBe(jourCivilStocke(jour(0)))
  })

  it('bulk-fait et un agrandissement PUT concurrents attendent le verrou commun : une seule mutation passe', async () => {
    // a seule recalée (0,50 m) tient à côté de b à 1 rang (0,10 m) ; b agrandi
    // à 2 rangs (0,25 m) tient seul ; les deux ensemble débordent.
    const a = await creer(20, 60)
    const b = await creer(-10, 10, { nbRangs: 1 })
    let liberer!: () => void, verrouPris!: () => void
    const liberation = new Promise<void>((resolve) => { liberer = resolve })
    const acquisition = new Promise<void>((resolve) => { verrouPris = resolve })
    const bloqueur = db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gleba:creer-cultures:${user.id}`}))`
      verrouPris()
      await liberation
    }, { timeout: 15000 })
    await acquisition
    const reponses = [
      bulkFait(req('POST', { ids: [a.id], type: 'semis' })),
      PUT(req('PUT', { nbRangs: 2 }), params(b.id)),
    ]
    try {
      const fin = Date.now() + 7000
      for (;;) {
        const [{ n }] = await db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_locks
          WHERE locktype = 'advisory' AND NOT granted AND objid = hashtext(${`gleba:creer-cultures:${user.id}`})::oid`
        if (n >= 2) break
        if (Date.now() > fin) throw new Error("bulk-fait et PUT n'attendent pas tous deux le verrou d'exploitation")
        await new Promise((resolve) => setTimeout(resolve, 30))
      }
    } finally {
      liberer()
      await bloqueur
    }
    const [lot, put] = await Promise.all(reponses)
    const corps = await lot.json()
    const lotAccepte = corps.updated === 1
    console.log('Concurrence bulk-fait/PUT', { lot: corps, put: put.status })
    expect(put.status).toBe(lotAccepte ? 400 : 200)
    expect(corps.refusees.length).toBe(lotAccepte ? 0 : 1)
    expect((await verdict(a.id)).possible).toBe(true)
  })
})

/**
 * Contre-revue ADV33 (revue-adv-33, PR #73) : la culture modifiée était lue
 * comme une annuelle (`espece.vivace` non chargé), alors que ses voisines
 * vivaces occupent la planche sans fin. Les deux sondes de la contre-revue sont
 * reprises avec l'attente corrigée, puis le même contrôle par bulk-fait.
 */
describe.skipIf(process.env.GLEBA_PR73_POSTGRES !== '1')('occupation : une vivace modifiée est évaluée comme ses voisines', () => {
  let user: User
  let vivaceId: string, annuelleId: string, itpVivaceId: string, itpAnnuelId: string, plancheId: string, plancheLibreId: string
  const jourFixe = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
  beforeAll(async () => {
    if (new URL(process.env.DATABASE_URL || '').pathname !== '/gleba_tests'
      || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) throw new Error('Base gleba_tests obligatoire')
    user = await db.user.create({ data: { email: `pr73-vivace-${randomUUID()}@example.invalid`, emailVerified: true } })
    auth.userId = user.id
    vivaceId = (await db.espece.create({ data: { userId: user.id, nom: 'Vivace fictive ADV33', vivace: true } })).id
    annuelleId = (await db.espece.create({ data: { userId: user.id, nom: 'Annuelle fictive ADV33', vivace: false } })).id
    itpVivaceId = (await db.iTP.create({ data: { userId: user.id, especeId: vivaceId, nom: 'ITP vivace fictif ADV33', espacementRangs: 25 } })).id
    itpAnnuelId = (await db.iTP.create({ data: { userId: user.id, especeId: annuelleId, nom: 'ITP annuel fictif ADV33', espacementRangs: 25 } })).id
    plancheId = (await db.planche.create({ data: { userId: user.id, nom: 'Planche fictive ADV33', largeur: 0.8, longueur: 20 } })).id
    plancheLibreId = (await db.planche.create({ data: { userId: user.id, nom: 'Planche fictive ADV33 libre', largeur: 0.8, longueur: 20 } })).id
  })
  afterAll(async () => {
    if (user) await db.user.delete({ where: { id: user.id } })
    await db.$disconnect()
  })
  beforeEach(async () => {
    auth.userId = user.id
    await db.culture.deleteMany({ where: { userId: user.id } })
  })

  const creer = (vivace: boolean, dateSemis: Date, dateRecolte: Date, extra: Partial<Culture> = {}) =>
    db.culture.create({ data: { userId: user.id, especeId: vivace ? vivaceId : annuelleId,
      itpId: vivace ? itpVivaceId : itpAnnuelId, plancheId, annee: 2027, longueur: 20, nbRangs: 3,
      semisFait: false, plantationFaite: false, recolteFaite: false, dateSemis, dateRecolte, ...extra } })
  const lire = (id: number) => db.culture.findUniqueOrThrow({ where: { id } })
  /** Verdict physique d'une culture : elle-même lue par `selectCulturesOccupation`, comme ses voisines. */
  async function verdict(id: number) {
    const c = await db.culture.findUniqueOrThrow({ where: { id }, select: { ...selectCulturesOccupation, plancheId: true, terminee: true } })
    const voisines = await db.culture.findMany({
      where: { userId: user.id, plancheId: c.plancheId, id: { not: id }, terminee: null }, select: selectCulturesOccupation,
    })
    return evaluerOccupationPlanche({ planche: { largeur: 0.8, longueur: 20 }, culturesEnPlace: voisines,
      espacementRangs: 25, nbRangs: c.nbRangs, longueur: c.longueur, debut: debutOccupation(c), fin: finDeCycle(c),
      vivace: estVivaceEnPlace(c) })
  }

  it('reporter (sonde 1 d’ADV33) : le report d’une vivace qui crée un dépassement renvoie 400 sans écriture', async () => {
    const cible = await creer(true, jourFixe('2027-09-01'), jourFixe('2027-10-01'))
    await creer(false, jourFixe('2027-06-01'), jourFixe('2027-08-01'))
    // En place à partir de septembre, la vivace ne gêne pas l'annuelle de l'été.
    expect((await verdict(cible.id)).possible).toBe(true)

    const res = await reporter(req('POST', { etape: 'semis', date: '2027-01-01' }), params(cible.id))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/Largeur insuffisante/)
    const apres = await lire(cible.id)
    expect(apres.updatedAt.getTime()).toBe(cible.updatedAt.getTime())
    expect(apres.dateSemis).toEqual(cible.dateSemis)
    expect(apres.dateRecolte).toEqual(cible.dateRecolte)
    expect((await verdict(cible.id)).possible).toBe(true)
  })

  it('reporter (sonde 2 d’ADV33) : la correction non aggravante d’une vivace en dépassement hérité est acceptée', async () => {
    const cible = await creer(true, jourFixe('2027-01-01'), jourFixe('2027-02-01'))
    await creer(false, jourFixe('2027-06-01'), jourFixe('2027-08-01'))
    // Vivace en place depuis janvier : elle occupe déjà la planche de l'été.
    expect((await verdict(cible.id)).possible).toBe(false)

    const res = await reporter(req('POST', { etape: 'semis', date: '2027-05-15' }), params(cible.id))
    expect(res.status).toBe(200)
    expect(jourCivilStocke((await lire(cible.id)).dateSemis)).toBe('2027-05-15')
  })

  it('le PATCH des notes d’une vivace en dépassement hérité reste accepté', async () => {
    const cible = await creer(true, jourFixe('2027-01-01'), jourFixe('2027-02-01'))
    await creer(false, jourFixe('2027-06-01'), jourFixe('2027-08-01'))
    const res = await PATCH(req('PATCH', { notes: 'Note fictive ADV33' }), params(cible.id))
    expect(res.status).toBe(200)
    expect((await lire(cible.id)).notes).toBe('Note fictive ADV33')
  })

  it('bulk-fait applique le même contrôle à une vivace : état final évalué vivace, les autres sont faites', async () => {
    // Vivace prévue à J+20, sans date de récolte. Voisine : annuelle de 3 rangs
    // de J-10 à J+5. En place à partir de J+20, la vivace ne la croise pas ;
    // recalée à J0, elle la côtoie : nouveau dépassement, signalé.
    // Lue comme une annuelle sans fin de cycle, toutes les voisines comptent
    // avant comme après : dépassement hérité non aggravé, le recalage passait.
    const vivace = await creer(true, jour(20), jour(30), { dateRecolte: null })
    await creer(false, jour(-10), jour(5))
    const libres = await Promise.all([1, 2].map(() => creer(false, jour(20), jour(60), { plancheId: plancheLibreId })))
    expect(await verdict(vivace.id)).toMatchObject({ verifie: true, possible: true })
    const etatAnnuel = (debut: Date) => ({ espacementRangs: 25, nbRangs: 3, longueur: 20, debut, fin: null })
    expect(evaluerModificationOccupation({ planche: { largeur: 0.8, longueur: 20 },
      autresCultures: await db.culture.findMany({ where: { userId: user.id, plancheId, id: { not: vivace.id } }, select: selectCulturesOccupation }),
      avant: etatAnnuel(jour(20)), apres: etatAnnuel(jour(0)) })).toBeNull()

    const res = await bulkFait(req('POST', { ids: [vivace.id, ...libres.map((c) => c.id)], type: 'semis' }))
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.updated).toBe(3)
    expect(corps.avertissements.map((r: { id: number }) => r.id)).toEqual([vivace.id])
    expect(corps.avertissements[0].message).toMatch(/largeur insuffisante/)
    expect((await lire(vivace.id)).semisFait).toBe(true)
    for (const libre of libres) expect((await lire(libre.id)).semisFait).toBe(true)
  })

  /**
   * Contre-revue ADV39 : deux annuelles qui se succèdent (mars-avril puis
   * juin-août) ne sont jamais simultanées. 2 rangs à 25 cm = 0,25 m chacune ;
   * la vivace + une annuelle = 0,50 m pour 0,60 m utiles.
   */
  async function vivaceEtDeuxAnnuelles(premiere: [string, string], seconde: [string, string]) {
    const deuxRangs = { nbRangs: 2 }
    const cible = await creer(true, jourFixe('2027-09-01'), jourFixe('2027-10-01'), deuxRangs)
    await creer(false, jourFixe(premiere[0]), jourFixe(premiere[1]), deuxRangs)
    await creer(false, jourFixe(seconde[0]), jourFixe(seconde[1]), deuxRangs)
    expect((await verdict(cible.id)).possible).toBe(true)
    return cible
  }

  it('reporter (témoin ADV39) : une vivace reportée avant deux annuelles successives est acceptée', async () => {
    const cible = await vivaceEtDeuxAnnuelles(['2027-03-01', '2027-04-01'], ['2027-06-01', '2027-08-01'])
    const res = await reporter(req('POST', { etape: 'semis', date: '2027-01-01' }), params(cible.id))
    expect(res.status).toBe(200)
    expect(jourCivilStocke((await lire(cible.id)).dateSemis)).toBe('2027-01-01')
    expect(await verdict(cible.id)).toMatchObject({ verifie: true, possible: true, largeurOccupee: 0.25 })
  })

  it('reporter (contrôle ADV39) : les mêmes annuelles simultanées (juin-juillet) font refuser le report, sans écriture', async () => {
    const cible = await vivaceEtDeuxAnnuelles(['2027-03-01', '2027-08-01'], ['2027-06-01', '2027-08-15'])
    const res = await reporter(req('POST', { etape: 'semis', date: '2027-01-01' }), params(cible.id))
    expect(res.status).toBe(400)
    const corps = await res.json()
    expect(corps.error).toMatch(/^Largeur insuffisante/)
    expect(corps.details.largeurOccupee).toBeCloseTo(0.5)
    const apres = await lire(cible.id)
    expect(apres.updatedAt.getTime()).toBe(cible.updatedAt.getTime())
    expect(apres.dateSemis).toEqual(cible.dateSemis)
  })

  /**
   * Contre-revues ADV106 / QA105 : la non-aggravation se juge tranche par
   * tranche, sur les voisines qui prennent réellement de la largeur. Planche de
   * 20 m ; une partielle de 10 m logée bout à bout avec la vivace de 10 m ne lui
   * prend aucune largeur.
   */
  it('reporter (sonde 1 d’ADV106) : une nouvelle partielle logée bout à bout n’aggrave pas le dépassement hérité', async () => {
    const cible = await creer(true, jourFixe('2027-07-15'), jourFixe('2027-08-15'), { longueur: 10 })
    await creer(false, jourFixe('2027-06-01'), jourFixe('2027-08-01'))
    await creer(false, jourFixe('2027-03-01'), jourFixe('2027-07-01'), { longueur: 10 })
    expect(await verdict(cible.id)).toMatchObject({ verifie: true, possible: false, largeurOccupee: 0.5 })

    const res = await reporter(req('POST', { etape: 'semis', date: '2027-05-15' }), params(cible.id))
    expect(res.status).toBe(200)
    expect(jourCivilStocke((await lire(cible.id)).dateSemis)).toBe('2027-05-15')
    // Témoin : la partielle est bien en regard après le report, sans largeur prise.
    expect((await verdict(cible.id)).possible).toBe(false)
  })

  it('PUT (sonde 2 d’ADV106) : un agrandissement qui aggrave une tranche est refusé sans écriture, même sous le maximum d’une autre', async () => {
    const deuxRangs = { nbRangs: 2 }
    const cible = await creer(true, jourFixe('2027-01-01'), jourFixe('2027-02-01'), { longueur: 10 })
    // Mars-avril : 0,25 m en pleine longueur + partielle de 10 m bout à bout
    // (0,75 m au total avec la vivace) ; juin-août : 0,50 m (1 m, hérité).
    await creer(false, jourFixe('2027-03-01'), jourFixe('2027-04-01'), deuxRangs)
    await creer(false, jourFixe('2027-03-01'), jourFixe('2027-04-01'), { ...deuxRangs, longueur: 10 })
    await creer(false, jourFixe('2027-06-01'), jourFixe('2027-08-01'))
    expect(await verdict(cible.id)).toMatchObject({ verifie: true, possible: false, largeurOccupee: 0.5 })

    // 15 m : la partielle de mars ne tient plus bout à bout (15 + 10 > 20),
    // mars passe à 1 m ; le maximum de juin-août, lui, ne bouge pas.
    const res = await PUT(req('PUT', { longueur: 15 }), params(cible.id))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/^Largeur insuffisante/)
    const apres = await lire(cible.id)
    expect(apres.longueur).toBe(10)
    expect(apres.updatedAt.getTime()).toBe(cible.updatedAt.getTime())

    // Contrôle : une réduction reste acceptée.
    const reduction = await PUT(req('PUT', { longueur: 8 }), params(cible.id))
    expect(reduction.status).toBe(200)
    expect((await lire(cible.id)).longueur).toBe(8)
  })
})
