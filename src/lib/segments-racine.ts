/**
 * Premiers segments d'URL qui existent dans l'application.
 *
 * Sans session, le middleware renvoyait toute adresse inconnue vers /login
 * (307) : une page introuvable n'était jamais un 404 pour Google (audit SEO
 * du 2026-11-09). Une adresse dont le premier segment n'est pas ici reçoit
 * désormais la page 404. Le défaut est sûr : un segment oublié dans cette
 * liste donne un 404 au visiteur anonyme, jamais un accès sans connexion.
 * `segments-racine.test.ts` compare la liste aux dossiers de `src/app`.
 */
export const SEGMENTS_RACINE: ReadonlySet<string> = new Set([
  // Interne Next et API (l'API garde son 401 JSON).
  "_next", "api",
  // Dossiers de `public` (fichiers servis par Next).
  "uploads", "csv-templates", "models", "fonts", "screenshots",
  // Fichiers à la racine non exclus par le matcher.
  "robots.txt", "sitemap.xml", "manifest.json", ".well-known",
  "1c943f7c7006d54211c7143b25a23aa8.txt",
  // Zone privée, absente d'un clone public mais présente dans l'image.
  "boutique", "feedback",
  // Application et pages publiques (`src/app`, groupes déployés).
  "admin", "aide", "apercu", "aujourdhui", "cgv", "communaute", "comptabilite",
  "conditions-service", "confidentialite", "dashboard", "desabonnement",
  "elevage", "glossaire", "impersonation", "interventions", "invitation",
  "jardin", "licence", "maraichage", "mentions-legales", "meteo", "onboarding",
  "parametres", "parcelles", "raccourcis", "referentiel", "suppression-compte",
  "taches", "tarifs", "tracabilite", "verger",
  // (auth)
  "login", "register", "mot-de-passe-oublie", "reset-password",
  // (marketing)
  "assistant-ia-agricole", "calendrier-semis", "carnet-de-culture",
  "comparatif-logiciels-maraichage", "itineraire-technique-maraichage",
  "logiciel-arboriculture", "logiciel-elevage", "logiciel-elevage-canin-felin",
  "logiciel-elevage-caprin", "logiciel-elevage-equin", "logiciel-elevage-nac",
  "logiciel-elevage-ovin", "logiciel-elevage-volailles", "logiciel-maraichage",
  "logiciel-micro-ferme", "logiciel-permaculture", "logiciel-potager",
  "logiciel-verger", "plan-de-ferme", "planification-maraichage",
  "registre-phytosanitaire", "registre-phytosanitaire-numerique",
  "rotation-cultures-maraichage",
])

/** Cible de la réécriture d'une adresse inconnue : aucune route n'y répond. */
export const CHEMIN_INTROUVABLE = "/_introuvable"

/**
 * Vrai si le premier segment de `pathname` n'existe pas. La racine et les
 * chemins qui commencent par `//` ne sont jamais déclarés inconnus : ils
 * gardent leur traitement habituel.
 */
export function segmentRacineInconnu(pathname: string): boolean {
  const correspondance = /^\/([^/]+)/.exec(pathname)
  if (!correspondance) return false
  let segment = correspondance[1]
  try {
    segment = decodeURIComponent(segment)
  } catch {
    return true
  }
  return !SEGMENTS_RACINE.has(segment)
}
