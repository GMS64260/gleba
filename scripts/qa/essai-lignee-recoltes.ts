/**
 * Lignée des lots de récolte sur une base PostGIS jetable, jamais sur un compte
 * ni sur une base de production :
 *   GLEBA_LIGNEE_QA_DATABASE_URL=postgresql://…/gleba_lignee_<suffixe> tsx scripts/qa/essai-lignee-recoltes.ts
 * La base doit être migrée (`prisma migrate deploy`).
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

async function main() {
  const url = process.env.GLEBA_LIGNEE_QA_DATABASE_URL
  if (!url || !/^\/gleba_lignee_[a-z0-9_]+$/.test(new URL(url).pathname)) throw new Error('GLEBA_LIGNEE_QA_DATABASE_URL doit viser une base gleba_lignee_* jetable')
  process.env.DATABASE_URL = url
  const { default: prisma } = await import('../../src/lib/prisma')
  const { sortirParLots } = await import('../../src/lib/stocks/sortie-lots')
  const { compterLignees } = await import('../../src/lib/recolte/lignee')
  const { exportAccount, importAccount } = await import('../../src/lib/account-transfer')
  const { reprendreLigneesCompte } = await import('../reprise-lignee-recoltes')
  const { cederLaLignee } = await import('../../src/lib/recolte/lignee')

  const suffixe = randomUUID()
  const user = await prisma.user.create({ data: { email: `lignee-${suffixe}@example.test`, emailVerified: true } })
  const cible = await prisma.user.create({ data: { email: `lignee-cible-${suffixe}@example.test`, emailVerified: true } })
  try {
    const espece = await prisma.espece.create({ data: { nom: `Radis ${suffixe}`, userId: user.id } })
    const culture = await prisma.culture.create({ data: { userId: user.id, especeId: espece.id } })
    const jour = new Date('2026-11-22T00:00:00.000Z')
    const base = { userId: user.id, especeId: espece.id, cultureId: culture.id, date: jour, unite: 'kg' }
    const lignes = () => prisma.recolte.findMany({ where: { userId: user.id }, orderBy: { id: 'asc' }, select: { id: true, quantite: true, statut: true, recolteOrigineId: true } })

    // 1. Deux sorties partielles d'une récolte de 10 kg : trois lignes, une récolte.
    const recolte = await prisma.recolte.create({ data: { ...base, quantite: 10 } })
    for (const quantite of [1, 2]) {
      await prisma.$transaction((tx) => sortirParLots(tx, user.id, {
        especeId: espece.id, unite: 'kg', quantite, date: new Date('2026-11-23T00:00:00.000Z'), statut: 'perte', consommationId: null,
      }))
    }
    let etat = await lignes()
    assert.equal(etat.length, 3, 'deux sorties partielles font trois lignes')
    assert.deepEqual(etat.map((l) => l.recolteOrigineId), [null, recolte.id, recolte.id], 'chaque part pointe la récolte saisie')
    assert.equal(compterLignees(etat), 1, 'une seule récolte saisie')
    assert.equal(etat.reduce((s, l) => s + l.quantite, 0), 10, 'la quantité ne change pas')

    // 2. Restauration du compte : identifiants renumérotés, lignée conservée.
    const sauvegarde = await exportAccount(user.id)
    const transfert = await importAccount(cible.id, sauvegarde, { dryRun: false })
    assert.equal(transfert.skipped?.Recolte ?? 0, 0, 'toutes les lignes sont restaurées')
    const restaurees = await prisma.recolte.findMany({ where: { userId: cible.id }, orderBy: { id: 'asc' }, select: { id: true, quantite: true, recolteOrigineId: true } })
    assert.equal(restaurees.length, 3)
    assert.equal(compterLignees(restaurees), 1, 'la lignée survit à la restauration')
    const racineRestauree = restaurees.find((l) => l.recolteOrigineId == null)!
    assert.equal(racineRestauree.quantite, 7)
    assert.ok(restaurees.filter((l) => l !== racineRestauree).every((l) => l.recolteOrigineId === racineRestauree.id), 'les parts pointent la racine restaurée, pas celle du compte source')

    // 3. Récolte saisie supprimée comme le fait la route : sa part la plus
    //    ancienne devient la récolte saisie, rien n'est effacé en cascade.
    await prisma.$transaction(async (tx) => {
      await cederLaLignee(tx, user.id, recolte.id)
      await tx.recolte.delete({ where: { id: recolte.id } })
    })
    etat = await lignes()
    assert.deepEqual(etat.map((l) => l.recolteOrigineId), [null, etat[0].id], 'la part la plus ancienne hérite de la lignée')
    assert.equal(compterLignees(etat), 1, 'toujours une seule récolte')
    // Sans la route (suppression de masse, ancienne image) : la base détache les parts.
    await prisma.recolte.delete({ where: { id: etat[0].id } })
    assert.deepEqual((await lignes()).map((l) => l.recolteOrigineId), [null], 'SET NULL à la suppression directe de la racine')
    await prisma.recolte.deleteMany({ where: { userId: user.id } })

    // 4. Reprise des scissions antérieures à la colonne, sur les notes écrites par le code.
    const a = await prisma.recolte.create({ data: { ...base, quantite: 3, statut: 'vendu' } })
    const b = await prisma.recolte.create({ data: { ...base, quantite: 5, statut: 'perte', notes: `Reliquat non vendu de la récolte #${a.id}` } })
    const c = await prisma.recolte.create({ data: { ...base, quantite: 2, notes: `Reliquat de la récolte #${b.id}` } })
    const autreJour = await prisma.recolte.create({ data: { ...base, date: new Date('2026-11-20T00:00:00.000Z'), quantite: 1, notes: `Part sortie de la récolte #${a.id}` } })
    const libre = await prisma.recolte.create({ data: { ...base, quantite: 4, notes: 'Planche 4, pour AMAP' } })
    const autreCompte = await prisma.recolte.create({ data: { ...base, userId: cible.id, quantite: 1, notes: `Part sortie de la récolte #${a.id}` } }).catch(() => null)
    // Part ancienne re-scindée depuis la migration : sa part pointe encore la part.
    const d = await prisma.recolte.create({ data: { ...base, quantite: 1, statut: 'don', recolteOrigineId: c.id } })
    assert.deepEqual(await reprendreLigneesCompte(prisma, user.id, false), [{ partId: b.id, racineId: a.id }, { partId: c.id, racineId: a.id }],
      'la chaîne remonte à la récolte saisie ; une autre date ou une note libre ne relient rien')
    assert.equal((await prisma.recolte.count({ where: { userId: user.id, recolteOrigineId: { not: null } } })), 1, 'à blanc, rien n’est écrit')
    await prisma.$transaction((tx) => reprendreLigneesCompte(tx, user.id, true))
    const repris = await prisma.recolte.findMany({ where: { id: { in: [a.id, b.id, c.id, d.id, autreJour.id, libre.id] } }, orderBy: { id: 'asc' }, select: { recolteOrigineId: true } })
    assert.deepEqual(repris.map((l) => l.recolteOrigineId), [null, a.id, a.id, null, null, a.id], 'parts et sous-parts pointent la récolte saisie')
    if (autreCompte) assert.deepEqual(await reprendreLigneesCompte(prisma, cible.id, false), [], 'la note d’un autre compte ne relie rien')
    assert.deepEqual(await reprendreLigneesCompte(prisma, user.id, true), [], 'rejouée, la reprise ne trouve plus rien')

    console.log('Lignée des récoltes : scissions, comptage, restauration de compte, suppression de la racine et reprise validés.')
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [user.id, cible.id] } } })
    await prisma.$disconnect()
  }
}

main().catch((erreur) => { console.error(erreur); process.exitCode = 1 })
