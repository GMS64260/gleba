import type { Prisma } from '@prisma/client'
import { addDays, format, startOfDay, subDays } from 'date-fns'
import {
  avertissementDar, HORIZON_DAR_INCONNU_JOURS, natureInterventionDar, natureObservationDar, resoudreDar,
  type CalendrierDar, type DarResolu,
} from '@/lib/phyto/delai-avant-recolte'

type Db = Pick<Prisma.TransactionClient, 'observationSante' | 'intervention'>
type Lot = { id: number; arbreId: number; parcelleId: string | null; date: Date }

const calendrier: CalendrierDar = {
  ajouterJours: (jour, n) => addDays(jour, n).getTime(),
  formater: (jour) => format(jour, 'dd/MM/yyyy'),
}

/**
 * Deux lectures bornées au tenant pour toute une liste de stocks. Règle et
 * texte légal du délai : `src/lib/phyto/delai-avant-recolte.ts` (revue
 * réglementaire du 2026-11-12, C5 : un traitement sans DAR n'est plus ignoré).
 */
export async function chargerAvertissementsDarFruits(db: Db, userId: string, lots: Lot[]) {
  const resultat = new Map<number, string[]>()
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
  const [observations, interventions] = await Promise.all([
    db.observationSante.findMany({ where: { userId, arbreId: { in: arbres }, date, OR: [{ dar: { gt: 0 } }, recents] },
      select: { arbreId: true, parcelleId: true, date: true, dar: true, produit: true, numAMM: true, methodeTraitement: true } }),
    db.intervention.findMany({ where: { userId, fait: true, date, type: 'traitement_phyto',
      OR: [{ dar: { gt: 0 } }, { dar: null, produitPhytoRef: { darJours: { gt: 0 } } }, recents], AND: [localisation] },
      select: { arbreId: true, parcelleId: true, date: true, dar: true, produitPhyto: true, geste: true, produitPhytoRef: { select: { darJours: true, nomCommercial: true, classification: true } } } }),
  ])
  type Traitement = { arbreId: number | null; parcelleId: string | null; date: Date; dar: DarResolu; produit: string | null; nature: 'amm' | 'sans_amm' | 'sans_produit' }
  const traitements: Traitement[] = [
    ...observations.map(o => ({ arbreId: o.arbreId, parcelleId: o.parcelleId, date: o.date, dar: resoudreDar(o.dar, null), produit: o.produit, nature: natureObservationDar(o) })),
    ...interventions.map(i => ({ arbreId: i.arbreId, parcelleId: i.parcelleId, date: i.date, dar: resoudreDar(i.dar, i.produitPhytoRef?.darJours),
      produit: i.produitPhytoRef?.nomCommercial ?? i.produitPhyto, nature: natureInterventionDar(i) })),
  ].filter(t => t.nature !== 'sans_produit' || t.dar.etat === 'connu')
  for (const lot of lots) {
    const warnings = traitements.flatMap(t => {
      if (t.arbreId !== lot.arbreId && (t.arbreId != null || !lot.parcelleId || t.parcelleId !== lot.parcelleId)) return []
      const message = avertissementDar({
        jourTraitement: startOfDay(t.date).getTime(), jourRecolte: startOfDay(lot.date).getTime(),
        dar: t.dar, produit: t.produit, relevantDUneAmm: t.nature === 'amm',
      }, calendrier)
      return message ? [message] : []
    })
    resultat.set(lot.id, [...new Set(warnings)])
  }
  return resultat
}

/** Le délai porte sur le jour de récolte, même si la vente est ultérieure. */
export async function avertissementsDarFruit(db: Db, userId: string, arbreId: number, parcelleId: string | null, date: Date) {
  return (await chargerAvertissementsDarFruits(db, userId, [{ id: 0, arbreId, parcelleId, date }])).get(0) ?? []
}
