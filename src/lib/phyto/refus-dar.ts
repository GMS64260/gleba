import { ErreurCommerciale } from '@/lib/commercial/regles'
import type { TraitementDarEnCours, VerdictDarLot } from './delai-avant-recolte'

/**
 * Refus de mise en vente d'une récolte faite avant la fin d'un délai avant
 * récolte imposé par la loi (verdict `bloquant` de
 * `src/lib/phyto/delai-avant-recolte.ts`, où chaque règle cite son texte).
 *
 * Contrat d'API (lot dar-cadre-legal-blocage) : 409
 * `{ error, code: 'DAR_EN_COURS', traitements: [{ produit, dateTraitement,
 * finDelai, origineDelai }] }`. L'erreur étend `ErreurCommerciale` : toute
 * surface qui traduit déjà celle-ci répond 409 avec le message, même sans
 * connaître le code.
 */
export const CODE_DAR_EN_COURS = 'DAR_EN_COURS'

export const REFUS_MISE_EN_VENTE = 'Mise en vente refusée'
/** Première sortie de la marchandise d'une commande boutique (déjà payée ou non). */
export const REFUS_LIVRAISON = 'Livraison refusée'

export class ErreurDarEnCours extends ErreurCommerciale {
  readonly code = CODE_DAR_EN_COURS
  readonly traitements: TraitementDarEnCours[]
  constructor(verdict: Pick<VerdictDarLot, 'blocages' | 'traitements'>, refus: string = REFUS_MISE_EN_VENTE) {
    super(messageRefusDar(verdict, refus), 409)
    this.traitements = verdict.traitements
  }
}

export function messageRefusDar(verdict: Pick<VerdictDarLot, 'blocages'>, refus: string = REFUS_MISE_EN_VENTE): string {
  return `${refus} : délai avant récolte en cours. ${verdict.blocages.join(' ')}`
}

/** La seule garde des mises en vente : refuse sur `bloquant`, laisse passer les rappels. */
export function exigerVenteHorsDar(verdict: VerdictDarLot | null | undefined): void {
  if (verdict?.niveau === 'bloquant') throw new ErreurDarEnCours(verdict)
}

/** Corps JSON du refus, ou null si l'erreur n'en est pas un. */
export function corpsRefusDar(cause: unknown): { error: string; code: typeof CODE_DAR_EN_COURS; traitements: TraitementDarEnCours[] } | null {
  return cause instanceof ErreurDarEnCours ? { error: cause.message, code: cause.code, traitements: cause.traitements } : null
}
