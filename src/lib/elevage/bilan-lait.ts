/**
 * Bilan matière du lait : collecté, écarté, livré, vendu cru et transformé,
 * par jour civil de Paris.
 *
 * Décision du 2026-11-03 : pas d'affectation stricte comme pour
 * les œufs. Le lait attend 2 à 3 jours dans le tank avant le passage de la
 * laiterie, et une partie part aux veaux sans être saisie : un blocage
 * refuserait des saisies justes. Une sortie (vente de lait cru en litres,
 * livraison à la laiterie, fabrication) que la traite des 7 derniers jours ne
 * couvre pas déclenche une alerte que l'utilisateur confirme.
 *
 * Règle de couverture : le lait d'une traite peut sortir le jour même et
 * pendant les 6 jours suivants ; chaque sortie prend le lait le plus ancien
 * encore valable. Une simple somme sur une fenêtre glissante signalait à tort
 * une vente couverte par une traite antérieure (fenêtres qui commencent après
 * cette traite). Le lait écarté pour délai d'attente ne couvre rien ; une
 * collecte rattachée à une fabrication est consommée par elle.
 *
 * Sans collecte saisie dans les 7 jours d'une sortie, pas d'alerte : l'éleveur
 * ne suit alors que ses livraisons. Une fabrication sans collecte compte son
 * volume déclaré au jour de fabrication. Une vente de lait dans une autre
 * unité que le litre (bouteille, unité…) n'a pas de volume connu : elle est
 * comptée à part, hors bilan (même règle que l'économie du lait).
 */
import type { Prisma } from '@prisma/client'
import { dateIsoFacture } from '@/lib/facture-regles'
import { finJourLivraison } from '@/lib/commercial/dates-stock'
import { CODE_LAIT_INDISPONIBLE } from './lait-indisponible'

export const FENETRE_BILAN_LAIT_JOURS = 7

/**
 * Marge avant l'alerte : la laiterie ne mesure pas comme le pot trayeur.
 * La traite couvre 5 % de plus que son volume saisi, et un manque d'au plus
 * 1 L n'alerte pas.
 */
export const TOLERANCE_BILAN_LAIT = { part: 0.05, litresMin: 1 } as const

export type PosteLait = 'collecte' | 'ecarte' | 'livre' | 'venduCru' | 'transforme'

export interface MouvementLait {
  /** Jour civil de Paris, AAAA-MM-JJ. */
  jour: string
  poste: PosteLait
  litres: number
  /** `vente:<id>` : permet de retirer la vente qu'on corrige. */
  source?: string
  /** Transformation d'une collecte rattachée : elle consomme cette traite. */
  consommeCollecte?: boolean
}

export interface BilanLait {
  debut: string
  fin: string
  collecte: number
  /** Part du collecté écartée pour délai d'attente vétérinaire. */
  ecarte: number
  livre: number
  venduCru: number
  transforme: number
  /** Collecté hors lait écarté. */
  disponible: number
  sorties: number
  /**
   * Disponible moins sorties : pertes, lait aux veaux, autoconsommation ou
   * saisie manquante. Négatif quand les sorties dépassent la traite.
   */
  nonAffecte: number
  nbCollectes: number
  /** Ventes de lait sans volume connu (unité autre que le litre). */
  ventesHorsLitres: number
}

/** Bilan des 7 jours qui finissent au jour du manque le plus fort. */
export interface AlerteLaitIndisponible extends BilanLait {
  /** Sorties moins lait disponible sur ces 7 jours. */
  depassement: number
  /** Litres de sortie que la saisie laisse sans traite pour les couvrir. */
  manque: number
}

export type DbLait = Pick<Prisma.TransactionClient, 'collecteLait' | 'livraisonLait' | 'venteProduit' | 'lotFromage'>

const arrondi = (n: number) => Math.round(n * 100) / 100
const EPSILON = 1e-9
/**
 * Jours lus autour des jours touchés. Avant : amorcer la réserve (les sorties
 * antérieures ont déjà puisé dans la traite). Après : un manque peut se
 * reporter sur une sortie plus tardive, qui prend une traite plus récente.
 */
