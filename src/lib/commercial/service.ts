import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { adresseDeFiche, identiteAcheteur } from '@/lib/comptabilite/rattachement-client'
import { creerFacture, snapshotEmetteurForEmission, type EmetteurSnapshot } from '@/lib/facture-utils'
import { dateIsoFacture } from '@/lib/facture-regles'
import {
  arrondir, calculerDocument, dateCivile, ErreurCommerciale, factureSansTaxe,
  transitionDocument, verifierSourcesFacturables, type ContenuDocument,
} from './regles'

import { verifierLignesStock, verrouillerStocksDesLignes, sortirStockCommercial, retournerStockCommercial } from './stock'

type Tx = Prisma.TransactionClient
export const relationsDocument = {
  mouvementsStock: { select: { id: true, origineRetourId: true, quantite: true, sourceNom: true, unite: true, articleStockType: true, articleStockId: true } },
  lignes: { orderBy: { ordre: 'asc' as const } },
  facture: { select: { id: true, numero: true, statut: true } },
  devisOrigine: { select: { id: true, numero: true } },
  bonLivraison: { select: { id: true, numero: true, statut: true } },
} satisfies Prisma.DocumentCommercialInclude
export type DocumentComplet = Prisma.DocumentCommercialGetPayload<{ include: typeof relationsDocument }>

async function verrouiller(tx: Tx, userId: string, ids: string[]) {
  await tx.$queryRaw`SELECT id FROM documents_commerciaux WHERE user_id = ${userId} AND id IN (${Prisma.join([...ids].sort())}) ORDER BY id FOR UPDATE`
}

async function lire(tx: Tx, userId: string, id: string) {
  const d = await tx.documentCommercial.findFirst({ where: { id, userId }, include: relationsDocument })
  if (!d) throw new ErreurCommerciale('Document introuvable', 404)
  return d
}

async function preparer(tx: Tx, userId: string, contenu: ContenuDocument) {
  const client = await tx.client.findFirst({ where: { id: contenu.clientId, userId, actif: true } })
  if (!client) throw new ErreurCommerciale('Choisissez une fiche client active de votre exploitation', 400)
  const emetteur = await snapshotEmetteurForEmission(tx, userId)
  if (!emetteur?.raisonSociale || !emetteur.adresseSiege || !emetteur.ville) {
    throw new ErreurCommerciale('Renseignez d’abord l’identité de votre exploitation dans Paramètres > Exploitation', 400)
  }
  const montants = calculerDocument(await verifierLignesStock(tx, userId, contenu.lignes, dateCivile(contenu.dateLivraison ?? contenu.date)), factureSansTaxe(emetteur.regimeTva) || client.exonererTVA)
  if (montants.totalTTC <= 0 || montants.totalTTC > 1_000_000_000) throw new ErreurCommerciale('Le total doit être positif et inférieur à un milliard', 400)
  return {
    type: contenu.type,
    clientId: client.id,
    clientNom: client.nom,
    clientAdresse: adresseDeFiche(client) || null,
    clientEmail: client.email,
    ...identiteAcheteur(client),
    clientExonere: client.exonererTVA,
    date: dateCivile(contenu.date),
    dateValidite: contenu.type === 'devis' && contenu.dateValidite ? dateCivile(contenu.dateValidite) : null,
    dateLivraison: contenu.dateLivraison ? dateCivile(contenu.dateLivraison) : null,
    objet: contenu.objet,
    notes: contenu.notes || null,
    categorieOperation: contenu.categorieOperation,
    adresseLivraison: contenu.adresseLivraison || adresseDeFiche(client) || null,
    emetteurSnapshot: emetteur as unknown as Prisma.InputJsonValue,
    ...montants,
  }
}

/** Séquence dédiée aux documents, sous le même verrou que la numérotation des factures. */
async function numeroDocument(tx: Tx, userId: string, type: string) {
  const exercice = Number(dateIsoFacture(new Date()).slice(0, 4))
  const typeSeq = type === 'devis' ? 'DEVIS' : 'LIVRAISON'
  const prefixe = `${type === 'devis' ? 'D' : 'BL'}-${exercice}-`
  await tx.$executeRaw`INSERT INTO sequences_facture (id, user_id, exercice, type, prochain_num, prefixe, format, created_at, updated_at)
    VALUES (${randomUUID()}, ${userId}, ${exercice}, ${typeSeq}, 1, ${prefixe}, '%04d', NOW(), NOW())
    ON CONFLICT (user_id, exercice, type) DO NOTHING`
  const [sequence] = await tx.$queryRaw<Array<{ prochain_num: number }>>`SELECT prochain_num FROM sequences_facture
    WHERE user_id = ${userId} AND exercice = ${exercice} AND type = ${typeSeq} FOR UPDATE`
  const [existant] = await tx.$queryRaw<Array<{ maximum: number | null }>>`SELECT MAX(SUBSTRING(numero FROM '([0-9]+)$')::int) AS maximum
    FROM (SELECT numero FROM documents_commerciaux WHERE user_id = ${userId}
      UNION ALL SELECT numero FROM factures WHERE user_id = ${userId}) n
    WHERE numero LIKE ${`${prefixe}%`} AND numero ~ '[0-9]+$'`
  const n = Math.max(sequence.prochain_num, Number(existant.maximum || 0) + 1)
  await tx.sequenceFacture.update({ where: { userId_exercice_type: { userId, exercice, type: typeSeq } }, data: { prochainNum: n + 1 } })
  return `${prefixe}${String(n).padStart(4, '0')}`
}

