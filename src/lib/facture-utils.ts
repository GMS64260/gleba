/**
 * Utilitaire centralisé pour la création de factures.
 *
 * PROMPT 14B — Numérotation continue garantie par `SequenceFacture` :
 *   - une ligne par (user, exercice, type) verrouillée FOR UPDATE
 *   - incrément atomique dans la transaction d'écriture
 *   - aucun saut, aucun doublon, même sous concurrence
 *
 * Utilisé par : comptabilite/factures, elevage/ventes, elevage/abattages,
 * production-bois, recoltes-arbres.
 */

import type { PrismaClient } from '@prisma/client'

type PrismaTx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

export interface LigneFactureInput {
  description: string
  quantite: number
  unite: string
  prixUnitaire: number
  tauxTVA: number
  montantHT: number
  montantTVA: number
  montantTTC: number
  statutBio?: string | null
}

export interface CreerFactureParams {
  userId: string
  type: string // 'facture' | 'avoir' | 'acompte'
  clientId?: number | null
  clientNom?: string
  clientAdresse?: string | null
  date?: Date
  dateEcheance?: Date | null
  objet: string
  totalHT: number
  totalTVA: number
  totalTTC: number
  statut?: string
  modePaiement?: string | null
  datePaiement?: Date | null
  mentionsLegales?: string | null
  notes?: string | null
  factureOrigineId?: number | null
  lignes: LigneFactureInput[]
}

/**
 * Réserve atomiquement le prochain numéro pour (user, exercice, type)
 * en lockant la ligne `sequences_facture` correspondante (FOR UPDATE).
 *
 * Si la séquence n'existe pas encore (cas d'un nouvel exercice), elle est
 * initialisée à 1. Le `INSERT ... ON CONFLICT` garantit qu'une transaction
 * concurrente ne créera pas de doublon : le second arrivant trouvera la
 * ligne et la verrouillera après la première transaction.
 */
async function reserverProchainNumero(
  tx: PrismaTx,
  userId: string,
  exercice: number,
  typeSeq: 'FACTURE' | 'AVOIR' | 'DEVIS'
): Promise<{ numero: string; prefixe: string }> {
  const prefixeDefaut =
    typeSeq === 'AVOIR' ? `AV-${exercice}-` : typeSeq === 'DEVIS' ? `D-${exercice}-` : `F-${exercice}-`

  // Insert idempotent si la séquence n'existe pas encore pour cet exercice
  await tx.$executeRawUnsafe(
    `
    INSERT INTO sequences_facture (id, user_id, exercice, type, prochain_num, prefixe, format, created_at, updated_at)
    VALUES (gen_random_uuid()::text, $1, $2, $3, 1, $4, '%04d', NOW(), NOW())
    ON CONFLICT (user_id, exercice, type) DO NOTHING
    `,
    userId,
    exercice,
    typeSeq,
    prefixeDefaut
  )

  // Lock + lecture du numéro courant
  const rows = await tx.$queryRawUnsafe<Array<{ prochain_num: number; prefixe: string; format: string }>>(
    `
    SELECT prochain_num, prefixe, format
    FROM sequences_facture
    WHERE user_id = $1 AND exercice = $2 AND type = $3
    FOR UPDATE
    `,
    userId,
    exercice,
    typeSeq
  )

  if (rows.length === 0) {
    throw new Error('Séquence de facturation introuvable après upsert')
  }

  const { prochain_num, prefixe, format } = rows[0]
  const num = Number(prochain_num)

  // Padding selon format ('%04d' → '0042')
  const widthMatch = /^%0?(\d+)d$/.exec(format)
  const width = widthMatch ? parseInt(widthMatch[1], 10) : 4
  const numero = `${prefixe}${String(num).padStart(width, '0')}`

  // Incrément
  await tx.$executeRawUnsafe(
    `UPDATE sequences_facture SET prochain_num = prochain_num + 1, updated_at = NOW()
     WHERE user_id = $1 AND exercice = $2 AND type = $3`,
    userId,
    exercice,
    typeSeq
  )

  return { numero, prefixe }
}

/** Map type métier ('facture'|'avoir'|'acompte') → type séquence. */
function typeSequence(typeFacture: string): 'FACTURE' | 'AVOIR' | 'DEVIS' {
  if (typeFacture === 'avoir') return 'AVOIR'
  if (typeFacture === 'devis') return 'DEVIS'
  return 'FACTURE' // facture, acompte
}

/**
 * Crée une facture dans une transaction Prisma.
 * Gère la numérotation séquentielle avec lock FOR UPDATE (PROMPT 14B).
 */
export async function creerFacture(tx: PrismaTx, params: CreerFactureParams) {
  const date = params.date || new Date()
  const exercice = date.getFullYear()
  const typeSeq = typeSequence(params.type)

  const { numero } = await reserverProchainNumero(tx, params.userId, exercice, typeSeq)

  let clientNom = params.clientNom || 'Client anonyme'
  let clientAdresse = params.clientAdresse || null

  if (params.clientId) {
    const client = await tx.client.findFirst({
      where: { id: params.clientId, userId: params.userId },
    })
    if (client) {
      clientNom = client.nom
      clientAdresse = [client.adresse, client.codePostal, client.ville].filter(Boolean).join(', ')
    }
  }

  return tx.facture.create({
    data: {
      userId: params.userId,
      numero,
      type: params.type,
      clientId: params.clientId || null,
      clientNom,
      clientAdresse,
      date,
      dateEcheance: params.dateEcheance || null,
      objet: params.objet,
      totalHT: params.totalHT,
      totalTVA: params.totalTVA,
      totalTTC: params.totalTTC,
      statut: params.statut || 'emise',
      modePaiement: params.modePaiement || null,
      datePaiement: params.datePaiement || null,
      factureOrigineId: params.factureOrigineId || null,
      mentionsLegales: params.mentionsLegales || null,
      notes: params.notes || null,
      lignes: {
        create: params.lignes.map((l, index) => ({
          ordre: index,
          description: l.description,
          quantite: l.quantite,
          unite: l.unite,
          prixUnitaire: l.prixUnitaire,
          tauxTVA: l.tauxTVA,
          montantHT: l.montantHT,
          montantTVA: l.montantTVA,
          montantTTC: l.montantTTC,
          statutBio: l.statutBio ?? null,
        })),
      },
    },
    include: {
      lignes: true,
      client: true,
    },
  })
}
