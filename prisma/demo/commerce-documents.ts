/**
 * Devis, bons de livraison et factures, écrits par les fonctions de
 * l'application à une date passée.
 *
 * `src/lib/commercial/service.ts` et les routes de factures datent
 * l'émission, l'accord, la conversion et la facturation à l'instant présent
 * et numérotent dans l'exercice en cours. Pour une ferme qui a vécu ces
 * étapes au fil des mois, ce module rejoue EXACTEMENT les mêmes transactions
 * (verrous, `transitionDocument`, séquence `sequences_facture` relue sous
 * verrou, snapshot émetteur, identité figée de l'acheteur, sortie de stock
 * par `sortirStockCommercial`, facture par `creerFacture`) avec la date réelle
 * de chaque étape : numéro dans l'exercice de son émission, comme si
 * l'exploitant avait cliqué ce jour-là.
 *
 * Les brouillons passent directement par `creerDocument` (sa date est déjà
 * celle du contenu) et par `creerFacture` (numéro provisoire BR-).
 */

import { randomUUID } from "node:crypto"
import { Prisma } from "@prisma/client"
import { creerDocument, relationsDocument } from "../../src/lib/commercial/service"
import { arrondir, calculerDocument, dateCivile, ErreurCommerciale, transitionDocument, verifierSourcesFacturables, type ContenuDocument } from "../../src/lib/commercial/regles"
import { sortirStockCommercial, verifierLignesStock, verrouillerStocksDesLignes } from "../../src/lib/commercial/stock"
import { creerFacture, reserverProchainNumeroForEmission, snapshotEmetteurForEmission, type CreerFactureParams, type EmetteurSnapshot } from "../../src/lib/facture-utils"
import { dateIsoFacture } from "../../src/lib/facture-regles"
import { verrouillerReglements } from "../../src/lib/comptabilite/verrou-reglements"
import { prisma } from "./contexte"

type Tx = Prisma.TransactionClient
export type LigneSaisie = ContenuDocument["lignes"][number]

const exerciceDe = (d: Date) => Number(dateIsoFacture(d).slice(0, 4))

async function verrouiller(tx: Tx, userId: string, ids: string[]) {
  await tx.$queryRaw`SELECT id FROM documents_commerciaux WHERE user_id = ${userId} AND id IN (${Prisma.join([...ids].sort())}) ORDER BY id FOR UPDATE`
}
async function lire(tx: Tx, userId: string, id: string) {
  const d = await tx.documentCommercial.findFirst({ where: { id, userId }, include: relationsDocument })
  if (!d) throw new ErreurCommerciale("Document introuvable", 404)
  return d
}

/** `numeroDocument` de service.ts, dans l'exercice du jour d'émission. */
async function numeroDocument(tx: Tx, userId: string, type: string, quand: Date) {
  const exercice = exerciceDe(quand)
  const typeSeq = type === "devis" ? "DEVIS" : "LIVRAISON"
  const prefixe = `${type === "devis" ? "D" : "BL"}-${exercice}-`
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
  return `${prefixe}${String(n).padStart(4, "0")}`
}

// ─── Devis et bons de livraison ─────────────────────────────────────────────
/** Brouillon (numéro BR-<clé>) : la fonction de l'application telle quelle. */
export function creerBrouillon(userId: string, contenu: ContenuDocument) {
  return creerDocument(userId, randomUUID(), contenu)
}

/** Actions de `agirSurDocument`, à l'instant `quand`. */
export async function agir(userId: string, id: string, action: "emettre" | "accepter" | "refuser" | "livrer", quand: Date) {
  return prisma.$transaction(async (tx) => {
    await verrouiller(tx, userId, [id])
    const d = await lire(tx, userId, id)
    const statut = transitionDocument(d, action, quand)
    const data: Prisma.DocumentCommercialUpdateInput = { statut }
    if (action === "emettre") {
      data.numero = await numeroDocument(tx, userId, d.type, quand)
      data.date = quand
    }
    if (action === "accepter") data.dateAcceptation = quand
    if (action === "livrer") {
      const livraison = dateIsoFacture(quand)
      if (livraison > dateIsoFacture(new Date())) throw new ErreurCommerciale("Indiquez la date réelle de livraison, aujourd’hui ou avant", 400)
      data.dateLivraison = dateCivile(livraison)
      await sortirStockCommercial(tx, userId, d.lignes, { documentId: d.id, numero: d.numero, date: dateCivile(livraison) })
    }
    return tx.documentCommercial.update({ where: { id }, data, include: relationsDocument })
  }, { timeout: 20_000 })
}

