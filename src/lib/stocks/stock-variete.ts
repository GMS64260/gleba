/**
 * Stock de semences et de plants d'une variété : TOUJOURS par utilisateur
 * (`UserStockVariete`), jamais sur la variété elle-même.
 *
 * Ticket cmv29j6q7 (QA 2026-10-10) — la fiche d'espèce lisait et écrivait les
 * colonnes historiques `Variete.stockGraines` / `stockPlants` / `dateStock`,
 * partagées par tous les comptes (une variété du catalogue est commune),
 * pendant que Planification > Stocks lisait `UserStockVariete` : « 80 g » d'un
 * côté, « Cliquer pour ajouter » de l'autre. Ces colonnes ne sont plus ni lues,
 * ni écrites, ni exposées par l'application (reprise historique :
 * `prisma/migrate-stocks-to-users.ts`). Un seul chemin d'écriture :
 * `enregistrerStockVariete`, appelé par `/api/stocks`, `/api/varietes` et
 * l'import.
 */
import type { Prisma, PrismaClient } from '@prisma/client'
import { z } from 'zod'

/** Quantités reçues d'un client : nombre positif, entier pour les plants. */
export const stockVarieteSchema = z.object({
  stockGraines: z.number().min(0).nullable().optional(),
  stockPlants: z.number().int().min(0).nullable().optional(),
  dateStock: z.coerce.date().nullable().optional(),
})

export type StockVarieteSaisi = z.infer<typeof stockVarieteSchema>

type Db = PrismaClient | Prisma.TransactionClient

/** Vrai si l'appelant a fourni une quantité (même `null`) ou une date. */
export function porteUnStockVariete(saisie: StockVarieteSaisi): boolean {
  return (
    saisie.stockGraines !== undefined ||
    saisie.stockPlants !== undefined ||
    (saisie.dateStock !== undefined && saisie.dateStock !== null)
  )
}

/**
 * Sépare, dans un corps de requête variété, ce qui appartient au catalogue
 * (`catalogue`) de ce qui appartient au stock de l'utilisateur (`stock`).
 */
export function separerStockVariete<T extends StockVarieteSaisi>(
  donnees: T,
): { catalogue: Omit<T, 'stockGraines' | 'stockPlants' | 'dateStock'>; stock: StockVarieteSaisi } {
  const { stockGraines, stockPlants, dateStock, ...catalogue } = donnees
  return { catalogue, stock: { stockGraines, stockPlants, dateStock } }
}

/**
 * Écrit le stock de l'utilisateur pour la variété et rend la ligne, ou la ligne
 * existante quand rien n'était à écrire.
 *
 * - une quantité absente de la saisie est laissée telle quelle ; `null` la vide ;
 * - deux quantités vides sans ligne existante n'en créent pas (le formulaire de
 *   la fiche envoie `null`/`null` dès que ses champs sont vides : sans cette
 *   garde, chaque variété éditée recevait une ligne vide datée du jour) ;
 * - une date seule met à jour la date d'une ligne existante.
 */
export async function enregistrerStockVariete(
  db: Db,
  userId: string,
  varieteId: string,
  saisie: StockVarieteSaisi,
) {
  const where = { userId_varieteId: { userId, varieteId } }
  const existant = await db.userStockVariete.findUnique({ where })
  if (!porteUnStockVariete(saisie)) return existant
  const graines = saisie.stockGraines
  const plants = saisie.stockPlants
  const toutVide = (graines ?? null) === null && (plants ?? null) === null
  if (!existant) {
    if (toutVide) return null
    return db.userStockVariete.create({
      data: {
        userId,
        varieteId,
        stockGraines: graines ?? null,
        stockPlants: plants ?? null,
        dateStock: saisie.dateStock ?? new Date(),
      },
    })
  }
  return db.userStockVariete.update({
    where,
    data: {
      ...(graines !== undefined ? { stockGraines: graines } : {}),
      ...(plants !== undefined ? { stockPlants: plants } : {}),
      dateStock: saisie.dateStock ?? new Date(),
    },
  })
}

type ColonnesStockHistoriques = {
  stockGraines?: number | null
  stockPlants?: number | null
  dateStock?: Date | null
}

type StockUtilisateur = {
  stockGraines: number | null
  stockPlants: number | null
  dateStock: Date | null
} | null | undefined

/**
 * Forme d'une variété rendue par l'API : les colonnes de stock historiques de
 * la variété sont retirées, le stock de l'appelant est exposé en `userStock*`.
 * Un seul sérialiseur pour GET, POST et PUT.
 */
export function serialiserVariete<T extends ColonnesStockHistoriques>(
  variete: T,
  userStock: StockUtilisateur,
): Omit<T, keyof ColonnesStockHistoriques> & {
  userStockGraines: number | null
  userStockPlants: number | null
  userStockDate: Date | null
} {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omission des colonnes historiques
  const { stockGraines, stockPlants, dateStock, ...reste } = variete
  return {
    ...reste,
    userStockGraines: userStock?.stockGraines ?? null,
    userStockPlants: userStock?.stockPlants ?? null,
    userStockDate: userStock?.dateStock ?? null,
  }
}
