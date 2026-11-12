/**
 * Annulation d'un soin administré — règle unique pour l'écran et l'assistant
 * (constat C9 de la revue réglementaire du 2026-11-12).
 *
 * Règlement (UE) 2019/6, art. 108 §1, §2 et §5 : le détenteur tient le registre
 * des médicaments qu'il utilise et le garde cinq ans à disposition des
 * autorités. Arrêté du 5 juin 2000, art. 7 (mention de l'administration) et
 * art. 11 (conservation cinq ans, trois ans pour les volailles hors
 * ordonnances).
 *
 * Avant : supprimer un soin, décocher « fait » ou rouvrir une injection
 * réalisée effaçait l'acte du registre, rendait les doses à la pharmacie et
 * recalculait l'écartement du lait sans lui, en un clic et sans trace.
 *
 * Désormais, trois chemins (suppression, réouverture du soin, réouverture ou
 * annulation d'une injection réalisée) passent par cette garde :
 *  - administration réelle : refus. L'acte reste au registre, aucune dose ne
 *    revient en pharmacie et les délais d'attente restent ceux de l'acte.
 *    Une donnée fausse (date, dose, produit) se corrige par « Modifier ».
 *  - erreur de saisie (l'acte n'a jamais eu lieu) : possible avec un motif.
 *    L'original est d'abord écrit au journal `annulations_soins_animaux`
 *    (ajout seul), daté et attribué ; puis les doses fictivement prélevées sont
 *    rendues et la fausse restriction sanitaire est levée.
 *
 * Le journal est un choix logiciel de preuve : les textes imposent de tenir et
 * conserver le registre, pas une forme de journal de correction.
 */

import type { Prisma } from '@prisma/client'

export const NATURES_ANNULATION = ['erreur_saisie', 'administre'] as const
export type NatureAnnulation = (typeof NATURES_ANNULATION)[number]

export type ActionAnnulation = 'suppression' | 'reouverture' | 'injection_rouverte' | 'injection_annulee'

export interface DemandeAnnulation {
  nature: NatureAnnulation
  motif: string
}

export const MOTIF_MIN = 3
export const MOTIF_MAX = 500

/**
 * Refus décidé SOUS le verrou des écritures de soins (revue Codex CR-SOI-01) :
 * levé dans la transaction pour l'annuler, rendu tel quel par l'appelant.
 */
export class RefusSousVerrou extends Error {
  constructor(public readonly resultat: { ok: false; status: number; error: string; code?: string }) {
    super(resultat.error)
  }
}

export interface RefusAnnulation {
  ok: false
  status: 409
  code: 'ANNULATION_MOTIVEE_REQUISE' | 'SOIN_ADMINISTRE_CONSERVE'
  error: string
}

export const MESSAGE_ANNULATION_REQUISE =
  "Ce soin a été enregistré comme administré. Pour l'effacer ou le rouvrir, indiquez qu'il s'agit d'une erreur de saisie et donnez-en le motif : l'original est conservé au journal des annulations."
export const MESSAGE_SOIN_ADMINISTRE =
  "Un soin réellement administré reste au registre : ses doses ne reviennent pas en pharmacie et ses délais d'attente restent actifs. Corrigez plutôt la date, la dose ou le produit avec « Modifier »."

/**
 * Contrôle une demande d'annulation reçue (corps HTTP, outil de l'assistant).
 * Rend la demande normalisée (motif sans espaces de bord) ou le refus 409.
 */
export function controlerAnnulation(demande: unknown): { ok: true; demande: DemandeAnnulation & { nature: 'erreur_saisie' } } | RefusAnnulation {
  const d = (demande && typeof demande === 'object' ? demande : {}) as { nature?: unknown; motif?: unknown }
  if (d.nature === 'administre') {
    return { ok: false, status: 409, code: 'SOIN_ADMINISTRE_CONSERVE', error: MESSAGE_SOIN_ADMINISTRE }
  }
  const motif = typeof d.motif === 'string' ? d.motif.trim() : ''
  if (d.nature !== 'erreur_saisie' || motif.length < MOTIF_MIN) {
    return { ok: false, status: 409, code: 'ANNULATION_MOTIVEE_REQUISE', error: MESSAGE_ANNULATION_REQUISE }
  }
  return { ok: true, demande: { nature: 'erreur_saisie', motif: motif.slice(0, MOTIF_MAX) } }
}

interface InjectionPourGarde {
  statut: string
}

/**
 * Un soin porte un acte administré s'il est « fait », s'il a prélevé des doses
 * en pharmacie, ou si l'une de ses injections est réalisée.
 */
export function soinAdministre(
  soin: { fait: boolean; quantitePreleveeStock?: number | null },
  injections: InjectionPourGarde[] = [],
): boolean {
  return soin.fait || (soin.quantitePreleveeStock ?? 0) > 0 || injections.some((i) => i.statut === 'realisee')
}

export interface EntreeJournalAnnulation {
  userId: string
  /** Personne connectée qui demande l'annulation (invitée comprise). */
  acteurId: string
  soinId: number
  action: ActionAnnulation
  demande: DemandeAnnulation
  injectionNumero?: number | null
  /** Injections déjà lues par l'appelant ; relues sinon. */
  injections?: unknown[]
}

/**
 * Écrit l'original du soin au journal, DANS la transaction de l'annulation et
 * AVANT toute écriture : si l'annulation échoue, le journal part avec elle ;
 * si le journal échoue, rien n'est annulé.
 */
export async function journaliserAnnulationSoin(tx: Prisma.TransactionClient, entree: EntreeJournalAnnulation) {
  const soin = await tx.soinAnimal.findFirst({
    where: { id: entree.soinId, userId: entree.userId },
    include: {
      animal: { select: { id: true, nom: true, identifiant: true } },
      lot: { select: { id: true, nom: true } },
      produitVeterinaire: { select: { id: true, nom: true, amm: true } },
      stockMedicament: { select: { id: true, numeroLot: true, datePeremption: true, unite: true } },
    },
  })
  if (!soin) throw new Error('SOIN_INTROUVABLE_POUR_JOURNAL')
  const injections = entree.injections ?? await tx.injectionSoin.findMany({
    where: { soinId: entree.soinId, userId: entree.userId },
    orderBy: { numero: 'asc' },
    select: { numero: true, datePrevue: true, dateRealisee: true, statut: true },
  })
  // JSON stable : dates en ISO, aucune valeur non sérialisable.
  const instantane = JSON.parse(JSON.stringify({ soin, injections })) as Prisma.InputJsonValue
  return tx.annulationSoinAnimal.create({
    data: {
      userId: entree.userId,
      soinId: entree.soinId,
      soinIdOrigine: entree.soinId,
      action: entree.action,
      nature: entree.demande.nature,
      motif: entree.demande.motif,
      acteurId: entree.acteurId,
      injectionNumero: entree.injectionNumero ?? null,
      instantane,
    },
  })
}
