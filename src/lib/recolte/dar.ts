import type { Prisma } from '@prisma/client'
import { jourCivilStocke } from '@/lib/jour-civil'
import { agregerVerdictsDar, darIntervention, HORIZON_DAR_INCONNU_JOURS, natureInterventionDar, verdictDar, VERDICT_DAR_LOT_RIEN, type CalendrierDar, type VerdictDarLot } from '@/lib/phyto/delai-avant-recolte'

type Db = Pick<Prisma.TransactionClient, 'intervention'>
type DbBoutique = Pick<Prisma.TransactionClient, 'intervention' | 'produitBoutique'>
export type LotLegume = { id: number; cultureId: number; plancheId: string | null; parcelleId?: string | null; date: Date }
export type TraitementDar = {
  cultureId: number | null
  plancheId: string | null
  parcelleId?: string | null
  arbreId?: number | null
  date: Date
  dar: number | null
  /** Délai ancien recopié du catalogue : indication, pas un délai saisi. */
  darIndicatif?: boolean | null
  produitPhyto: string | null
  geste?: string | null
  natureProduit?: string | null
  numAMM?: string | null
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

const calendrier: CalendrierDar = { ajouterJours: (jour, n) => jour + n * MS_JOUR, formater: jourFr, iso: (jour) => new Date(jour).toISOString().slice(0, 10) }

/**
 * Verdict de délai avant récolte (DAR) d'un lot de légumes, PUR.
 * Un traitement compte s'il vise la culture récoltée, sa planche sans viser de
 * culture, ou la parcelle entière de sa planche (ni culture, ni planche, ni
 * arbre désignés). Même règle que les fruits (`src/lib/verger/dar.ts`) : la récolte
 * est libre le jour « traitement + DAR », et le délai saisi sur l'intervention
 * prime sur celui du référentiel. Niveaux bloquant / informatif et textes :
 * `src/lib/phyto/delai-avant-recolte.ts`.
 */
export function verdictDarLot(lot: LotLegume, traitements: TraitementDar[]): VerdictDarLot {
  const jourLot = minuitDuJour(lot.date)
  return agregerVerdictsDar(traitements.flatMap((t) => {
    const vise = t.cultureId != null
      ? t.cultureId === lot.cultureId
      : t.plancheId != null
        ? t.plancheId === lot.plancheId
        : t.arbreId == null && t.parcelleId != null && t.parcelleId === lot.parcelleId
    if (!vise) return []
    return [verdictDar({
      jourTraitement: minuitDuJour(t.date), jourRecolte: jourLot, dar: darIntervention(t),
      produit: t.produitPhytoRef?.nomCommercial ?? t.produitPhyto, nature: natureInterventionDar(t),
    }, calendrier)]
  }))
}

/** Tous les messages du verdict : ce que montre la saisie d'une récolte. */
export function avertissementsDarLot(lot: LotLegume, traitements: TraitementDar[]): string[] {
  return verdictDarLot(lot, traitements).avertissements
}

/**
 * Une lecture bornée au tenant (`userId` = exploitation) pour toute une liste
 * de lots : le traitement d'une autre exploitation n'entre jamais au verdict.
 */
export async function chargerVerdictsDarLegumes(db: Db, userId: string, lots: LotLegume[]): Promise<Map<number, VerdictDarLot>> {
  const resultat = new Map<number, VerdictDarLot>()
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
    select: { cultureId: true, plancheId: true, parcelleId: true, arbreId: true, date: true, dar: true, darIndicatif: true, produitPhyto: true, geste: true, natureProduit: true, numAMM: true, produitPhytoRef: { select: { darJours: true, nomCommercial: true, classification: true } } },
  })
  for (const lot of lots) resultat.set(lot.id, verdictDarLot(lot, traitements))
  return resultat
}

/** Verdict d'une seule récolte de légumes (mise en vente, fiche). */
export async function verdictDarLegume(db: Db, userId: string, lot: LotLegume): Promise<VerdictDarLot> {
  return (await chargerVerdictsDarLegumes(db, userId, [lot])).get(lot.id) ?? VERDICT_DAR_LOT_RIEN
}

/** Les messages seuls, pour les surfaces de saisie. */
export async function chargerAvertissementsDarLegumes(db: Db, userId: string, lots: LotLegume[]): Promise<Map<number, string[]>> {
  const verdicts = await chargerVerdictsDarLegumes(db, userId, lots)
  return new Map([...verdicts].map(([id, v]) => [id, v.avertissements]))
}

/**
 * Verdict des produits de boutique issus d'une récolte, par identifiant de
 * produit. Contre-revue du tour 2 : la publication était contrôlée, mais un
 * traitement saisi ou corrigé APRÈS coup laissait le produit commandable,
 * livrable et comptabilisé. La commande publique, la vitrine et la première
 * sortie de stock d'une commande relisent donc ce verdict. Lecture bornée à
 * l'exploitation (`userId`) ; un produit sans récolte source n'a pas de verdict.
 */
export async function chargerVerdictsDarProduitsBoutique(db: DbBoutique, userId: string, produitIds: number[]): Promise<Map<number, VerdictDarLot>> {
  const resultat = new Map<number, VerdictDarLot>()
  if (!produitIds.length) return resultat
  const produits = await db.produitBoutique.findMany({
    where: { id: { in: produitIds }, userId, recolteId: { not: null }, recolte: { userId } },
    select: { id: true, recolte: { select: { id: true, cultureId: true, date: true, culture: { select: { plancheId: true, planche: { select: { parcelleGeoId: true } } } } } } },
  })
  const lots = produits.flatMap((p) => p.recolte
    ? [{ id: p.recolte.id, cultureId: p.recolte.cultureId, plancheId: p.recolte.culture.plancheId, parcelleId: p.recolte.culture.planche?.parcelleGeoId ?? null, date: p.recolte.date }]
    : [])
  const verdicts = await chargerVerdictsDarLegumes(db, userId, lots)
  for (const p of produits) if (p.recolte) resultat.set(p.id, verdicts.get(p.recolte.id) ?? VERDICT_DAR_LOT_RIEN)
  return resultat
}
