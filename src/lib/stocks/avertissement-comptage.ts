/**
 * Avertissement d'une saisie datée du jour du dernier comptage de l'espèce, ou
 * d'avant (décision B de Guillaume, 2026-11-25).
 *
 * Le stock d'une espèce est la somme des restes de ses lots ; un comptage les
 * aligne à l'instant où il est fait. Une récolte ou une sortie saisie APRÈS ce
 * comptage change les lots, même datée d'avant lui. Si elle était déjà faite
 * au moment du comptage, celui-ci l'a déjà comptée : le stock est alors faux
 * jusqu'au prochain comptage. Gleba ne peut pas savoir si c'était le cas (une
 * récolte de la veille peut être restée ailleurs qu'au stock) : il ne refuse
 * rien et ne devine rien, il le dit au moment de la saisie.
 *
 * Même jour que le comptage compris : la saisie a pu se faire avant ou après
 * lui. Jour civil de Paris, comme les dates de sortie et de facture.
 */
import type { Prisma } from '@prisma/client'
import { dateIsoFacture } from '@/lib/facture-regles'

export type NatureSaisieComptee = 'recolte' | 'sortie'

/** Dernier comptage de chaque espèce du compte (absente = jamais comptée). */
export async function chargerDatesComptage(
  db: Pick<Prisma.TransactionClient, 'userStockEspece'>,
  userId: string,
  especeIds: string[],
): Promise<Map<string, Date>> {
  if (especeIds.length === 0) return new Map()
  const lignes = await db.userStockEspece.findMany({
    where: { userId, especeId: { in: [...new Set(especeIds)] }, dateInventaire: { not: null } },
    select: { especeId: true, dateInventaire: true },
  })
  return new Map(lignes.map((l) => [l.especeId, l.dateInventaire!]))
}

/** Vrai si une saisie de ce jour a pu être déjà comptée par le comptage. */
export function saisiePeutEtreComptee(dateSaisie: Date, dateComptage: Date | null | undefined): boolean {
  return dateComptage != null && dateIsoFacture(dateSaisie) <= dateIsoFacture(dateComptage)
}

const jourAffiche = (date: Date) => date.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })

export function messageSaisieComptee(nature: NatureSaisieComptee, nomEspece: string, dateComptage: Date): string {
  const debut = `Le stock de ${nomEspece} a été compté le ${jourAffiche(dateComptage)}`
  return nature === 'recolte'
    ? `${debut} : ce comptage a peut-être déjà compté cette récolte. Si elle était déjà en stock à ce moment-là, recomptez le stock de l’espèce.`
    : `${debut} : ce comptage a peut-être déjà tenu compte de cette sortie. Si elle avait déjà eu lieu, recomptez le stock de l’espèce.`
}

/** Le message à montrer pour une saisie, ou null. */
export function avertissementSaisieComptee(
  nature: NatureSaisieComptee,
  saisie: { date: Date; nomEspece: string },
  dateComptage: Date | null | undefined,
): string | null {
  return saisiePeutEtreComptee(saisie.date, dateComptage) ? messageSaisieComptee(nature, saisie.nomEspece, dateComptage!) : null
}