/** `convertirEnLivraison` : le BL reprend le devis accepté, numéroté le jour de la conversion. */
export async function convertirEnLivraison(userId: string, id: string, quand: Date) {
  return prisma.$transaction(async (tx) => {
    await verrouiller(tx, userId, [id])
    const d = await lire(tx, userId, id)
    if (d.bonLivraison) return lire(tx, userId, d.bonLivraison.id)
    if (d.type !== "devis" || d.statut !== "accepte" || d.factureId || d.categorieOperation !== "biens") throw new ErreurCommerciale("Choisissez un devis de biens accepté et non facturé")
    const numero = await numeroDocument(tx, userId, "livraison", quand)
    return tx.documentCommercial.create({ data: {
      userId, cleCreation: randomUUID(), numero, type: "livraison", statut: "emis", devisOrigineId: d.id, date: quand,
      clientId: d.clientId, clientNom: d.clientNom, clientAdresse: d.clientAdresse, clientEmail: d.clientEmail,
      clientSiret: d.clientSiret, clientSiren: d.clientSiren, clientTvaIntra: d.clientTvaIntra, clientExonere: d.clientExonere,
      objet: d.objet, notes: d.notes, categorieOperation: d.categorieOperation, adresseLivraison: d.adresseLivraison, dateLivraison: d.dateLivraison,
      emetteurSnapshot: d.emetteurSnapshot as Prisma.InputJsonValue,
      totalHT: d.totalHT, totalTVA: d.totalTVA, totalTTC: d.totalTTC,
      lignes: { create: d.lignes.map((l) => ({ ordre: l.ordre, description: l.description, quantite: l.quantite, unite: l.unite,
        prixUnitaire: l.prixUnitaire, tauxTVA: l.tauxTVA, montantHT: l.montantHT, montantTVA: l.montantTVA, montantTTC: l.montantTTC, statutBio: l.statutBio, articleStockType: l.articleStockType, articleStockId: l.articleStockId })) },
    }, include: relationsDocument })
  }, { timeout: 20_000 })
}

// ─── Factures ───────────────────────────────────────────────────────────────
/**
 * `creerFacture` avec le numéro de l'exercice de sa date : la facture naît
 * brouillon (numéro provisoire, aucune séquence consommée) puis reçoit, dans
 * la même transaction, le numéro réservé sous verrou pour son exercice, comme
 * la transition brouillon → émise de la route des factures.
 */
async function creerFactureDatee(tx: Tx, params: CreerFactureParams & { date: Date }) {
  const statut = params.statut ?? "emise"
  const facture = await creerFacture(tx, { ...params, statut: "brouillon" })
  if (statut === "brouillon") return facture
  const { numero } = await reserverProchainNumeroForEmission(tx, params.userId, exerciceDe(params.date), params.type === "avoir" ? "AVOIR" : "FACTURE")
  return tx.facture.update({ where: { id: facture.id }, data: { numero, statut }, include: { lignes: true, client: true } })
}

function fiscalite(e: EmetteurSnapshot) { return JSON.stringify([e.territoire, e.devise, e.regimeTva]) }

/** `facturerDocuments` : facture des BL livrés (ou d'un devis accepté), datée `quand`. */
export async function facturerDocuments(userId: string, ids: string[], quand: Date, echeance: string) {
  return prisma.$transaction(async (tx) => {
    await verrouiller(tx, userId, ids)
    const docs = await tx.documentCommercial.findMany({ where: { userId, id: { in: ids } }, orderBy: [{ dateLivraison: "asc" }, { id: "asc" }], include: relationsDocument })
    if (docs.length !== ids.length) throw new ErreurCommerciale("Document introuvable", 404)
    verifierSourcesFacturables(docs)
    if (echeance < dateIsoFacture(quand)) throw new ErreurCommerciale("L’échéance ne peut pas précéder la date de facture", 400)
    const premier = docs[0]
    const client = await tx.client.findFirst({ where: { id: premier.clientId!, userId } })
    const emetteur = await snapshotEmetteurForEmission(tx, userId)
    if (!client || !emetteur || client.exonererTVA !== premier.clientExonere || docs.some((d) => fiscalite(d.emetteurSnapshot as unknown as EmetteurSnapshot) !== fiscalite(emetteur))) {
      throw new ErreurCommerciale("L’identité ou le régime fiscal a changé. Révisez les documents avant de facturer, pour conserver les montants convenus.")
    }
    const lignes = docs.flatMap((d) => d.lignes.map((l) => ({
      description: `${d.numero}${d.dateLivraison ? ` du ${dateIsoFacture(d.dateLivraison)}` : ""} : ${l.description}`,
      quantite: l.quantite, unite: l.unite, prixUnitaire: l.prixUnitaire, tauxTVA: l.tauxTVA,
      montantHT: l.montantHT, montantTVA: l.montantTVA, montantTTC: l.montantTTC, statutBio: l.statutBio, articleStockType: l.articleStockType, articleStockId: l.articleStockId,
    })))
    const notes = docs.map((d) => [d.numero, d.adresseLivraison ? `Livraison : ${d.adresseLivraison}` : "", d.notes].filter(Boolean).join("\n")).join("\n\n")
    if (premier.type === "devis") await verrouillerStocksDesLignes(tx, userId, lignes)
    const facture = await creerFactureDatee(tx, {
      userId, type: "facture", statut: "emise", clientId: premier.clientId, date: quand,
      objet: docs.length === 1 ? premier.objet : `Livraisons ${docs.map((d) => d.numero).join(", ")}`,
      dateEcheance: dateCivile(echeance), notes, categorieOperation: premier.categorieOperation,
      dateLivraison: docs.at(-1)!.dateLivraison,
      totalHT: arrondir(docs.reduce((s, d) => s + d.totalHT, 0)),
      totalTVA: arrondir(docs.reduce((s, d) => s + d.totalTVA, 0)),
      totalTTC: arrondir(docs.reduce((s, d) => s + d.totalTTC, 0)), lignes,
    })
    if (premier.type === "devis") {
      await sortirStockCommercial(tx, userId, facture.lignes, { factureId: facture.id, numero: facture.numero, date: quand })
    } else {
      await tx.mouvementStockCommercial.updateMany({ where: { userId, documentId: { in: ids } }, data: { factureId: facture.id } })
    }
    const resultat = await tx.facture.update({ where: { id: facture.id }, data: {
      clientNom: premier.clientNom, clientAdresse: premier.clientAdresse,
      clientSiret: premier.clientSiret, clientSiren: premier.clientSiren, clientTvaIntra: premier.clientTvaIntra,
    }, include: { lignes: true, client: true } })
    await tx.documentCommercial.updateMany({ where: { userId, id: { in: [...ids, ...docs.flatMap((d) => d.devisOrigineId ? [d.devisOrigineId] : [])] } }, data: { factureId: facture.id } })
    return resultat
  }, { timeout: 30_000 })
}

