/**
 * Utilitaire centralise pour la creation de factures
 * Utilisé par : comptabilite/factures, elevage/ventes, elevage/abattages
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
}

export interface CreerFactureParams {
  userId: string
  type: string
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
 * Cree une facture dans une transaction Prisma.
 * Gere la numerotation sequentielle (F-{year}-{seq} / AV-{year}-{seq}).
 * Resout le client par ID si fourni.
 */
export async function creerFacture(tx: PrismaTx, params: CreerFactureParams) {
  const year = (params.date || new Date()).getFullYear()
  const prefix = params.type === 'avoir' ? 'AV' : 'F'

  const lastFacture = await tx.facture.findFirst({
    where: {
      userId: params.userId,
      numero: { startsWith: `${prefix}-${year}-` },
    },
    orderBy: { numero: 'desc' },
  })

  let nextNum = 1
  if (lastFacture) {
    const parts = lastFacture.numero.split('-')
    nextNum = parseInt(parts[2]) + 1
  }
  const numero = `${prefix}-${year}-${String(nextNum).padStart(4, '0')}`

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
      date: params.date || new Date(),
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
        })),
      },
    },
    include: {
      lignes: true,
      client: true,
    },
  })
}
