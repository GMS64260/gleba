import type { Prisma } from '@prisma/client'
import { jourCivilStocke } from '@/lib/jour-civil'

type Db = Pick<Prisma.TransactionClient, 'intervention'>
export type LotLegume = { id: number; cultureId: number; plancheId: string | null; date: Date }
export type TraitementDar = {
  cultureId: number | null
  plancheId: string | null
  date: Date
  dar: number | null
  produitPhyto: string | null
  produitPhytoRef: { darJours: number | null; nomCommercial: string | null } | null
}

const MS_JOUR = 86_400_000
const minuitDuJour = (date: Date): number => {
  const jour = jourCivilStocke(date)
  return jour ? new Date(`${jour}T00:00:00.000Z`).getTime() : date.getTime()
}
const jourFr = (t: number): string => {
  const [a, m, j] = new Date(t).toISOString().slice(0, 10).split('-')
  return `${j}/${m}/${a}`
}

/**
 * Avertissements de délai avant récolte (DAR) d'un lot de légumes, PUR.
 * Un traitement compte s'il vise la culture récoltée, ou sa planche sans viser
 * de culture. Même règle que les fruits (`src/lib/verger/dar.ts`) : la récolte
 * est libre le jour « traitement + DAR », et le délai saisi sur l'intervention
 * prime sur celui du référentiel.
 */
export function avertissementsDarLot(lot: LotLegume, traitements: TraitementDar[]): string[] {
  const jourLot = minuitDuJour(lot.date)
  const messages = traitements.flatMap((t) => {
    const dar = t.dar ?? t.produitPhytoRef?.darJours ?? 0
    if (dar <= 0) return []
    const vise = t.cultureId != null
      ? t.cultureId === lot.cultureId
      : t.plancheId != null && t.plancheId === lot.plancheId
    if (!vise) return []
    const jourTraitement = minuitDuJour(t.date)
    const fin = jourTraitement + dar * MS_JOUR
    if (jourTraitement > jourLot || jourLot >= fin) return []
    const produit = t.produitPhytoRef?.nomCommercial ?? t.produitPhyto ?? 'le traitement'
    return [`DAR : récolte du ${jourFr(jourLot)} avant la fin du délai saisi pour ${produit} (${dar} jours, jusqu’au ${jourFr(fin)}). Vérifiez cette récolte avant de la commercialiser.`]
  })
  return [...new Set(messages)]
}

/**
 * Une lecture bornée au tenant pour toute une liste de lots. Les traitements
 * posés sur une parcelle entière ne sont pas rattachables à une planche (une
 * planche n'a pas de parcelle) : ils ne sont pas contrôlés ici.
 */
export async function chargerAvertissementsDarLegumes(db: Db, userId: string, lots: LotLegume[]): Promise<Map<number, string[]>> {
  const resultat = new Map<number, string[]>()
  if (!lots.length) return resultat
  const cultures = [...new Set(lots.map((l) => l.cultureId))]
  const planches = [...new Set(lots.flatMap((l) => (l.plancheId ? [l.plancheId] : [])))]
  const dernierJour = Math.max(...lots.map((l) => minuitDuJour(l.date)))
  const traitements = await db.intervention.findMany({
    where: {
      userId,
      fait: true,
      type: 'traitement_phyto',
      // Un jour de marge : un traitement horodaté le soir en UTC est du lendemain en jour civil.
      date: { lt: new Date(dernierJour + 2 * MS_JOUR) },
      OR: [{ dar: { gt: 0 } }, { dar: null, produitPhytoRef: { darJours: { gt: 0 } } }],
      AND: [{ OR: [
        { cultureId: { in: cultures } },
        ...(planches.length ? [{ cultureId: null, plancheId: { in: planches } }] : []),
      ] }],
    },
    select: { cultureId: true, plancheId: true, date: true, dar: true, produitPhyto: true, produitPhytoRef: { select: { darJours: true, nomCommercial: true } } },
  })
  for (const lot of lots) resultat.set(lot.id, avertissementsDarLot(lot, traitements))
  return resultat
}