export async function creerDocument(userId: string, cle: string, contenu: ContenuDocument) {
  return prisma.$transaction(async (tx) => {
    // Sérialise le double envoi avant tout effet ; une reprise rend le même brouillon.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`${userId}:${cle}`}, 0))`
    const existant = await tx.documentCommercial.findUnique({ where: { userId_cleCreation: { userId, cleCreation: cle } }, include: relationsDocument })
    if (existant) return existant
    const { lignes, ...data } = await preparer(tx, userId, contenu)
    return tx.documentCommercial.create({ data: {
      ...data, userId, cleCreation: cle, numero: `BR-${cle}`,
      lignes: { create: lignes },
    }, include: relationsDocument })
  }, { timeout: 15_000 })
}

export async function modifierDocument(userId: string, id: string, contenu: ContenuDocument) {
  return prisma.$transaction(async (tx) => {
    await verrouiller(tx, userId, [id])
    const d = await lire(tx, userId, id)
    if (d.statut !== 'brouillon' || d.devisOrigineId) throw new ErreurCommerciale('Seul un brouillon créé directement est modifiable. Dupliquez ce document pour le réviser.')
    if (contenu.type !== d.type) throw new ErreurCommerciale('Le type du document ne se modifie pas', 400)
    const { lignes, ...data } = await preparer(tx, userId, contenu)
    return tx.documentCommercial.update({ where: { id: d.id }, data: { ...data, lignes: { deleteMany: {}, create: lignes } }, include: relationsDocument })
  })
}

export async function agirSurDocument(userId: string, id: string, action: string, livraison?: string) {
  return prisma.$transaction(async (tx) => {
    await verrouiller(tx, userId, [id])
    const d = await lire(tx, userId, id)
    const statut = transitionDocument(d, action)
    const data: Prisma.DocumentCommercialUpdateInput = { statut }
    if (action === 'emettre') {
      data.numero = await numeroDocument(tx, userId, d.type)
      data.date = new Date()
    }
    if (action === 'accepter') data.dateAcceptation = new Date()
    if (action === 'livrer') {
      if (!livraison || livraison > dateIsoFacture(new Date())) throw new ErreurCommerciale('Indiquez la date réelle de livraison, aujourd’hui ou avant', 400)
      data.dateLivraison = dateCivile(livraison)
      await sortirStockCommercial(tx, userId, d.lignes, { documentId: d.id, numero: d.numero, date: dateCivile(livraison) })
    }
    if (action === 'retourner' || (action === 'annuler' && d.statut === 'livre')) await retournerStockCommercial(tx, userId, { documentId: d.id })
    return tx.documentCommercial.update({ where: { id }, data, include: relationsDocument })
  })
}

export async function supprimerBrouillon(userId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    await verrouiller(tx, userId, [id])
    const d = await lire(tx, userId, id)
    if (d.statut !== 'brouillon' || d.bonLivraison || d.factureId) throw new ErreurCommerciale('Seul un brouillon sans document lié peut être supprimé')
    await tx.documentCommercial.delete({ where: { id } })
  })
}

export async function convertirEnLivraison(userId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    await verrouiller(tx, userId, [id])
    const d = await lire(tx, userId, id)
    if (d.bonLivraison) return lire(tx, userId, d.bonLivraison.id)
    if (d.type !== 'devis' || d.statut !== 'accepte' || d.factureId || d.categorieOperation !== 'biens') throw new ErreurCommerciale('Choisissez un devis de biens accepté et non facturé')
    const numero = await numeroDocument(tx, userId, 'livraison')
    return tx.documentCommercial.create({ data: {
      userId, cleCreation: randomUUID(), numero, type: 'livraison', statut: 'emis', devisOrigineId: d.id,
      clientId: d.clientId, clientNom: d.clientNom, clientAdresse: d.clientAdresse, clientEmail: d.clientEmail,
      clientSiret: d.clientSiret, clientSiren: d.clientSiren, clientTvaIntra: d.clientTvaIntra, clientExonere: d.clientExonere,
      objet: d.objet, notes: d.notes, categorieOperation: d.categorieOperation, adresseLivraison: d.adresseLivraison, dateLivraison: d.dateLivraison,
      emetteurSnapshot: d.emetteurSnapshot as Prisma.InputJsonValue,
      totalHT: d.totalHT, totalTVA: d.totalTVA, totalTTC: d.totalTTC,
      lignes: { create: d.lignes.map((l) => ({ ordre: l.ordre, description: l.description, quantite: l.quantite, unite: l.unite,
        prixUnitaire: l.prixUnitaire, tauxTVA: l.tauxTVA, montantHT: l.montantHT, montantTVA: l.montantTVA, montantTTC: l.montantTTC, statutBio: l.statutBio, articleStockType: l.articleStockType, articleStockId: l.articleStockId })) },
    }, include: relationsDocument })
  })
}

