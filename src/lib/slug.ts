/**
 * Helpers pour générer/valider des slugs URL (boutiques, etc.)
 */

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire accents
    .replace(/[^a-z0-9]+/g, "-") // remplace tout non alphanumérique par -
    .replace(/^-+|-+$/g, "") // retire tirets début/fin
    .replace(/-{2,}/g, "-") // déduplique tirets
    .slice(0, 60)
}

/** Vérifie qu'un slug est conforme : minuscules, alphanumérique + tirets, 3-60 chars */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 60
}

const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "boutique",
  "comptabilite",
  "elevage",
  "arbres",
  "feedback",
  "jardin",
  "login",
  "register",
  "parametres",
  "panier",
  "public",
  "roadmap",
  "reset-password",
  "mot-de-passe-oublie",
  "stocks",
  "cultures",
  "interventions",
  "planches",
  "varietes",
  "especes",
  "static",
  "_next",
])

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug)
}