const AMORCE_JOURS = 3 * (FENETRE_BILAN_LAIT_JOURS - 1)
const PORTEE_JOURS = 2 * (FENETRE_BILAN_LAIT_JOURS - 1)

export const jourParis = (d: Date) => dateIsoFacture(d)

export function decalerJour(jour: string, n: number): string {
  return new Date(Date.parse(`${jour}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
}

export function finJourParis(jour: string): Date {
  return finJourLivraison(new Date(`${jour}T12:00:00Z`))
}

export function debutJourParis(jour: string): Date {
  return new Date(finJourParis(decalerJour(jour, -1)).getTime() + 1)
}

/** Même règle que l'économie du lait : L, l, litre(s). */
export function estVenteEnLitres(unite: string | null | undefined): boolean {
  return (unite ?? '').trim().toLowerCase().startsWith('l')
}

export function bilanDepuisMouvements(
  mouvements: MouvementLait[],
  debut: string,
  fin: string,
  ventesHorsLitres = 0,
): BilanLait {
  const postes: Record<PosteLait, number> = { collecte: 0, ecarte: 0, livre: 0, venduCru: 0, transforme: 0 }
  let nbCollectes = 0
  for (const m of mouvements) {
    if (m.jour < debut || m.jour > fin) continue
    postes[m.poste] += m.litres
    if (m.poste === 'collecte') nbCollectes++
  }
  const disponible = postes.collecte - postes.ecarte
  const sorties = postes.livre + postes.venduCru + postes.transforme
  return {
    debut,
    fin,
    collecte: arrondi(postes.collecte),
    ecarte: arrondi(postes.ecarte),
    livre: arrondi(postes.livre),
    venduCru: arrondi(postes.venduCru),
    transforme: arrondi(postes.transforme),
    disponible: arrondi(disponible),
    sorties: arrondi(sorties),
    nonAffecte: arrondi(disponible - sorties),
    nbCollectes,
    ventesHorsLitres,
  }
}

/**
 * Litres de sortie qu'aucune traite valable ne couvre, par jour de sortie,
 * du `debut` au `fin` inclus. Seuls comptent les jours suivis (une collecte
 * saisie dans leurs 7 jours). Les mouvements antérieurs à `debut` sont
 * ignorés : l'appelant commence assez tôt pour amorcer la réserve.
 */
export function manquesLait(mouvements: MouvementLait[], debut: string, fin: string): Map<string, number> {
  const offre = new Map<string, number>()
  const demande = new Map<string, number>()
  const joursCollecte = new Set<string>()
  const ajouter = (carte: Map<string, number>, jour: string, litres: number) => carte.set(jour, (carte.get(jour) ?? 0) + litres)
  for (const m of mouvements) {
    if (m.poste === 'collecte') { ajouter(offre, m.jour, m.litres); joursCollecte.add(m.jour) }
    else if (m.poste === 'ecarte' || (m.poste === 'transforme' && m.consommeCollecte)) ajouter(offre, m.jour, -m.litres)
    else ajouter(demande, m.jour, m.litres)
  }
  const suivi = (jour: string) => {
    for (let i = 0; i < FENETRE_BILAN_LAIT_JOURS; i++) if (joursCollecte.has(decalerJour(jour, -i))) return true
    return false
  }
  const manques = new Map<string, number>()
  // Réserve rangée par jour de traite, donc par date limite : on puise en tête.
  const reserve: { limite: string; litres: number }[] = []
  for (let jour = debut; jour <= fin; jour = decalerJour(jour, 1)) {
    while (reserve.length > 0 && reserve[0].limite < jour) reserve.shift()
    const traite = Math.max(0, offre.get(jour) ?? 0) * (1 + TOLERANCE_BILAN_LAIT.part)
    if (traite > EPSILON) reserve.push({ limite: decalerJour(jour, FENETRE_BILAN_LAIT_JOURS - 1), litres: traite })
    let reste = demande.get(jour) ?? 0
    while (reste > EPSILON && reserve.length > 0) {
      const pris = Math.min(reste, reserve[0].litres)
      reserve[0].litres -= pris
      reste -= pris
      if (reserve[0].litres <= EPSILON) reserve.shift()
    }
    if (reste > EPSILON && suivi(jour)) manques.set(jour, reste)
  }
  return manques
}

/**
 * Compare la couverture des sorties avant et après l'opération, à partir du
 * premier jour touché. Alerte quand l'opération laisse plus de 1 L de sorties
 * sans traite pour les couvrir ; corriger une vente à la baisse n'alerte
 * jamais.
 */
export function alerteDisponibilite(
  avant: MouvementLait[],
  apres: MouvementLait[],
  jours: string[],
): AlerteLaitIndisponible | null {
  const tries = [...new Set(jours)].sort()
  if (tries.length === 0) return null
  const debutCalcul = decalerJour(tries[0], -AMORCE_JOURS)
  const finCalcul = decalerJour(tries[tries.length - 1], PORTEE_JOURS)
  const manquesAvant = manquesLait(avant, debutCalcul, finCalcul)
  const manquesApres = manquesLait(apres, debutCalcul, finCalcul)
  const total = (manques: Map<string, number>) =>
    [...manques].reduce((somme, [jour, litres]) => (jour >= tries[0] ? somme + litres : somme), 0)
  const manque = total(manquesApres) - total(manquesAvant)
  if (manque <= TOLERANCE_BILAN_LAIT.litresMin) return null
  let jourPire = tries[0]
  let haussePire = -Infinity
  for (const [jour, litres] of manquesApres) {
    const hausse = litres - (manquesAvant.get(jour) ?? 0)
    if (jour >= tries[0] && hausse > haussePire) { haussePire = hausse; jourPire = jour }
  }
  const bilan = bilanDepuisMouvements(apres, decalerJour(jourPire, -(FENETRE_BILAN_LAIT_JOURS - 1)), jourPire)
  return { ...bilan, depassement: arrondi(bilan.sorties - bilan.disponible), manque: arrondi(manque) }
}

export async function chargerMouvementsLait(
  db: DbLait,
  userId: string,
  debutJour: string,
  finJour: string,
): Promise<{ mouvements: MouvementLait[]; ventesHorsLitres: number }> {
  const plage = { gte: debutJourParis(debutJour), lte: finJourParis(finJour) }
  const [collectes, fabrications, livraisons, ventes] = await Promise.all([
    db.collecteLait.findMany({
      where: { userId, date: plage },
      select: { date: true, quantiteLitres: true, ecarteAttente: true, lotFromageId: true },
    }),
    db.lotFromage.findMany({
      where: { userId, dateFabrication: plage, collectes: { none: {} } },
      select: { dateFabrication: true, volumeLaitUtiliseL: true },
    }),
    db.livraisonLait.findMany({ where: { userId, date: plage }, select: { date: true, litres: true } }),
    db.venteProduit.findMany({
      where: { userId, type: 'lait', annule: false, date: plage },
      select: { id: true, date: true, quantite: true, unite: true },
    }),
  ])
  const mouvements: MouvementLait[] = []
  for (const c of collectes) {
    const jour = jourParis(c.date)
    const litres = Number(c.quantiteLitres)
    mouvements.push({ jour, poste: 'collecte', litres })
    // Une collecte sort de l'offre UNE fois. Affectée à une fabrication puis
    // écartée par un soin saisi après coup, elle comptait à la fois « écartée »
    // et « transformée » : le non affecté descendait d'autant (−40 L pour 40 L)
    // et déclenchait de fausses alertes `LAIT_INDISPONIBLE`. Le lait est dans le
    // fromage : c'est la fabrication qui l'a consommé.
    if (c.lotFromageId) mouvements.push({ jour, poste: 'transforme', litres, consommeCollecte: true })
    else if (c.ecarteAttente) mouvements.push({ jour, poste: 'ecarte', litres })
  }
  for (const f of fabrications) {
    mouvements.push({ jour: jourParis(f.dateFabrication), poste: 'transforme', litres: Number(f.volumeLaitUtiliseL) })
  }
  for (const l of livraisons) mouvements.push({ jour: jourParis(l.date), poste: 'livre', litres: Number(l.litres) })
  let ventesHorsLitres = 0
  for (const v of ventes) {
    if (!estVenteEnLitres(v.unite)) { ventesHorsLitres++; continue }
    mouvements.push({ jour: jourParis(v.date), poste: 'venduCru', litres: v.quantite, source: `vente:${v.id}` })
  }
  return { mouvements, ventesHorsLitres }
}

export async function chargerBilanLait(db: DbLait, userId: string, debut: string, fin: string): Promise<BilanLait> {
  const { mouvements, ventesHorsLitres } = await chargerMouvementsLait(db, userId, debut, fin)
  return bilanDepuisMouvements(mouvements, debut, fin, ventesHorsLitres)
}

/** Bilans affichés : les 7 derniers jours et le mois en cours, jusqu'au jour donné. */
export async function chargerBilansLait(db: DbLait, userId: string, jour: string) {
  const [jours7, mois] = await Promise.all([
    chargerBilanLait(db, userId, decalerJour(jour, -(FENETRE_BILAN_LAIT_JOURS - 1)), jour),
    chargerBilanLait(db, userId, `${jour.slice(0, 8)}01`, jour),
  ])
  return { jours7, mois }
}

/**
 * Contrôle d'une sortie de lait avant écriture. `ajout` : les mouvements que
 * l'opération crée ; `retirerSource` : la vente corrigée, retirée de l'état
 * après ; `jours` : jours touchés en plus de ceux de l'ajout (ancien jour
 * d'une vente déplacée).
 */
export async function verifierDisponibiliteLait(
  db: DbLait,
  userId: string,
  operation: { ajout: MouvementLait[]; retirerSource?: string; jours?: string[] },
): Promise<AlerteLaitIndisponible | null> {
  const jours = [...new Set([...(operation.jours ?? []), ...operation.ajout.map((m) => m.jour)])].sort()
  if (jours.length === 0) return null
  const { mouvements } = await chargerMouvementsLait(db, userId, decalerJour(jours[0], -AMORCE_JOURS), decalerJour(jours[jours.length - 1], PORTEE_JOURS))
  const apres = mouvements
    .filter((m) => !operation.retirerSource || m.source !== operation.retirerSource)
    .concat(operation.ajout)
  return alerteDisponibilite(mouvements, apres, jours)
}

const litres = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} L`
const jourCourt = (jour: string) => `${jour.slice(8, 10)}/${jour.slice(5, 7)}`

export function messageLaitIndisponible(a: AlerteLaitIndisponible): string {
  const detail = ([['vendu cru', a.venduCru], ['livré', a.livre], ['transformé', a.transforme]] as const)
    .filter(([, v]) => v > 0)
    .map(([libelle, v]) => `${libelle} ${litres(v)}`)
    .join(', ')
  const ecarte = a.ecarte > 0 ? ` (hors ${litres(a.ecarte)} écartés pour délai d'attente)` : ''
  return `Du ${jourCourt(a.debut)} au ${jourCourt(a.fin)}, les sorties de lait (${detail}) atteindraient ${litres(a.sorties)} pour ${litres(a.disponible)} collectés${ecarte} : ${litres(a.depassement)} de plus que la traite. Si ce lait vient d'un achat ou d'une collecte non saisie, vous pouvez confirmer.`
}

/** Levée dans une transaction ; la route la rend avec `corpsLaitIndisponible`. */
export class LaitIndisponibleError extends Error {
  constructor(readonly alerte: AlerteLaitIndisponible) {
    super(messageLaitIndisponible(alerte))
    this.name = 'LaitIndisponibleError'
  }
}

/** Corps de la réponse 422 que les formulaires proposent de confirmer. */
export function corpsLaitIndisponible(a: AlerteLaitIndisponible) {
  return { error: messageLaitIndisponible(a), code: CODE_LAIT_INDISPONIBLE, details: a }
}
