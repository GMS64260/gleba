/**
 * Point de comptage du stock de récolte d'une espèce : TOUJOURS par compte
 * (`UserStockEspece.inventaire` + `dateInventaire`), jamais sur l'espèce.
 *
 * Revue QA du 2026-10-20 — la fiche espèce (onglet Récolte, champ « Stock
 * actuel ») écrivait `Espece.inventaire`, colonne du référentiel PARTAGÉ que
 * rien ne lit, et ne la rechargeait jamais ; Stocks > Récoltes et
 * `calculerStocksNet` lisent `UserStockEspece`. Même famille que le stock de
 * graines porté par la variété (cmv29j6q7). Un seul chemin d'écriture :
 * `enregistrerInventaireEspece`, appelé par `PATCH /api/stocks` (type
 * `recolte`) pour l'écran Stocks et la carte « Chez moi » de la fiche.
 *
 * Sémantique (refonte stock 2026-07) : le comptage est une BASELINE datée ;
 * `calculerStocksNet` y ajoute les récoltes en stock et retranche les sorties
 * postérieures à sa date. Il se compte dans l'unité du stock de l'espèce
 * (kg, tige, pièce, botte), la même que `chargerUnitesStock` sert aux sorties.
 */
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { verrouillerStockCommercial } from './verrou-commercial'
import { visibiliteReferentiel } from '@/lib/referentiel-communaute'
import { libelleUniteQuantite, type UniteQuantite } from '@/lib/recolte/projection'
import { chargerUnitesStock } from '@/lib/stocks/sortie-stock'

/** Corps reçu d'un client : `stock` null = « plus de comptage manuel ». */
export const inventaireEspeceSchema = z.object({
  stock: z.number().finite().min(0).nullable(),
  dateStock: z.coerce.date().optional(),
})

export type InventaireEspeceSaisi = z.infer<typeof inventaireEspeceSchema>

export type EnregistrementInventaire =
  | {
      ok: true
      especeId: string
      unite: UniteQuantite
      ligne: { inventaire: number | null; dateInventaire: Date | null }
    }
  | { ok: false; status: 400 | 404; error: string }

/**
 * Une tige, une pièce ou une botte se compte : « 2,5 tiges » est refusé, comme
 * pour une sortie de stock (`refusQuantiteSortie`). Le refus nomme son champ.
 */
export function refusInventaire(stock: number | null, unite: UniteQuantite): string | null {
  if (stock == null) return null
  if (!Number.isFinite(stock) || stock < 0) {
    return 'Données invalides — stock : une quantité positive ou nulle est attendue.'
  }
  if (unite !== 'kg' && !Number.isInteger(stock)) {
    return `Données invalides — stock : un nombre entier de ${libelleUniteQuantite(unite, 2)} est attendu.`
  }
  return null
}

/**
 * Écrit le comptage du compte pour l'espèce et rend la ligne.
 *
 * - l'espèce doit être visible du compte (une espèce privée d'un autre compte
 *   répond 404, jamais 403) ;
 * - `stock` null efface le comptage ET sa date : un comptage absent se lit
 *   « jamais fait » (baseline 0 depuis l'origine), alors qu'une date seule
 *   aurait masqué toutes les récoltes antérieures du stock net ;
 * - sans `dateStock`, le comptage est daté de l'instant.
 */
export async function enregistrerInventaireEspece(
  userId: string,
  especeId: string,
  saisie: InventaireEspeceSaisi,
): Promise<EnregistrementInventaire> {
  const espece = await prisma.espece.findFirst({
    where: { AND: [{ id: especeId }, visibiliteReferentiel(userId)] },
    select: { id: true },
  })
  if (!espece) {
    return { ok: false, status: 404, error: `Espèce "${especeId}" introuvable` }
  }

  const unite = (await chargerUnitesStock(userId, [espece.id])).get(espece.id) ?? 'kg'
  const refus = refusInventaire(saisie.stock, unite)
  if (refus) return { ok: false, status: 400, error: refus }

  const ligne = await prisma.$transaction(async (tx) => {
    await verrouillerStockCommercial(tx, userId)
    const comptage =
      saisie.stock == null
        ? { inventaire: null, dateInventaire: null }
        : { inventaire: saisie.stock, dateInventaire: saisie.dateStock ?? new Date() }

    return tx.userStockEspece.upsert({
      where: { userId_especeId: { userId, especeId: espece.id } },
      create: { userId, especeId: espece.id, ...comptage },
      update: comptage,
      select: { inventaire: true, dateInventaire: true },
    })
  })

  return { ok: true, especeId: espece.id, unite, ligne }
}
