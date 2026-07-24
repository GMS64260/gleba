/**
 * Chargement + consolidation des délais d'attente depuis la base.
 * Séparé de `attentes.ts` (pur, testable) pour isoler l'accès Prisma.
 * Partagé par /api/elevage/attentes et /api/elevage/agenda.
 */
import prisma from '@/lib/prisma'
import { consoliderAttentes, type SoinAttenteRow, type AttenteConsolidee } from './attentes'

export async function chargerAttentesConsolidees(
  userId: string,
  today: Date,
): Promise<AttenteConsolidee[]> {
  const rows = await prisma.soinAnimal.findMany({
    where: {
      userId,
      OR: [
        // Injections administrées dont la fenêtre est encore active.
        { fait: true, OR: [{ finAttenteLait: { gte: today } }, { finAttenteViande: { gte: today } }] },
        // Injections planifiées à venir d'un produit à délai d'attente : elles
        // repoussent l'ancre de la fenêtre du traitement (dernière injection).
        {
          fait: false,
          AND: [
            { OR: [{ datePrevue: { gte: today } }, { date: { gte: today } }] },
            { OR: [{ tempsAttenteLaitJ: { gt: 0 } }, { tempsAttenteViandeJ: { gt: 0 } }] },
          ],
        },
      ],
    },
    select: {
      id: true,
      animalId: true,
      lotId: true,
      type: true,
      produit: true,
      produitId: true,
      date: true,
      datePrevue: true,
      fait: true,
      tempsAttenteLaitJ: true,
      tempsAttenteViandeJ: true,
      nbInjections: true,
      intervalleInjectionsHeures: true,
      animal: { select: { id: true, nom: true, identifiant: true } },
      lot: { select: { id: true, nom: true } },
      produitVeterinaire: { select: { nom: true } },
    },
  })

  const mapped: SoinAttenteRow[] = rows.map((s) => ({
    id: s.id,
    animalId: s.animalId,
    lotId: s.lotId,
    type: s.type,
    produit: s.produit,
    produitId: s.produitId,
    date: s.date,
    datePrevue: s.datePrevue,
    fait: s.fait,
    tempsAttenteLaitJ: s.tempsAttenteLaitJ,
    tempsAttenteViandeJ: s.tempsAttenteViandeJ,
    nbInjections: s.nbInjections,
    intervalleInjectionsHeures: s.intervalleInjectionsHeures,
    cibleLabel: s.animal
      ? s.animal.identifiant || s.animal.nom || `#${s.animal.id}`
      : s.lot
        ? s.lot.nom || `Lot #${s.lot.id}`
        : 'Troupeau',
    cibleNom: s.animal ? s.animal.nom : s.lot ? s.lot.nom : null,
    traitementLabel: s.produitVeterinaire?.nom || s.produit || s.type,
  }))

  return consoliderAttentes(mapped, today)
}
