import { deviseFactureReglement } from './devise-reglement'
import { verrouillerReglements } from './verrou-reglements'
/** Adaptateur utilisé par les générateurs de miroirs, dans leur transaction. */
import type { Prisma } from '@prisma/client'
import { cleFacture, cleSourceReglement } from './cle-reglement'
import { enCentimes, entierCentimes, ErreurReglement } from './monnaie'

type Db = Prisma.TransactionClient
export async function suiviReglementParCle(db: Db, userId: string, cle: string) {
  const lignes = await db.$queryRaw<Array<{ dossier_id: string; regle: bigint }>>`
    SELECT c.dossier_id, COALESCE((SELECT SUM(r.montant_centimes) FROM reglements r WHERE r.dossier_id = c.dossier_id AND r.user_id = ${userId} AND r.annule_le IS NULL), 0)::bigint AS regle
    FROM cibles_reglement c WHERE c.user_id = ${userId} AND c.cle = ${cle}`
  const row = lignes[0]
  return row && typeof row.dossier_id === 'string'
    ? { dossierId: row.dossier_id, regle: entierCentimes(row.regle) }
    : null
}
export async function synchroniserReglementSource(
  db: Db,
  userId: string,
  cle: string,
  montant: number,
) {
  const suivi = await suiviReglementParCle(db, userId, cle)
  if (!suivi) return {}
  const total = enCentimes(montant)
  if (total <= 0)
    throw new ErreurReglement(
      'Cette pièce possède un historique de règlements. Conservez sa référence et son journal au lieu d’effacer son montant.',
    )
  if (total < suivi.regle)
    throw new ErreurReglement(
      'Des règlements dépassent le nouveau montant. Enregistrez d’abord le remboursement ou annulez la saisie erronée dans Règlements.',
    )
  await db.dossierReglement.update({
    where: { id: suivi.dossierId, userId },
    data: { montantReferenceCentimes: BigInt(total) },
  })
  return { paye: suivi.regle >= total }
}
export async function verifierSuppressionSourceReglee(db: Db, userId: string, cle: string) {
  const suivi = await suiviReglementParCle(db, userId, cle)
  if (!suivi) return
  // Une facture remplace la source au moment de la facturation ; le journal
  // de paiement reste sur le même dossier, sans dépendre du miroir supprimé.
  const facture = await db.cibleReglement.findFirst({
    where: { userId, dossierId: suivi.dossierId, type: 'Facture' },
    select: { id: true },
  })
  if (!facture)
    throw new ErreurReglement(
      'Cette pièce a des règlements. Régularisez-les avant d’annuler la vente ou la dépense.',
    )
}
export async function rattacherReglementsFacture(
  db: Db,
  userId: string,
  nature: 'vente' | 'depense',
  sourceType: string,
  sourceId: number,
  factureId: number,
) {
  await verrouillerReglements(db, userId)
  const suivi = await suiviReglementParCle(
    db,
    userId,
    cleSourceReglement(nature, sourceType, sourceId),
  )
  if (!suivi) return
  const f = await db.facture.findFirst({ where: { id: factureId, userId } })
  if (!f || f.type === 'avoir' || !['emise', 'payee'].includes(f.statut))
    throw new ErreurReglement('La facture de remplacement est introuvable ou invalide.')
  const dossier = await db.dossierReglement.findFirst({
    where: { id: suivi.dossierId, userId },
    select: { devise: true },
  })
  if (
    !dossier ||
    deviseFactureReglement(f.emetteurSnapshot, dossier.devise) !== dossier.devise
  )
    throw new ErreurReglement(
      'La devise de la facture ne correspond pas aux règlements déjà saisis. Conservez leurs montants dans leur devise d’origine.',
    )
  if (enCentimes(f.totalTTC) < suivi.regle)
    throw new ErreurReglement('La facture est inférieure aux règlements déjà reçus.')
  const cle = cleFacture(f.id)
  const deja = await db.cibleReglement.findUnique({ where: { userId_cle: { userId, cle } } })
  if (deja && deja.dossierId !== suivi.dossierId)
    throw new ErreurReglement('Cette facture possède déjà un autre suivi de règlement.')
  await db.cibleReglement.upsert({
    where: { userId_cle: { userId, cle } },
    update: {},
    create: {
      userId,
      cle,
      type: 'Facture',
      reference: String(f.id),
      dossierId: suivi.dossierId,
    },
  })
  const paye = suivi.regle >= enCentimes(f.totalTTC)
  await db.dossierReglement.update({
    where: { id: suivi.dossierId, userId },
    data: {
      montantReferenceCentimes: BigInt(enCentimes(f.totalTTC)),
      referencePiece: f.numero,
      datePiece: f.date,
      tiers: f.clientNom,
      libelle: f.objet || f.numero,
    },
  })
  await db.facture.update({
    where: { id: f.id, userId },
    data: {
      statut: paye ? 'payee' : 'emise',
      datePaiement: paye ? (f.datePaiement ?? new Date()) : null,
    },
  })
}

/** Un ancien booléen ne peut pas écraser un journal de versements détaillés. */
export async function verifierPointageDetaille(
  db: Db,
  userId: string,
  cle: string,
  montant: number,
  paye?: boolean,
) {
  const suivi = await suiviReglementParCle(db, userId, cle)
  if (!suivi) return {}
  const total = enCentimes(montant)
  if (typeof paye === 'boolean' && paye !== suivi.regle >= total)
    throw new ErreurReglement(
      'Cette pièce a un journal de règlements. Ajoutez ou corrigez ses versements depuis Règlements.',
    )
  return synchroniserReglementSource(db, userId, cle, montant)
}
