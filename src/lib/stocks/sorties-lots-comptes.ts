/**
 * Lots déjà comptés (datés jusqu'au dernier comptage de leur espèce) puis
 * sortis APRÈS ce comptage : perte, consommation personnelle ou don (jour de
 * sortie), vente directe (jour de vente). Le comptage les comptait encore ;
 * rien ne les retranchait du stock de l'espèce avant le comptage suivant
 * (limite notée le 2026-10-25, levée par le modèle de stock unique, lot 2).
 *
 * Même règle que la fonction SQL `source_recolte_net_milli` : seule l'unité
 * principale du stock est concernée, le comptage ne porte qu'elle.
 *
 * Un lot daté du jour du comptage mais saisi APRÈS lui (date seule, à minuit)
 * n'a pas été compté : le stock ne l'ajoute pas (limite connue), il ne le
 * retranche donc pas non plus à sa sortie. Même départage que
 * `dateEffetStockCommercial` : même jour à Paris, l'heure de saisie décide.
 */
import type { Prisma } from '@prisma/client'
import { dateIsoFacture } from '@/lib/facture-regles'
import { STATUT_ECART_INVENTAIRE, STATUTS_SORTIE_RECOLTE } from '@/lib/validations/recolte'

export async function sortiesLotsComptes(
  db: Pick<Prisma.TransactionClient, 'recolte'>,
  userId: string,
  especeId: string,
  dateComptage: Date | null,
  uniteStock: string,
  recolteIdsEnBoutique: number[],
): Promise<number> {
  if (!dateComptage) return 0
  const lots = await db.recolte.findMany({
    where: {
      userId,
      especeId,
      date: { lte: dateComptage },
      ...(uniteStock === 'kg' ? { OR: [{ unite: 'kg' }, { unite: null }] } : { unite: uniteStock }),
      ...(recolteIdsEnBoutique.length > 0 && { id: { notIn: recolteIdsEnBoutique } }),
      AND: [{
        OR: [
          { statut: { in: [...STATUTS_SORTIE_RECOLTE, STATUT_ECART_INVENTAIRE] }, dateSortie: { gt: dateComptage } },
          { statut: 'vendu', dateVente: { gt: dateComptage } },
        ],
      }],
    },
    select: { quantite: true, date: true, createdAt: true },
  })
  return lots
    .filter((l) => dateIsoFacture(l.date) !== dateIsoFacture(l.createdAt) || l.createdAt <= dateComptage)
    .reduce((somme, l) => somme + l.quantite, 0)
}