export interface FactureSaisie {
  type: "facture" | "avoir"
  statut: "emise" | "brouillon"
  clientId: number
  /** Jour civil de la facture (champ Date du formulaire). */
  jour: string
  echeance?: string | null
  objet: string
  notes?: string | null
  factureOrigineId?: number
  lignes: LigneSaisie[]
}

/**
 * POST /api/comptabilite/factures : montants des lignes calculés comme le
 * formulaire (PU HT, HT au centime, TVA au centime), stock vérifié à la date
 * de la facture puis sorti à l'émission, avoir plafonné au montant d'origine.
 */
export async function saisirFacture(userId: string, f: FactureSaisie) {
  const date = dateCivile(f.jour)
  const { lignes, totalHT, totalTVA, totalTTC } = calculerDocument(f.lignes)
  return prisma.$transaction(async (tx) => {
    await verrouillerReglements(tx, userId)
    let cleCreationStock: string | null = null
    if (f.lignes.some((l) => l.articleStockType || l.articleStockId)) {
      if (f.type !== "facture") throw new ErreurCommerciale("Les stocks se lient à une facture de vente, pas à un avoir ou un acompte.", 400)
      cleCreationStock = randomUUID()
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gleba:facture-stock:${userId}:${cleCreationStock}`}))`
    }
    const lignesValidees = await verifierLignesStock(tx, userId, lignes, date)
    let categorieOperation = "biens"
    if (f.type === "avoir") {
      const [origine] = await tx.$queryRaw<Array<{ id: number; total_ttc: number; statut: string; type: string }>>`SELECT id, total_ttc, statut, type FROM factures WHERE id = ${f.factureOrigineId!} AND user_id = ${userId} FOR UPDATE`
      if (!origine || origine.type === "avoir" || !["emise", "payee"].includes(origine.statut)) throw new ErreurCommerciale("Facture d’origine introuvable, annulée ou invalide pour un avoir.")
      const cumul = await tx.facture.aggregate({ where: { userId, type: "avoir", factureOrigineId: f.factureOrigineId, statut: { not: "annulee" } }, _sum: { totalTTC: true } })
      if ((cumul._sum.totalTTC ?? 0) + totalTTC > Number(origine.total_ttc) + 0.01) throw new ErreurCommerciale("Le total des avoirs dépasserait le montant de la facture d’origine")
      categorieOperation = (await tx.facture.findFirstOrThrow({ where: { id: f.factureOrigineId!, userId } })).categorieOperation
    }
    await verrouillerStocksDesLignes(tx, userId, lignesValidees)
    const creee = await creerFactureDatee(tx, {
      cleCreationStock, userId, type: f.type, clientId: f.clientId, date, dateEcheance: f.echeance ? dateCivile(f.echeance) : null,
      objet: f.objet, totalHT, totalTVA, totalTTC, statut: f.statut, factureOrigineId: f.factureOrigineId ?? null, notes: f.notes ?? null,
      categorieOperation,
      lignes: lignesValidees.map((l) => ({
        description: l.description, quantite: l.quantite, unite: l.unite, prixUnitaire: l.prixUnitaire, tauxTVA: l.tauxTVA,
        montantHT: l.montantHT, montantTVA: l.montantTVA, montantTTC: l.montantTTC, statutBio: (l as { statutBio?: string | null }).statutBio ?? null,
        articleStockType: l.articleStockType, articleStockId: l.articleStockId,
      })),
    })
    if (f.type === "facture" && f.statut === "emise") await sortirStockCommercial(tx, userId, creee.lignes, { factureId: creee.id, numero: creee.numero, date: creee.date })
    return creee
  }, { timeout: 30_000 })
}
