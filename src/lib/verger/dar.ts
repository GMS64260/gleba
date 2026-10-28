import type { Prisma } from '@prisma/client'
import { addDays, format, startOfDay } from 'date-fns'

type Db = Pick<Prisma.TransactionClient, 'observationSante' | 'intervention'>
type Lot = { id: number; arbreId: number; parcelleId: string | null; date: Date }

/** Deux lectures bornées au tenant pour toute une liste de stocks. */
export async function chargerAvertissementsDarFruits(db: Db, userId: string, lots: Lot[]) {
  const resultat = new Map<number, string[]>()
  if (!lots.length) return resultat
  const arbres = [...new Set(lots.map(l => l.arbreId))]
  const localisation = { OR: [{ arbreId: { in: arbres } },
    { arbreId: null, cultureId: null, plancheId: null, parcelleId: { in: [...new Set(lots.flatMap(l => l.parcelleId ? [l.parcelleId] : []))] } }] }
  const dernierJour = startOfDay(new Date(lots.reduce((max, l) => Math.max(max, l.date.getTime()), 0)))
  const date = { lt: addDays(dernierJour, 1) }
  const [observations, interventions] = await Promise.all([
    db.observationSante.findMany({ where: { userId, arbreId: { in: arbres }, date, dar: { gt: 0 } },
      select: { arbreId: true, parcelleId: true, date: true, dar: true, produit: true } }),
    db.intervention.findMany({ where: { userId, fait: true, date, type: 'traitement_phyto',
      OR: [{ dar: { gt: 0 } }, { dar: null, produitPhytoRef: { darJours: { gt: 0 } } }], AND: [localisation] },
      select: { arbreId: true, parcelleId: true, date: true, dar: true, produitPhyto: true, produitPhytoRef: { select: { darJours: true, nomCommercial: true } } } }),
  ])
  const traitements = [
    ...observations.map(o => ({ ...o, dar: o.dar, produit: o.produit })),
    ...interventions.map(i => ({ ...i, dar: i.dar ?? i.produitPhytoRef?.darJours, produit: i.produitPhytoRef?.nomCommercial ?? i.produitPhyto })),
  ]
  for (const lot of lots) {
    const warnings = traitements.flatMap(t => {
      if (startOfDay(t.date) > startOfDay(lot.date) || (t.arbreId !== lot.arbreId && (t.arbreId != null || !lot.parcelleId || t.parcelleId !== lot.parcelleId))) return []
      const fin = addDays(startOfDay(t.date), t.dar ?? 0)
      return startOfDay(lot.date) < fin
        ? [`DAR : récolte du ${format(lot.date, 'dd/MM/yyyy')} avant la fin du délai saisi pour ${t.produit || 'le traitement'} (${t.dar} jours, jusqu’au ${format(fin, 'dd/MM/yyyy')}). Vérifiez cette récolte avant de la commercialiser.`] : []
    })
    resultat.set(lot.id, [...new Set(warnings)])
  }
  return resultat
}

/** Le délai porte sur le jour de récolte, même si la vente est ultérieure. */
export async function avertissementsDarFruit(db: Db, userId: string, arbreId: number, parcelleId: string | null, date: Date) {
  return (await chargerAvertissementsDarFruits(db, userId, [{ id: 0, arbreId, parcelleId, date }])).get(0) ?? []
}
