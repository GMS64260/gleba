/**
 * DEV3 audit Marc 2026-05-14 — constantes méthodes de traitement.
 *
 * Centralise les 6 méthodes du référentiel pour qu'elles soient cohérentes
 * partout (UI SanteTab, registre phyto, export PDF/CSV, validation Zod).
 *
 * Le slug est ce qui est persisté en base (observations_sante.methode_traitement
 * et interventions.type). Le label est l'affichage utilisateur.
 */

export const METHODES_TRAITEMENT = [
  {
    slug: 'chimique_conventionnel',
    label: 'Chimique conventionnel',
    description: 'Pesticide de synthèse homologué',
    badge: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  },
  {
    slug: 'chimique_cuivre',
    label: 'Chimique cuivré',
    description: 'Produit à base de cuivre (Bouillie bordelaise, hydroxyde, oxychlorure)',
    badge: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  },
  {
    slug: 'biocontrole',
    label: 'Biocontrôle',
    description: 'Macro-organismes, médiateurs chimiques, substances naturelles',
    badge: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  },
  {
    slug: 'biologique_purin',
    label: 'Biologique (purin/décoction)',
    description: 'Préparation Naturelle Peu Préoccupante (PNPP)',
    badge: { bg: 'bg-lime-50', text: 'text-lime-700', border: 'border-lime-200' },
  },
  {
    slug: 'mecanique_manuel',
    label: 'Mécanique / Manuel',
    description: 'Piégeage, filets, désherbage manuel, taille sanitaire',
    badge: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  },
  {
    slug: 'prophylaxie',
    label: 'Prophylaxie',
    description: 'Mesure préventive (rotation, désinfection outils, gestion sanitaire)',
    badge: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
  },
] as const

export type MethodeTraitementSlug = (typeof METHODES_TRAITEMENT)[number]['slug']

export const METHODE_SLUGS: readonly MethodeTraitementSlug[] = METHODES_TRAITEMENT.map(
  (m) => m.slug
) as readonly MethodeTraitementSlug[]

export function labelMethode(slug: string | null | undefined): string {
  if (!slug) return '—'
  const m = METHODES_TRAITEMENT.find((x) => x.slug === slug)
  if (m) return m.label
  // Compat valeurs historiques
  if (slug === 'chimique') return 'Chimique conventionnel'
  if (slug === 'biologique') return 'Biologique (purin/décoction)'
  if (slug === 'mecanique') return 'Mécanique / Manuel'
  return slug
}

/** Une méthode est-elle "chimique" au sens large (déclenche les obligations
 *  Certiphyto + EPI + ZNT). */
export function methodeExigeCertiphyto(slug: string | null | undefined): boolean {
  return slug === 'chimique_conventionnel' || slug === 'chimique_cuivre'
}

/** Une méthode contient-elle du cuivre métal (alimente le compteur Bio). */
export function methodeContientCuivre(slug: string | null | undefined): boolean {
  return slug === 'chimique_cuivre'
}

// Classifications côté ProduitPhyto.classification (CHECK constraint)
export const PRODUIT_CLASSIFICATIONS = [
  'Chimique conventionnel',
  'Chimique cuivré',
  'Substance de base / PNPP',
  'Biocontrôle',
  'Biologique (purin/décoction)',
  'Autorisé AB',
  'Mécanique/Manuel',
  'Prophylaxie',
] as const

export type ProduitClassification = (typeof PRODUIT_CLASSIFICATIONS)[number]
