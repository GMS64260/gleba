/** Banc métier sur une base PostGIS jetable, jamais sur un compte ou une base de production. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { writeFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'

async function main() {
  const url = process.env.GLEBA_COMMERCIAL_QA_DATABASE_URL
  if (!url || !/^\/gleba_devis_qa_[a-z0-9_]+$/.test(new URL(url).pathname)) throw new Error('GLEBA_COMMERCIAL_QA_DATABASE_URL doit viser une base gleba_devis_qa_* jetable')
  process.env.DATABASE_URL = url
  const { default: prisma } = await import('../../src/lib/prisma')
  const { creerDocument, agirSurDocument, convertirEnLivraison, facturerDocuments, modifierDocument, supprimerBrouillon } = await import('../../src/lib/commercial/service')
  const { contenuDocumentSchema, dateCivile } = await import('../../src/lib/commercial/regles')
  const { dateIsoFacture } = await import('../../src/lib/facture-regles')
  const { genererPdfCommercial } = await import('../../src/lib/commercial/pdf')
  const { getKpiCompta } = await import('../../src/lib/kpi/compta')
  const { invalidateKpi } = await import('../../src/lib/kpi/cache')
  const { exportAccount } = await import('../../src/lib/account-transfer')
  const jour = dateIsoFacture(new Date())
  const fin = `${jour.slice(0, 7)}-${new Date(Number(jour.slice(0, 4)), Number(jour.slice(5, 7)), 0).getDate()}`
  const suffixe = randomUUID()
  const user = await prisma.user.create({ data: { email: `commercial-${suffixe}@example.test`, name: 'Ferme de contrôle', emailVerified: true } })
  const autre = await prisma.user.create({ data: { email: `autre-${suffixe}@example.test`, emailVerified: true } })
  try {
    await prisma.exploitation.create({ data: { userId: user.id, raisonSociale: 'Ferme de contrôle', formeJuridique: 'EI', regimeFiscal: 'micro-BA', regimeTva: 'reel-normal', adresseSiege: '1 chemin des essais', codePostal: '64000', ville: 'Commune de contrôle', emailContact: 'ferme@example.test' } })
    const client = await prisma.client.create({ data: { userId: user.id, nom: 'Client de contrôle', adresse: '2 rue des essais', email: 'client@example.test' } })
    const clientAutre = await prisma.client.create({ data: { userId: autre.id, nom: client.nom } })
    const contenu = contenuDocumentSchema.parse({ type: 'devis', clientId: client.id, date: jour, dateValidite: fin, dateLivraison: null, objet: 'Livraison de légumes', notes: 'Règlement comptant à réception.', lignes: [{ description: 'Carottes', quantite: 3.25, unite: 'kg', prixUnitaire: 2.3, tauxTVA: 5.5 }, { description: 'Fleurs', quantite: 7, unite: 'tiges', prixUnitaire: 1.2, tauxTVA: 10 }] })
    const cle = randomUUID()
    const [d, meme] = await Promise.all([creerDocument(user.id, cle, contenu), creerDocument(user.id, cle, contenu)])
    assert.equal(d.id, meme.id, 'double clic = un seul devis')
    assert.equal(await prisma.facture.count({ where: { userId: user.id } }), 0)
    assert.equal((await getKpiCompta(user.id, new Date().getFullYear())).revenusYtd, 0, 'un devis n’entre pas au CA')
    await assert.rejects(creerDocument(user.id, randomUUID(), { ...contenu, clientId: clientAutre.id }), /client active/)
    await assert.rejects(agirSurDocument(autre.id, d.id, 'emettre'), /introuvable/)
    await assert.rejects(modifierDocument(autre.id, d.id, contenu), /introuvable/)
    const d2 = await creerDocument(user.id, randomUUID(), { ...contenu, objet: 'Deuxième offre' })
    const [emis, emis2] = await Promise.all([agirSurDocument(user.id, d.id, 'emettre'), agirSurDocument(user.id, d2.id, 'emettre')])
    assert.notEqual(emis.numero, emis2.numero, 'numérotation distincte sous concurrence')
    await assert.rejects(modifierDocument(user.id, d.id, contenu), /brouillon/)
    await assert.rejects(supprimerBrouillon(user.id, d.id), /brouillon/)
    await assert.rejects(facturerDocuments(user.id, [d.id], jour), /accepté/)
    await agirSurDocument(user.id, d.id, 'accepter')
    const [bl, blBis] = await Promise.all([convertirEnLivraison(user.id, d.id), convertirEnLivraison(user.id, d.id)])
    assert.equal(bl.id, blBis.id, 'devis converti une fois seulement')
    assert.equal(bl.totalTTC, d.totalTTC)
    await assert.rejects(facturerDocuments(user.id, [d.id], jour), /sans bon/)
    await assert.rejects(facturerDocuments(user.id, [bl.id], jour), /marqués livrés/)
    await agirSurDocument(user.id, bl.id, 'livrer', jour)
    const bl2 = await creerDocument(user.id, randomUUID(), { ...contenu, type: 'livraison', dateValidite: null, objet: 'Livraison complémentaire' })
    await agirSurDocument(user.id, bl2.id, 'emettre')
    await agirSurDocument(user.id, bl2.id, 'livrer', jour)
    const avant = await getKpiCompta(user.id, new Date().getFullYear())
    assert.equal(avant.revenusYtd, 0, 'les BL ne créent pas de revenu')
    // La fiche peut changer ; les documents gardent les coordonnées négociées.
    await prisma.client.update({ where: { id: client.id }, data: { nom: 'Client renommé' } })
    // Provoquer un échec APRÈS création de facture vérifie le rollback de toute la conversion.
    assert.match(user.id, /^[a-z0-9]+$/)
    const contrainte = `qa_rollback_${user.id}`
    await prisma.$executeRawUnsafe(`ALTER TABLE documents_commerciaux ADD CONSTRAINT ${contrainte} CHECK (user_id <> '${user.id}' OR facture_id IS NULL)`)
    try {
      await assert.rejects(facturerDocuments(user.id, [bl.id, bl2.id], jour))
      assert.equal(await prisma.facture.count({ where: { userId: user.id } }), 0, 'aucune facture orpheline après échec')
      assert.equal(await prisma.sequenceFacture.count({ where: { userId: user.id, type: 'FACTURE' } }), 0, 'aucun numéro consommé après échec')
      assert.equal(await prisma.documentCommercial.count({ where: { userId: user.id, factureId: { not: null } } }), 0)
    } finally {
      await prisma.$executeRawUnsafe(`ALTER TABLE documents_commerciaux DROP CONSTRAINT ${contrainte}`)
    }
    const [f, fBis] = await Promise.all([facturerDocuments(user.id, [bl.id, bl2.id], jour), facturerDocuments(user.id, [bl2.id, bl.id], jour)])
    assert.equal(f.id, fBis.id, 'une seule facture, même avec deux requêtes simultanées')
    assert.equal(f.clientNom, client.nom)
    assert.equal(f.totalTTC, 34.26)
    assert.equal(f.lignes.length, 4)
    assert(f.lignes.every((l) => l.description.includes(jour)))
    assert.equal(await prisma.facture.count({ where: { userId: user.id } }), 1)
    invalidateKpi(user.id)
    assert.equal((await getKpiCompta(user.id, new Date().getFullYear())).revenusYtd, 34.26, 'le CA contient la facture une seule fois')
    assert.equal((await prisma.documentCommercial.findUniqueOrThrow({ where: { id: d.id } })).factureId, f.id)
    const sauvegarde = await exportAccount(user.id)
    assert.equal(sauvegarde.stats.DocumentCommercial, 4, 'les devis et BL appartiennent à l’export du compte')
    assert.equal(sauvegarde.stats.LigneDocumentCommercial, 8)
    assert.equal(sauvegarde.data.DocumentCommercial.some((ligne) => ligne.userId === autre.id), false)
    await assert.rejects(agirSurDocument(user.id, bl.id, 'annuler'), /converti/)
    // Un changement de régime ne réécrit pas les prix déjà convenus.
    await agirSurDocument(user.id, d2.id, 'accepter')
    await prisma.exploitation.update({ where: { userId: user.id }, data: { regimeTva: 'franchise-293b' } })
    const compteurAvant = await prisma.sequenceFacture.findFirst({ where: { userId: user.id, type: 'FACTURE' } })
    await assert.rejects(facturerDocuments(user.id, [d2.id], jour), /fiscal a changé/)
    assert.equal((await prisma.sequenceFacture.findFirst({ where: { userId: user.id, type: 'FACTURE' } }))?.prochainNum, compteurAvant?.prochainNum)
    const sansTva = await creerDocument(user.id, randomUUID(), contenu)
    assert.equal(sansTva.totalTVA, 0); assert.equal(sansTva.totalTTC, 15.88)
    const montantAvant = await prisma.facture.count({ where: { userId: user.id } })
    await prisma.$transaction(async (tx) => {
      await tx.documentCommercial.update({ where: { id: sansTva.id }, data: { date: dateCivile(jour) } })
      throw new Error('rollback témoin')
    }).catch((e: unknown) => { assert.match(String(e), /rollback témoin/) })
    assert.equal(await prisma.facture.count({ where: { userId: user.id } }), montantAvant)
    const dossier = process.env.GLEBA_COMMERCIAL_QA_ARTIFACTS || '/tmp/gleba-devis-qa'
    await mkdir(dossier, { recursive: true })
    const long = await creerDocument(user.id, randomUUID(), { ...contenu, lignes: Array.from({ length: 100 }, (_, i) => ({ ...contenu.lignes[0], description: `Ligne ${i + 1} : légumes et conditions de livraison détaillées.` })) })
    for (const [nom, doc] of [['devis', emis], ['bon-livraison', bl], ['devis-long', long]] as const) {
      const chemin = `${dossier}/${nom}.pdf`
      await writeFile(chemin, await genererPdfCommercial(doc))
      const texte = execFileSync('gs', ['-q', '-dBATCH', '-dNOPAUSE', '-sDEVICE=txtwrite', '-sOutputFile=-', chemin], { encoding: 'utf8' })
      assert(texte.includes(doc.clientNom)); assert(texte.includes(doc.objet)); assert(texte.includes('Carottes') || texte.includes('Ligne 100'))
      if (nom === 'devis-long') assert(texte.includes('Ligne 100'))
      if (nom === 'bon-livraison') assert(texte.includes('ne vaut pas facture'))
    }
    console.log(JSON.stringify({ ok: true, concurrence: true, isolation: true, fiscalite: true, chiffreAffaires: true, pdfs: dossier }))
  } finally {
    // Le test de cascade couvre aussi la suppression de compte et les relations devis/BL/facture.
    await prisma.user.deleteMany({ where: { id: { in: [user.id, autre.id] } } })
    assert.equal(await prisma.documentCommercial.count({ where: { userId: user.id } }), 0)
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