function fiscalite(e: EmetteurSnapshot) { return JSON.stringify([e.territoire, e.devise, e.regimeTva]) }

export async function facturerDocuments(userId: string, ids: string[], echeance: string) {
  return prisma.$transaction(async (tx) => {
    await verrouiller(tx, userId, ids)
    const docs = await tx.documentCommercial.findMany({ where: { userId, id: { in: ids } }, orderBy: [{ dateLivraison: 'asc' }, { id: 'asc' }], include: relationsDocument })
    if (docs.length !== ids.length) throw new ErreurCommerciale('Document introuvable', 404)
    if (docs.every((d) => d.factureId && d.factureId === docs[0].factureId)) {
      return tx.facture.findFirstOrThrow({ where: { id: docs[0].factureId!, userId }, include: { lignes: true, client: true } })
    }
    verifierSourcesFacturables(docs)
    if (echeance < dateIsoFacture(new Date())) throw new ErreurCommerciale('L’échéance ne peut pas précéder la date de facture', 400)
    const premier = docs[0]
    const client = await tx.client.findFirst({ where: { id: premier.clientId!, userId } })
    const emetteur = await snapshotEmetteurForEmission(tx, userId)
    if (!client || !emetteur || client.exonererTVA !== premier.clientExonere || docs.some((d) => fiscalite(d.emetteurSnapshot as unknown as EmetteurSnapshot) !== fiscalite(emetteur))) {
      throw new ErreurCommerciale('L’identité ou le régime fiscal a changé. Révisez les documents avant de facturer, pour conserver les montants convenus.')
    }
    const lignes = docs.flatMap((d) => d.lignes.map((l) => ({
      description: `${d.numero}${d.dateLivraison ? ` du ${dateIsoFacture(d.dateLivraison)}` : ''} : ${l.description}`,
      quantite: l.quantite, unite: l.unite, prixUnitaire: l.prixUnitaire, tauxTVA: l.tauxTVA,
      montantHT: l.montantHT, montantTVA: l.montantTVA, montantTTC: l.montantTTC, statutBio: l.statutBio, articleStockType: l.articleStockType, articleStockId: l.articleStockId,
    })))
    if (lignes.length > 300) throw new ErreurCommerciale('Regroupez moins de bons : 300 lignes au plus par facture', 400)
    const notes = docs.map((d) => [d.numero, d.adresseLivraison ? `Livraison : ${d.adresseLivraison}` : '', d.notes].filter(Boolean).join('\n')).join('\n\n')
    if (notes.length > 5000) throw new ErreurCommerciale('Les conditions dépassent 5 000 caractères. Facturez les bons séparément.', 400)
    if (premier.type === 'devis') await verrouillerStocksDesLignes(tx, userId, lignes)
    const facture = await creerFacture(tx, {
      userId, type: 'facture', statut: 'emise', clientId: premier.clientId,
      objet: docs.length === 1 ? premier.objet : `Livraisons ${docs.map((d) => d.numero).join(', ')}`,
      dateEcheance: dateCivile(echeance), notes, categorieOperation: premier.categorieOperation,
      dateLivraison: docs.at(-1)!.dateLivraison,
      totalHT: arrondir(docs.reduce((s, d) => s + d.totalHT, 0)),
      totalTVA: arrondir(docs.reduce((s, d) => s + d.totalTVA, 0)),
      totalTTC: arrondir(docs.reduce((s, d) => s + d.totalTTC, 0)), lignes,
    })
    if (premier.type === 'devis') {
      await sortirStockCommercial(tx, userId, facture.lignes, { factureId: facture.id, numero: facture.numero, date: new Date() })
    } else {
      await tx.mouvementStockCommercial.updateMany({ where: { userId, documentId: { in: ids } }, data: { factureId: facture.id } })
    }
    // Le changement d'une fiche client ne réécrit pas l'identité contractuelle.
    const resultat = await tx.facture.update({ where: { id: facture.id }, data: {
      clientNom: premier.clientNom, clientAdresse: premier.clientAdresse,
      clientSiret: premier.clientSiret, clientSiren: premier.clientSiren, clientTvaIntra: premier.clientTvaIntra,
    }, include: { lignes: true, client: true } })
    await tx.documentCommercial.updateMany({ where: { userId, id: { in: [...ids, ...docs.flatMap((d) => d.devisOrigineId ? [d.devisOrigineId] : [])] } }, data: { factureId: facture.id } })
    return resultat
  }, { timeout: 20_000 })
}
