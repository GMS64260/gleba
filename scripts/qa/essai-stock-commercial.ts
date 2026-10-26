/** Invariants stock/documents sur une base jetable, jamais sur la production. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

async function main() {
  const url = process.env.GLEBA_COMMERCIAL_QA_DATABASE_URL
  if (!url || !/^\/gleba_devis_qa_[a-z0-9_]+$/.test(new URL(url).pathname)) throw new Error('Une base gleba_devis_qa_* jetable est obligatoire')
  process.env.DATABASE_URL = url
  const { default: db } = await import('../../src/lib/prisma')
  const { creerDocument, agirSurDocument, convertirEnLivraison, facturerDocuments } = await import('../../src/lib/commercial/service')
  const { chargerCatalogueStock } = await import('../../src/lib/commercial/catalogue-stock')
  const { sortirStockCommercial, retournerStockCommercial } = await import('../../src/lib/commercial/stock')
  const { creerFacture } = await import('../../src/lib/facture-utils')
  const { calculerStocksNet } = await import('../../src/lib/stocks-helpers')
  const { computeStocksUnifies } = await import('../../src/lib/comptabilite/stocks-unifies')
  const { contenuDocumentSchema } = await import('../../src/lib/commercial/regles')
  const { exportAccount, importAccount } = await import('../../src/lib/account-transfer')
  const { computeStockOeufsParLots } = await import('../../src/lib/elevage/stock-oeufs-lots')
  const { synchroniserStockOeufsVente } = await import('../../src/lib/elevage/stock-oeufs-vente')
  const { confirmCommandeBoutique, annulerCommandeBoutique } = await import('../../src/lib/commande-boutique')
  const { verrouillerRecolteLibre } = await import('../../src/lib/commercial/verrou-lot')
  const suffixe = randomUUID()
  const u = await db.user.create({ data: { email: `stock-${suffixe}@example.test`, emailVerified: true } })
  const autre = await db.user.create({ data: { email: `stock-autre-${suffixe}@example.test`, emailVerified: true } })
  const importe = await db.user.create({ data: { email: `stock-import-${suffixe}@example.test`, emailVerified: true } })
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const hier = new Date(`${jour}T00:00:00Z`); hier.setUTCDate(hier.getUTCDate() - 1)
  try {
    await db.exploitation.create({ data: { userId: u.id, raisonSociale: 'Ferme QA stock', formeJuridique: 'EI', regimeFiscal: 'micro-BA', emailContact: 'qa@example.test', adresseSiege: '1 chemin de contrôle', codePostal: '64000', ville: 'Essai', regimeTva: 'reel-normal' } })
    const client = await db.client.create({ data: { userId: u.id, nom: 'Client QA stock' } })
    const espece = await db.espece.create({ data: { userId: u.id, nom: 'Carotte QA', prixKg: 3, uniteRendement: 'kg_m2' } })
    const tiges = await db.espece.create({ data: { userId: u.id, nom: 'Fleurs QA', uniteRendement: 'tiges_m2' } })
    const culture = await db.culture.create({ data: { userId: u.id, especeId: espece.id } })
    const r = await db.recolte.create({ data: { userId: u.id, especeId: espece.id, cultureId: culture.id, date: hier, quantite: 10, unite: 'kg', statutBioSnapshot: 'AB' } })
    const t = await db.recolte.create({ data: { userId: u.id, especeId: tiges.id, cultureId: culture.id, date: hier, quantite: 20, unite: 'tige' } })
    const arbre = await db.arbre.create({ data: { userId: u.id, nom: 'Pommier QA', type: 'fruitier', posX: 0, posY: 0 } })
    const fruit = await db.recolteArbre.create({ data: { userId: u.id, arbreId: arbre.id, quantite: 8, date: hier } })
    const bois = await db.productionBois.create({ data: { userId: u.id, type: 'bois_chauffage', volumeStere: 5, date: hier } })
    const ponte = await db.productionOeuf.create({ data: { userId: u.id, date: hier, quantite: 30 } })
    await db.productionOeuf.create({ data: { userId: u.id, date: new Date('2020-01-01'), quantite: 100 } })
    await db.productionRuche.create({ data: { userId: u.id, date: hier, produit: 'miel', quantite: 4, unite: 'kg' } })
    await db.productionRuche.create({ data: { userId: u.id, date: hier, produit: 'miel', quantite: 500, unite: 'g' } })
    const fromage = await db.lotFromage.create({ data: { userId: u.id, numeroLot: `QA-${suffixe}`, dateFabrication: hier, typeFromage: 'Tomme', volumeLaitUtiliseL: 10, nbPieces: 10, poidsTotalKg: 2, etat: 'pret' } })
    const boutique = await db.boutique.create({ data: { userId: u.id, nom: 'Boutique QA', slug: `qa-${suffixe}` } })
    const produit = await db.produitBoutique.create({ data: { userId: u.id, boutiqueId: boutique.id, nom: 'Panier QA', prix: 10, stockDispo: 6, actif: false } })
    const catalogue = await chargerCatalogueStock(u.id)
    assert.equal(catalogue.find((a) => a.type === 'recolte' && a.id === String(r.id))?.prixTTC, 3)
    assert.equal(catalogue.find((a) => a.type === 'oeufs')?.disponible, 30, 'les œufs périmés ne sont pas proposés')
    assert.equal(catalogue.find((a) => a.type === 'ruche')?.disponible, 4.5, 'kg et g de miel partagent le même stock')
    assert.equal((await chargerCatalogueStock(autre.id)).length, 0, 'catalogue isolé par compte')
    const ligne = { description: 'Carotte QA', quantite: 4, unite: 'kg', prixUnitaire: 3, tauxTVA: 5.5 as const, articleStockType: 'recolte' as const, articleStockId: String(r.id) }
    const contenu = contenuDocumentSchema.parse({ type: 'devis', clientId: client.id, date: jour, dateValidite: jour, dateLivraison: null, objet: 'Lot QA', lignes: [ligne] })
    const devis = await creerDocument(u.id, randomUUID(), contenu)
    assert.equal(devis.lignes[0].statutBio, 'AB', 'bio repris du lot, pas du navigateur')
    await agirSurDocument(u.id, devis.id, 'emettre'); await agirSurDocument(u.id, devis.id, 'accepter')
    assert.equal((await db.recolte.findUniqueOrThrow({ where: { id: r.id } })).stockDisponibleCommercial, null, 'le devis ne réserve ni ne débite le stock')
    const bon = await convertirEnLivraison(u.id, devis.id)
    assert.equal(bon.lignes[0].articleStockId, String(r.id), 'la conversion garde le lot source')
    await agirSurDocument(u.id, bon.id, 'livrer', jour)
    assert.equal((await db.recolte.findUniqueOrThrow({ where: { id: r.id } })).stockDisponibleCommercial, 6)
    assert.equal((await db.recolte.findUniqueOrThrow({ where: { id: r.id } })).quantite, 10, 'le volume de production reste inchangé')
    assert.equal((await calculerStocksNet(u.id, espece.id))[espece.id].stockNet, 6)
    const avant = await db.mouvementStockCommercial.count({ where: { userId: u.id } })
    const facture = await facturerDocuments(u.id, [bon.id], jour)
    await facturerDocuments(u.id, [bon.id], jour)
    assert.equal(await db.mouvementStockCommercial.count({ where: { userId: u.id } }), avant, 'facturer le BL ne redébite pas')
    assert.equal(facture.lignes[0].articleStockId, String(r.id), 'la facture conserve le lien au stock')
    await assert.rejects(db.recolte.update({ where: { id: r.id }, data: { statut: 'vendu' } }), /STOCK_COMMERCIAL_LIE/, 'l’ancien écran ne peut pas revendre le lot')
    const nouveauBL = async (quantite: number, supplement = {}) => {
      const d = await creerDocument(u.id, randomUUID(), { ...contenu, type: 'livraison', lignes: [{ ...ligne, quantite, ...supplement }] })
      await agirSurDocument(u.id, d.id, 'emettre'); return d
    }
    const [a, b] = await Promise.all([nouveauBL(4), nouveauBL(4)])
    const resultats = await Promise.allSettled([agirSurDocument(u.id, a.id, 'livrer', jour), agirSurDocument(u.id, b.id, 'livrer', jour)])
    assert.equal(resultats.filter((r) => r.status === 'fulfilled').length, 1, 'deux BL concurrents ne sur-vendent pas le lot')
    assert.equal((await db.recolte.findUniqueOrThrow({ where: { id: r.id } })).stockDisponibleCommercial, 2)
    const gagnant = resultats[0].status === 'fulfilled' ? a : b
    await agirSurDocument(u.id, gagnant.id, 'retourner')
    await assert.rejects(agirSurDocument(u.id, gagnant.id, 'retourner'))
    assert.equal((await db.recolte.findUniqueOrThrow({ where: { id: r.id } })).stockDisponibleCommercial, 6, 'un retour est appliqué une fois')
    await assert.rejects(nouveauBL(1.5, { articleStockId: String(t.id), unite: 'tige' }), /entières/)
    await assert.rejects(nouveauBL(1, { articleStockId: String(t.id), unite: 'kg' }), /unité/)
    const clientAutre = await db.client.create({ data: { userId: autre.id, nom: 'Autre client' } })
    await db.exploitation.create({ data: { userId: autre.id, raisonSociale: 'Autre ferme', regimeTva: 'reel-normal', formeJuridique: 'EI', regimeFiscal: 'micro-BA', emailContact: 'qa@example.test', adresseSiege: '2 chemin', codePostal: '64000', ville: 'Essai' } })
    await assert.rejects(creerDocument(autre.id, randomUUID(), { ...contenu, clientId: clientAutre.id }), /stock.*disponible/)
    const lignesMultiples = [
      { ...ligne, articleStockType: 'fruit' as const, articleStockId: String(fruit.id), quantite: 2 },
      { ...ligne, articleStockType: 'bois' as const, articleStockId: String(bois.id), unite: 'stère', quantite: 2 },
      { ...ligne, articleStockType: 'boutique' as const, articleStockId: String(produit.id), unite: 'pièce', quantite: 2 },
      { ...ligne, articleStockType: 'oeufs' as const, articleStockId: 'stock', unite: 'pièce', quantite: 12 },
      { ...ligne, articleStockType: 'ruche' as const, articleStockId: 'miel', quantite: 4.2 },
      { ...ligne, articleStockType: 'fromage' as const, articleStockId: fromage.id, unite: 'pièce', quantite: 3 },
    ]
    const multi = await creerDocument(u.id, randomUUID(), { ...contenu, type: 'livraison', lignes: lignesMultiples })
    await agirSurDocument(u.id, multi.id, 'emettre'); await agirSurDocument(u.id, multi.id, 'livrer', jour)
    assert.equal((await db.recolteArbre.findUniqueOrThrow({ where: { id: fruit.id } })).stockDisponibleCommercial, 6)
    assert.equal((await db.productionBois.findUniqueOrThrow({ where: { id: bois.id } })).stockDisponibleCommercial, 3)
    assert.equal((await db.produitBoutique.findUniqueOrThrow({ where: { id: produit.id } })).stockDispo, 4)
    assert.equal((await computeStockOeufsParLots(u.id)).stats.commercialisables, 18)
    assert.equal((await chargerCatalogueStock(u.id)).find((a) => a.type === 'ruche')?.disponible! > 0.299 && (await chargerCatalogueStock(u.id)).find((a) => a.type === 'ruche')?.disponible! < 0.301, true)
    assert.equal((await chargerCatalogueStock(u.id)).find((a) => a.type === 'fromage')?.disponible, 7)
    await assert.rejects(db.$transaction((tx) => synchroniserStockOeufsVente(tx, { userId: u.id, venteId: 9981, date: new Date(), quantite: 19, unite: 'unite' })), /insuffisant/, 'les ventes natives voient les sorties du BL')
    // Le second article échoue : la sortie du premier et le changement du BL doivent être annulés.
    const rollback = await creerDocument(u.id, randomUUID(), { ...contenu, type: 'livraison', lignes: [{ ...ligne, quantite: 1 }, { ...ligne, quantite: 999 }] })
    await agirSurDocument(u.id, rollback.id, 'emettre')
    await assert.rejects(agirSurDocument(u.id, rollback.id, 'livrer', jour), /insuffisant/)
    assert.equal((await db.recolte.findUniqueOrThrow({ where: { id: r.id } })).stockDisponibleCommercial, 6, 'sortie atomique sur plusieurs lignes')
    assert.equal((await db.documentCommercial.findUniqueOrThrow({ where: { id: rollback.id } })).statut, 'emis')
    await agirSurDocument(u.id, multi.id, 'retourner')
    assert.equal((await computeStockOeufsParLots(u.id)).stats.commercialisables, 30)
    assert.equal((await chargerCatalogueStock(u.id)).find((a) => a.type === 'ruche')?.disponible, 4.5)
    assert.equal((await chargerCatalogueStock(u.id)).find((a) => a.type === 'fromage')?.disponible, 10)
    assert.equal(await db.venteProduit.count({ where: { userId: u.id } }), 0, 'livrer ne crée pas une seconde vente comptable')
    const direct = await db.$transaction(async (tx) => {
      const f = await creerFacture(tx, { userId: u.id, type: 'facture', objet: 'Facture directe', totalHT: 3, totalTVA: 0, totalTTC: 3, lignes: [{ ...ligne, quantite: 1, montantHT: 3, montantTVA: 0, montantTTC: 3 }] })
      await sortirStockCommercial(tx, u.id, f.lignes, { factureId: f.id, numero: f.numero, date: new Date() })
      await sortirStockCommercial(tx, u.id, f.lignes, { factureId: f.id, numero: f.numero, date: new Date() })
      return f
    })
    assert.equal((await calculerStocksNet(u.id, espece.id))[espece.id].stockNet, 5)
    await db.$transaction((tx) => retournerStockCommercial(tx, u.id, { factureId: direct.id }))
    await db.$transaction((tx) => retournerStockCommercial(tx, u.id, { factureId: direct.id }))
    assert.equal((await calculerStocksNet(u.id, espece.id))[espece.id].stockNet, 6)
    // Une facture directe issue d'un devis et un BL disputent les mêmes 6 kg.
    const offre = await creerDocument(u.id, randomUUID(), contenu)
    await agirSurDocument(u.id, offre.id, 'emettre'); await agirSurDocument(u.id, offre.id, 'accepter')
    const bonConcurrent = await nouveauBL(4)
    const avantFactures = await db.facture.count({ where: { userId: u.id } })
    const sequenceAvant = await db.sequenceFacture.findFirstOrThrow({ where: { userId: u.id, type: 'FACTURE' } })
    const concurrence = await Promise.allSettled([facturerDocuments(u.id, [offre.id], jour), agirSurDocument(u.id, bonConcurrent.id, 'livrer', jour)])
    assert.equal(concurrence.filter((r) => r.status === 'fulfilled').length, 1, 'BL et facture partagent le contrôle du reliquat')
    assert.equal((await db.recolte.findUniqueOrThrow({ where: { id: r.id } })).stockDisponibleCommercial, 2)
    assert.equal(await db.facture.count({ where: { userId: u.id } }), avantFactures + (concurrence[0].status === 'fulfilled' ? 1 : 0), 'une facture refusée ne consomme ni facture ni stock')
    assert.equal((await db.sequenceFacture.findFirstOrThrow({ where: { userId: u.id, type: 'FACTURE' } })).prochainNum, sequenceAvant.prochainNum + (concurrence[0].status === 'fulfilled' ? 1 : 0), 'le refus de stock annule aussi le numéro réservé')
    if (concurrence[0].status === 'fulfilled') await db.$transaction((tx) => retournerStockCommercial(tx, u.id, { factureId: concurrence[0].status === 'fulfilled' ? concurrence[0].value.id : -1 }))
    else await agirSurDocument(u.id, bonConcurrent.id, 'retourner')
    // Boutique et BL : aucun des deux ne peut réécrire le stock lu avant l'autre.
    const commande = await db.commandeBoutique.create({ data: { userId: u.id, boutiqueId: boutique.id, numero: `CMD-${suffixe}`, clientNom: 'Client QA', clientEmail: 'qa@example.test', total: 30, lignes: { create: [{ produitId: produit.id, nom: produit.nom, prixUnitaire: 10, unite: 'pièce', quantite: 3, total: 30 }] } } })
    const bonBoutique = await creerDocument(u.id, randomUUID(), { ...contenu, type: 'livraison', lignes: [{ ...ligne, articleStockType: 'boutique', articleStockId: String(produit.id), unite: 'pièce', quantite: 2 }] })
    await agirSurDocument(u.id, bonBoutique.id, 'emettre')
    await Promise.all([db.$transaction((tx) => confirmCommandeBoutique(commande.id, { provider: 'Manuel' }, tx)), agirSurDocument(u.id, bonBoutique.id, 'livrer', jour)])
    assert.equal((await db.produitBoutique.findUniqueOrThrow({ where: { id: produit.id } })).stockDispo, 1, 'commande 3 + BL 2 : 1 reste sur 6')
    await Promise.all([db.$transaction((tx) => annulerCommandeBoutique(commande.id, 'Annulé', tx)), db.$transaction((tx) => annulerCommandeBoutique(commande.id, 'Annulé', tx)), agirSurDocument(u.id, bonBoutique.id, 'retourner')])
    assert.equal((await db.produitBoutique.findUniqueOrThrow({ where: { id: produit.id } })).stockDispo, 6, 'retours concurrents : chaque quantité est rendue une seule fois')
    const stocks = await computeStocksUnifies(u.id)
    assert.equal(stocks.data.find((s) => s.id.startsWith(`recolte-potager-${espece.id}`))?.stock, 6, 'l’écran des stocks utilise le reliquat')
    // Publication et vente historique du même lot : le recontrôle a lieu après le verrou.
    const pool = await db.recolte.create({ data: { userId: u.id, especeId: espece.id, cultureId: culture.id, date: hier, quantite: 5, unite: 'kg' } })
    let signalVerrou = () => {}
    const verrouPris = new Promise<void>((resolve) => { signalVerrou = resolve })
    const publication = db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM recoltes WHERE id = ${pool.id} FOR UPDATE`
      signalVerrou()
      await new Promise((resolve) => setTimeout(resolve, 40))
      return tx.produitBoutique.create({ data: { userId: u.id, boutiqueId: boutique.id, recolteId: pool.id, nom: 'Lot boutique QA', prix: 3, unite: 'kg', stockDispo: 5 } })
    })
    await verrouPris
    await assert.rejects(db.$transaction((tx) => verrouillerRecolteLibre(tx, u.id, pool.id)), /catalogue boutique/, 'une vente ancienne ne passe pas après la publication')
    const produitPool = await publication
    const cmdPool = await db.commandeBoutique.create({ data: { userId: u.id, boutiqueId: boutique.id, numero: `POOL-${suffixe}`, clientNom: 'Client QA', clientEmail: 'qa@example.test', total: 15, lignes: { create: [{ produitId: produitPool.id, nom: produitPool.nom, prixUnitaire: 3, unite: 'kg', quantite: 5, total: 15 }] } } })
    await db.$transaction((tx) => confirmCommandeBoutique(cmdPool.id, { provider: 'Manuel' }, tx))
    assert.equal((await db.recolte.findUniqueOrThrow({ where: { id: pool.id } })).statut, 'vendu', 'la migration laisse fonctionner la confirmation boutique historique sans marqueur spécial')
    await db.$transaction((tx) => annulerCommandeBoutique(cmdPool.id, 'Annulé', tx))
    assert.equal((await db.recolte.findUniqueOrThrow({ where: { id: pool.id } })).statut, 'en_stock')
    // Export/import : les identifiants numériques de lots changent, les lignes les suivent.
    await db.espece.updateMany({ where: { id: { in: [espece.id, tiges.id] } }, data: { userId: null } }) // référentiels communs présents sur la cible
    const archive = await exportAccount(u.id)
    await db.user.delete({ where: { id: u.id } }) // simule un transfert entre deux instances, sans collisions de cuid source
    const transfert = await importAccount(importe.id, archive, { dryRun: false })
    assert.equal(transfert.skipped?.MouvementStockCommercial ?? 0, 0, 'le journal commercial est transféré')
    const recolteImportee = await db.recolte.findFirstOrThrow({ where: { userId: importe.id, especeId: espece.id, quantite: 10 } })
    const ligneImportee = await db.ligneDocumentCommercial.findFirstOrThrow({ where: { document: { userId: importe.id }, articleStockType: 'recolte' } })
    assert.notEqual(recolteImportee.id, r.id)
    assert.equal(ligneImportee.articleStockId, String(recolteImportee.id), 'les liens polymorphes sont remappés')
    console.log('Stock commercial : devis, BL, facture, retours, concurrence, unités, ateliers, rollback, isolation et transfert validés.')
  } finally {
    await db.user.deleteMany({ where: { id: { in: [u.id, autre.id, importe.id] } } })
    await db.$disconnect()
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
