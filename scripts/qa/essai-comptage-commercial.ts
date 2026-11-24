/**
 * Régression 215 : un comptage ne déduit pas une seconde fois un BL déjà livré.
 * Depuis le modèle de stock unique (L4.2, 2026-11-24), le stock est la somme
 * des restes des lots et un comptage les aligne à l'instant où il est fait :
 * une livraison saisie APRÈS le comptage baisse les lots, même datée d'avant
 * lui (le stock est l'état présent des lots ; un nouveau comptage le corrige).
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

async function main() {
  const url = process.env.GLEBA_COMMERCIAL_QA_DATABASE_URL
  if (!url || !/^\/gleba_devis_qa_[a-z0-9_]+$/.test(new URL(url).pathname)) throw new Error('Base jetable gleba_devis_qa_* requise')
  process.env.DATABASE_URL = url
  const { default: db } = await import('../../src/lib/prisma')
  const { creerDocument, agirSurDocument } = await import('../../src/lib/commercial/service')
  const { enregistrerInventaireEspece } = await import('../../src/lib/stocks/inventaire-espece')
  const { calculerStocksNet } = await import('../../src/lib/stocks-helpers')
  const { dateIsoFacture } = await import('../../src/lib/facture-regles')
  const { dateCivile } = await import('../../src/lib/commercial/regles')
  const u = await db.user.create({ data: { email: `comptage-${randomUUID()}@example.test`, emailVerified: true } })
  try {
    await db.exploitation.create({ data: { userId: u.id, raisonSociale: 'Comptage QA', formeJuridique: 'EI', regimeFiscal: 'micro-BA', regimeTva: 'reel-normal', adresseSiege: '1 chemin QA', codePostal: '64000', ville: 'Essai', emailContact: 'qa@example.test' } })
    const client = await db.client.create({ data: { userId: u.id, nom: 'Client comptage QA' } })
    const e = await db.espece.create({ data: { userId: u.id, nom: 'Stock comptage QA', uniteRendement: 'kg_m2' } })
    const c = await db.culture.create({ data: { userId: u.id, especeId: e.id } })
    const r = await db.recolte.create({ data: { userId: u.id, especeId: e.id, cultureId: c.id, quantite: 10, unite: 'kg', date: new Date(Date.now() - 172800000) } })
    const jour = dateIsoFacture(new Date())
    const hier = new Date(dateCivile(jour)); hier.setUTCDate(hier.getUTCDate() - 1)
    const net = async () => (await calculerStocksNet(u.id, e.id))[e.id].stockNet
    const livrer = async (quantite: number, dateLivraison = jour) => {
      const d = await creerDocument(u.id, randomUUID(), { type: 'livraison', clientId: client.id, date: jour, dateValidite: null, dateLivraison: null, objet: 'Comptage QA', notes: '', adresseLivraison: '', categorieOperation: 'biens', lignes: [{ description: 'Stock QA', quantite, unite: 'kg', prixUnitaire: 3, tauxTVA: 5.5, articleStockType: 'recolte', articleStockId: String(r.id) }] })
      await agirSurDocument(u.id, d.id, 'emettre'); await agirSurDocument(u.id, d.id, 'livrer', dateLivraison)
      return d
    }
    const premier = await livrer(4)
    assert.equal(await net(), 6)
    // Forme exacte des journaux 215 déjà écrits : midi civil, création réelle antérieure.
    await db.mouvementStockCommercial.updateMany({ where: { userId: u.id, documentId: premier.id }, data: { date: dateCivile(jour), createdAt: new Date(Date.now() - 1000) } })
    await enregistrerInventaireEspece(u.id, e.id, { stock: 6 })
    assert.equal(await net(), 6, 'après comptage6, le BL antérieur ne retire pas encore4')
    const second = await livrer(2)
    assert.equal(await net(), 4, 'une livraison après le comptage est bien déduite')
    await agirSurDocument(u.id, second.id, 'retourner'); assert.equal(await net(), 6)
    await agirSurDocument(u.id, premier.id, 'retourner'); assert.equal(await net(), 10)
    await enregistrerInventaireEspece(u.id, e.id, { stock: 8 })
    assert.equal(await net(), 8, 'le comptage aligne les lots (écart de 2 par le journal du lot lié)')
    const historique = await livrer(2, dateIsoFacture(hier))
    assert.equal(await net(), 6, 'une livraison saisie après le comptage baisse le lot, même datée d’avant')
    await agirSurDocument(u.id, historique.id, 'retourner'); assert.equal(await net(), 8)
    assert.equal((await db.recolte.findUniqueOrThrow({ where: { id: r.id } })).quantite, 10)
    // Reprise d'un journal ancien créé l'après-midi : date civile AVANT le comptage,
    // mais création APRÈS. Le filtre SQL doit aussi chercher par createdAt.
    const e2 = await db.espece.create({ data: { userId: u.id, nom: 'Journal après comptage', uniteRendement: 'kg_m2' } })
    const c2 = await db.culture.create({ data: { userId: u.id, especeId: e2.id } })
    const r2 = await db.recolte.create({ data: { userId: u.id, especeId: e2.id, cultureId: c2.id, quantite: 10, unite: 'kg', stockDisponibleCommercial: 8, date: new Date(Date.now() - 172800000) } })
    // Modèle de stock unique, L4.1 : un comptage antidaté est refusé (il ne
    // pourrait plus aligner les lots) ; le scénario du journal repris après un
    // comptage du matin n'a plus d'objet.
    const comptage = new Date(hier.getTime() + 3 * 3600000)
    const antidate = await enregistrerInventaireEspece(u.id, e2.id, { stock: 10, dateStock: comptage })
    assert.equal(antidate.ok, false)
    void r2
    console.log('Comptage commercial : ancien journal midi→comptage6→net6, sortie après comptage, retours, comptage aligné, livraison saisie après le comptage et comptage antidaté refusé validés.')
  } finally { await db.user.delete({ where: { id: u.id } }); await db.$disconnect() }
}
main().catch((e) => { console.error(e); process.exitCode = 1 })
