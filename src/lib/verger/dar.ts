import type { Prisma } from '@prisma/client'
import { addDays, format, startOfDay, subDays } from 'date-fns'
import {
  agregerVerdictsDar, darIntervention, HORIZON_DAR_INCONNU_JOURS, natureInterventionDar, natureObservationDar, natureOperationDar, resoudreDar, verdictDar, VERDICT_DAR_LOT_RIEN,
  type CalendrierDar, type DarResolu, type VerdictDarLot,
} from '@/lib/phyto/delai-avant-recolte'

type Db = Pick<Prisma.TransactionClient, 'observationSante' | 'intervention' | 'operationArbre'>
type Lot = { id: number; arbreId: number; parcelleId: string | null; date: Date }

const calendrier: CalendrierDar = {
  ajouterJours: (jour, n) => addDays(jour, n).getTime(),
  formater: (jour) => format(jour, 'dd/MM/yyyy'),
  iso: (jour) => format(jour, 'yyyy-MM-dd'),
}

/**
 * Trois lectures bornées au tenant pour toute une liste de stocks. Règle et
 * texte légal du délai : `src/lib/phyto/delai-avant-recolte.ts` (revue
 * réglementaire du 2026-11-12, C5 : un traitement sans DAR n'est plus ignoré).
 * Le verdict distingue ce qui bloque la mise en vente de ce qui n'est qu'un
 * rappel ; il ne lit que les traitements de l'exploitation (`userId`).
 */
export async function chargerVerdictsDarFruits(db: Db, userId: string, lots: Lot[]) {
  const resultat = new Map<number, VerdictDarLot>()
  if (!lots.length) return resultat
  const arbres = [...new Set(lots.map(l => l.arbreId))]
  const localisation = { OR: [{ arbreId: { in: arbres } },
    { arbreId: null, cultureId: null, plancheId: null, parcelleId: { in: [...new Set(lots.flatMap(l => l.parcelleId ? [l.parcelleId] : []))] } }] }
  const dernierJour = startOfDay(new Date(lots.reduce((max, l) => Math.max(max, l.date.getTime()), 0)))
  const premierJour = startOfDay(new Date(lots.reduce((min, l) => Math.min(min, l.date.getTime()), Infinity)))
  const date = { lt: addDays(dernierJour, 1) }
  // Délai positif connu : sans borne basse, comme avant. Délai nul ou inconnu :
  // seulement sur l'horizon de rappel.
  const recents = { date: { gte: subDays(premierJour, HORIZON_DAR_INCONNU_JOURS + 1) } }
  const [observations, interventions, operations] = await Promise.all([
    db.observationSante.findMany({ where: { userId, arbreId: { in: arbres }, date, OR: [{ dar: { gt: 0 } }, recents] },
      select: { arbreId: true, parcelleId: true, date: true, dar: true, produit: true, numAMM: true, methodeTraitement: true } }),
    db.intervention.findMany({ where: { userId, fait: true, date, type: 'traitement_phyto',
      OR: [{ dar: { gt: 0 } }, { dar: null, produitPhytoRef: { darJours: { gt: 0 } } }, recents], AND: [localisation] },
      select: { arbreId: true, parcelleId: true, date: true, dar: true, darIndicatif: true, produitPhyto: true, geste: true, natureProduit: true, numAMM: true, produitPhytoRef: { select: { darJours: true, nomCommercial: true, classification: true } } } }),
    // Revues QA et adverse du tour 2 : les traitements réalisés saisis dans
    // Verger > Opérations (et par l'assistant) figuraient au registre phyto
    // mais pas ici ; une récolte du lendemain restait vendable sans un mot.
    // Une opération « à faire » (fait = false) n'est pas une application.
    db.operationArbre.findMany({ where: { userId, arbreId: { in: arbres }, type: 'traitement', fait: true, date, OR: [{ dar: { gt: 0 } }, recents] },
      select: { arbreId: true, date: true, dar: true, produit: true, natureProduit: true } }),
  ])
  type Traitement = { arbreId: number | null; parcelleId: string | null; date: Date; dar: DarResolu; produit: string | null; nature: 'amm' | 'sans_amm' | 'sans_produit' }
  const traitements: Traitement[] = [
    ...observations.map(o => ({ arbreId: o.arbreId, parcelleId: o.parcelleId, date: o.date, dar: resoudreDar(o.dar, null), produit: o.produit, nature: natureObservationDar(o) })),
    ...interventions.map(i => ({ arbreId: i.arbreId, parcelleId: i.parcelleId, date: i.date, dar: darIntervention(i),
      produit: i.produitPhytoRef?.nomCommercial ?? i.produitPhyto, nature: natureInterventionDar(i) })),
    ...operations.map(o => ({ arbreId: o.arbreId, parcelleId: null, date: o.date, dar: resoudreDar(o.dar, null), produit: o.produit, nature: natureOperationDar(o) })),
  ]
  for (const lot of lots) {
    resultat.set(lot.id, agregerVerdictsDar(traitements.flatMap(t => {
      if (t.arbreId !== lot.arbreId && (t.arbreId != null || !lot.parcelleId || t.parcelleId !== lot.parcelleId)) return []
      return [verdictDar({
        jourTraitement: startOfDay(t.date).getTime(), jourRecolte: startOfDay(lot.date).getTime(),
        dar: t.dar, produit: t.produit, nature: t.nature,
      }, calendrier)]
    })))
  }
  return resultat
}

/** Les messages seuls, pour les surfaces de saisie. */
export async function chargerAvertissementsDarFruits(db: Db, userId: string, lots: Lot[]) {
  const verdicts = await chargerVerdictsDarFruits(db, userId, lots)
  return new Map([...verdicts].map(([id, v]) => [id, v.avertissements]))
}

/** Verdict d'une seule récolte de fruits (vente par la fiche). */
export async function verdictDarFruit(db: Db, userId: string, arbreId: number, parcelleId: string | null, date: Date): Promise<VerdictDarLot> {
  return (await chargerVerdictsDarFruits(db, userId, [{ id: 0, arbreId, parcelleId, date }])).get(0) ?? VERDICT_DAR_LOT_RIEN
}

/** Le délai porte sur le jour de récolte, même si la vente est ultérieure. */
export async function avertissementsDarFruit(db: Db, userId: string, arbreId: number, parcelleId: string | null, date: Date) {
  return (await chargerAvertissementsDarFruits(db, userId, [{ id: 0, arbreId, parcelleId, date }])).get(0) ?? []
}
