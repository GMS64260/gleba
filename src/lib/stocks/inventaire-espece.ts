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
 *
 * Modèle de stock unique, L3 (2026-11-24) : un comptage du jour aligne aussi
 * les LOTS sur le chiffre compté (`ajusterLotsAuComptage`), pour que la somme
 * des lots dise la même chose que le comptage.
 */
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { verrouillerStockCommercial, verrouillerStockNetRecolte } from './verrou-commercial'
import { visibiliteReferentiel } from '@/lib/referentiel-communaute'
import { libelleUniteQuantite, type UniteQuantite } from '@/lib/recolte/projection'
import { chargerUnitesStock } from '@/lib/stocks/sortie-stock'
import { messageConflitStockCaisse } from '@/lib/caisse/conflit-stock'
import { sortirParLots } from '@/lib/stocks/sortie-lots'
import { STATUT_ECART_INVENTAIRE } from '@/lib/validations/recolte'
import { chargerIdsRecoltesHorsStock } from '@/lib/stocks-helpers'
import type { Prisma } from '@prisma/client'

const EPSILON = 1e-9
const auMillieme = (q: number) => Math.round(q * 1000) / 1000

/** Ce qu'un comptage a fait des lots de l'espèce. */
export type AjustementLots =
  | { type: 'aucun' }
  /** Le comptage trouve plus que les lots : un lot d'inventaire porte la différence. */
  | { type: 'lot_inventaire'; quantite: number; lotId: number }
  /** Le comptage trouve moins : la différence sort des lots libres (écart d'inventaire). */
  | { type: 'ecart'; quantite: number; sortiSurLots: number; nonSorti: number }

/** Le comptage trouve moins que les lots, mais une part ne peut pas sortir d'ici. */
class ComptageNonAlignable extends Error {
  constructor(nonSorti: number, unite: UniteQuantite) {
    const q = `${nonSorti.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} ${libelleUniteQuantite(unite, nonSorti)}`
    super(`Ce comptage trouve moins que les lots, mais ${q} de l'écart sont sur des lots liés à un bon ou à une facture, publiés en boutique ou emportés au marché : ils ne peuvent pas sortir d'ici. Recomptez après le retour du marché, ou corrigez par le document.`)
  }
}

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
      ajustement: AjustementLots
    }
  | { ok: false; status: 400 | 404 | 409; error: string }

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

  try {
    return await prisma.$transaction(async (tx): Promise<EnregistrementInventaire> => {
      await verrouillerStockCommercial(tx, userId)
      await verrouillerStockNetRecolte(tx, userId, espece.id)
      const unite = (await chargerUnitesStock(userId, [espece.id], tx)).get(espece.id) ?? 'kg'
      const refus = refusInventaire(saisie.stock, unite)
      if (refus) return { ok: false, status: 400, error: refus }
      // L4.1 : un comptage aligne les lots à l'instant où il est fait ; antidaté,
      // il ne pourrait plus les aligner (ils ont pu bouger depuis).
      if (saisie.stock != null && saisie.dateStock) {
        return { ok: false, status: 400, error: 'Données invalides — dateStock : un comptage se fait au jour même ; recomptez le stock maintenant.' }
      }
      const comptage = saisie.stock == null
        ? { inventaire: null, dateInventaire: null }
        : { inventaire: saisie.stock, dateInventaire: saisie.dateStock ?? new Date() }
      const ligne = await tx.userStockEspece.upsert({
        where: { userId_especeId: { userId, especeId: espece.id } },
        create: { userId, especeId: espece.id, ...comptage },
        update: comptage,
        select: { inventaire: true, dateInventaire: true },
      })
      const ajustement: AjustementLots = saisie.stock != null
        ? await ajusterLotsAuComptage(tx, userId, espece.id, unite, saisie.stock, comptage.dateInventaire!)
        : { type: 'aucun' }
      // L4.1 : un comptage qui ne peut pas aligner tous les lots (une part est
      // liée à un bon, publiée ou emportée au marché) est refusé en entier.
      if (ajustement.type === 'ecart' && ajustement.nonSorti > 0) throw new ComptageNonAlignable(ajustement.nonSorti, unite)
      return { ok: true, especeId: espece.id, unite, ligne, ajustement }
    })
  } catch (error) {
    if (error instanceof ComptageNonAlignable) return { ok: false, status: 409, error: error.message }
    const message = messageConflitStockCaisse(error)
    if (message) return { ok: false, status: 409, error: message }
    throw error
  }
}

