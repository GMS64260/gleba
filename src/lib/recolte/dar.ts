import type { Prisma } from '@prisma/client'
import { jourCivilStocke } from '@/lib/jour-civil'
import { avertissementDar, HORIZON_DAR_INCONNU_JOURS, natureInterventionDar, resoudreDar, type CalendrierDar } from '@/lib/phyto/delai-avant-recolte'

type Db = Pick<Prisma.TransactionClient, 'intervention'>
export type LotLegume = { id: number; cultureId: number; plancheId: string | null; parcelleId?: string | null; date: Date }
export type TraitementDar = {
  cultureId: number | null
  plancheId: string | null
  parcelleId?: string | null
  arbreId?: number | null
  date: Date
  dar: number | null
  produitPhyto: string | null
  geste?: string | null
  produitPhytoRef: { darJours: number | null; nomCommercial: string | null; classification?: string | null } | null
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

const calendrier: CalendrierDar = { ajouterJours: (jour, n) => jour + n * MS_JOUR, formater: jourFr }

/**
 * Avertissements de délai avant récolte (DAR) d'un lot de légumes, PUR.
 * Un traitement compte s'il vise la culture récoltée, sa planche sans viser de
 * culture, ou la parcelle entière de sa planche (ni culture, ni planche, ni
 * arbre désignés). Même règle que les fruits (`src/lib/verger/dar.ts`) : la récolte
 * est libre le jour « traitement + DAR », et le délai saisi sur l'intervention
 * prime sur celui du référentiel. Un délai inconnu ou inférieur au défaut
 * légal de 3 jours est signalé, pas ignoré (règle et texte :
 * `src/lib/phyto/delai-avant-recolte.ts`).
 */
export function avertissementsDarLot(lot: LotLegume, traitements: TraitementDar[]): string[] {
  const jourLot = minuitDuJour(lot.date)
  const messages = traitements.flatMap((t) => {
    const vise = t.cultureId != null
      ? t.cultureId === lot.cultureId
      : t.plancheId != null
        ? t.plancheId === lot.plancheId
        : t.arbreId == null && t.parcelleId != null && t.parcelleId === lot.parcelleId
    if (!vise) return []
    const dar = resoudreDar(t.dar, t.produitPhytoRef?.darJours)
    const nature = natureInterventionDar(t)
    if (nature === 'sans_produit' && dar.etat === 'inconnu') return []
    const message = avertissementDar({
      jourTraitement: minuitDuJour(t.date), jourRecolte: jourLot, dar,
      produit: t.produitPhytoRef?.nomCommercial ?? t.produitPhyto, relevantDUneAmm: nature === 'amm',
    }, calendrier)
    return message ? [message] : []
  })
  return [...new Set(messages)]
}

/** Une lecture bornée au tenant pour toute une liste de lots. */
export async function chargerAvertissementsDarLegumes(db: Db, userId: string, lots: LotLegume[]): Promise<Map<number, string[]>> {
  const resultat = new Map<number, string[]>()
  if (!lots.length) return resultat
  const cultures = [...new Set(lots.map((l) => l.cultureId))]
  const planches = [...new Set(lots.flatMap((l) => (l.plancheId ? [l.plancheId] : [])))]
  const parcelles = [...new Set(lots.flatMap((l) => (l.parcelleId ? [l.parcelleId] : [])))]
  const dernierJour = Math.max(...lots.map((l) => minuitDuJour(l.date)))
  const premierJour = Math.min(...lots.map((l) => minuitDuJour(l.date)))
  const traitements = await db.intervention.findMany({
    where: {
      userId,
      fait: true,
      type: 'traitement_phyto',
      // Un jour de marge : un traitement horodaté le soir en UTC est du lendemain en jour civil.
      date: { lt: new Date(dernierJour + 2 * MS_JOUR) },
      // Délai positif connu : sans borne basse, comme avant. Délai nul ou
      // inconnu : il ne compte que sur l'horizon de rappel, un jour de marge.
      OR: [
        { dar: { gt: 0 } },
        { dar: null, produitPhytoRef: { darJours: { gt: 0 } } },
        { date: { gte: new Date(premierJour - (HORIZON_DAR_INCONNU_JOURS + 1) * MS_JOUR) } },
      ],
      AND: [{ OR: [
        { cultureId: { in: cultures } },
        ...(planches.length ? [{ cultureId: null, plancheId: { in: planches } }] : []),
        ...(parcelles.length ? [{ cultureId: null, plancheId: null, arbreId: null, parcelleId: { in: parcelles } }] : []),
      ] }],
    },
    select: { cultureId: true, plancheId: true, parcelleId: true, arbreId: true, date: true, dar: true, produitPhyto: true, geste: true, produitPhytoRef: { select: { darJours: true, nomCommercial: true, classification: true } } },
  })
  for (const lot of lots) resultat.set(lot.id, avertissementsDarLot(lot, traitements))
  return resultat
}
