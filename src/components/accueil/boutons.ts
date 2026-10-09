/**
 * Classes des boutons de l'accueil v2 (charte « carnet de ferme ») : bordure
 * lin sur craie, principal en sauge. Cible tactile de 44 px, focus visible.
 * Partagées par l'en-tête, les tuiles et les bandeaux ; pas un composant pour
 * rester utilisables sur un <Link> comme sur un <button>.
 */

export const CLASSES_BOUTON =
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-lin bg-craie px-3.5 text-sm font-semibold text-encre transition-colors duration-fast hover:border-sauge hover:bg-sauge-doux focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge disabled:opacity-50"

export const CLASSES_BOUTON_PRINCIPAL =
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-sauge bg-sauge px-3.5 text-sm font-semibold text-craie transition-colors duration-fast hover:bg-foret hover:border-foret focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge disabled:opacity-50"

export const CLASSES_LIEN_DISCRET =
  "inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-xs font-semibold text-sauge underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge"