/**
 * Aligne les lots en stock de l'espèce sur le chiffre compté, à l'instant du
 * comptage (`date`). Lots comptés : ceux du stock de l'espèce (en stock, dans
 * son unité, datés au plus tard à l'instant du comptage, hors boutique selon
 * `chargerIdsRecoltesHorsStock`) ; un lot entamé ou publié avec suivi compte
 * pour son reste (`stockDisponibleCommercial`).
 *
 * - Plus que les lots : un LOT D'INVENTAIRE, sans culture, porte la
 *   différence (choix B du 2026-11-24 : une cave tenue par comptage, sans
 *   récolte saisie, garde son stock). Daté et saisi à l'instant du comptage :
 *   le comptage le compte déjà, et sa sortie future s'en retranchera.
 * - Moins que les lots : la différence sort des lots LIBRES, du plus ancien au
 *   plus récent, au statut « écart d'inventaire », à l'instant du comptage.
 *   Ce que les lots libres ne couvrent pas (lots entamés, réservés au marché)
 *   reste un écart, dit par la comparaison stock / lots.
 */
export async function ajusterLotsAuComptage(
  tx: Prisma.TransactionClient,
  userId: string,
  especeId: string,
  unite: UniteQuantite,
  compte: number,
  date: Date,
): Promise<AjustementLots> {
  // Mêmes lots que le stock de l'espèce : hors boutique selon sa règle, datés
  // au plus tard à l'INSTANT du comptage (le stock ajoute ceux d'après).
  const horsStock = await chargerIdsRecoltesHorsStock(userId, tx)
  const lots = await tx.recolte.findMany({
    where: {
      userId,
      especeId,
      statut: 'en_stock',
      date: { lte: date },
      ...(horsStock.length > 0 && { id: { notIn: horsStock } }),
      ...(unite === 'kg' ? { OR: [{ unite: 'kg' }, { unite: null }] } : { unite }),
    },
    select: { quantite: true, stockDisponibleCommercial: true },
  })
  const enStock = auMillieme(lots.reduce((somme, l) => somme + (l.stockDisponibleCommercial ?? l.quantite), 0))
  const ecart = auMillieme(compte - enStock)
  if (Math.abs(ecart) <= EPSILON) return { type: 'aucun' }
  if (ecart > 0) {
    const lot = await tx.recolte.create({
      data: {
        userId, especeId, cultureId: null, date, createdAt: date, quantite: ecart, unite, statut: 'en_stock',
        notes: `Lot d'inventaire : stock compté le ${date.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })} au-delà des lots enregistrés.`,
      },
      select: { id: true },
    })
    return { type: 'lot_inventaire', quantite: ecart, lotId: lot.id }
  }
  const sortie = await sortirParLots(tx, userId, {
    especeId, unite, quantite: -ecart, date, statut: STATUT_ECART_INVENTAIRE, consommationId: null, dateMax: date,
  })
  return { type: 'ecart', quantite: -ecart, sortiSurLots: sortie.couvert, nonSorti: sortie.horsLots }
}

/** Phrase de l'écran après un comptage : ce que les lots sont devenus. */
export function messageAjustementLots(ajustement: AjustementLots, unite: UniteQuantite): string | null {
  const q = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} ${libelleUniteQuantite(unite, n)}`
  if (ajustement.type === 'lot_inventaire') {
    return `Lots alignés : ${q(ajustement.quantite)} de plus que les lots enregistrés, ajoutés en lot d'inventaire.`
  }
  if (ajustement.type === 'ecart') {
    return `Lots alignés : ${q(ajustement.sortiSurLots)} sortis des lots en écart d'inventaire`
      + (ajustement.nonSorti > 0 ? ` ; ${q(ajustement.nonSorti)} restent sur des lots liés à un document ou réservés au marché.` : '.')
  }
  return null
}
