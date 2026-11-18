import { TERRITOIRES, deviseDuTerritoire, type Devise } from '@/lib/territoires'

/**
 * XPF est disponible dans Gleba depuis le 29/06/2026 (commit
 * 2da1f14dfbb7339d1e2fca4a14a7b3c988b3f56f, src/lib/territoires.ts).
 * Avant ce jour, une pièce sans devise ni territoire était nécessairement EUR.
 * À partir de ce jour, aucune devise courante ne peut remplacer l'identité figée.
 * Une identité présente mais invalide reste indéterminée, quelle que soit la date.
 */
export function monnaieFacture(snapshot: unknown, date?: Date | string | null): Devise | null {
  if (snapshot != null && (typeof snapshot !== 'object' || Array.isArray(snapshot))) return null
  const emetteur = (snapshot ?? {}) as Record<string, unknown>
  if (emetteur.devise != null && emetteur.devise !== '')
    return emetteur.devise === 'EUR' || emetteur.devise === 'XPF' ? emetteur.devise : null
  if (emetteur.territoire != null && emetteur.territoire !== '') {
    const territoire = emetteur.territoire
    return typeof territoire === 'string' && Object.hasOwn(TERRITOIRES, territoire)
      ? TERRITOIRES[territoire].devise
      : null
  }
  if (!date) return null
  const emission = new Date(date).getTime()
  return Number.isFinite(emission) && emission < Date.UTC(2026, 5, 29) ? 'EUR' : null
}

/**
 * Compatibilité avec les lecteurs d'origin/main conservés par la zone privée.
 * Le défaut historique est ignoré : il ne prouve pas la devise de la pièce.
 * Les lecteurs de cette branche utilisent `monnaieFacture` avec leur date.
 */
export function deviseFactureReglement(snapshot: unknown, _defaut: string, date?: Date | string | null): string {
  return monnaieFacture(snapshot, date) ?? ''
}

/*
 * Frontière public/privé : ce module est PUBLIC et ne dépend que de modules
 * publics. La devise d'une vente manuelle (contexte fiscal figé, colonne de
 * la zone privée) se lit par `monnaieVente` de `devise-vente.ts`, public.
 */

/** Devise courante de l'exploitation : sa devise déclarée, sinon celle de son territoire. */
export function deviseCouranteExploitation(exploitation: { devise?: string | null; territoire?: string | null } | null | undefined): Devise {
  return exploitation?.devise === 'EUR' || exploitation?.devise === 'XPF'
    ? exploitation.devise
    : deviseDuTerritoire(exploitation?.territoire)
}

