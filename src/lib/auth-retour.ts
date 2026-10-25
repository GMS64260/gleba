/**
 * Page de retour après connexion (`callbackUrl`).
 *
 * QA cmvnout4y (2026-10-25) : un lien profond ouvert sans session
 * (`/elevage?tab=alimentation&sub=soins`) passait par
 * `/login?callbackUrl=%2Felevage` : le middleware ne gardait que le chemin, et
 * l'utilisateur revenait sur l'onglet par défaut. Le chemin ET la requête
 * doivent traverser la connexion, par mot de passe comme par Google.
 *
 * La valeur arrive par l'URL, donc d'un tiers : seule une cible du site est
 * suivie. Pas de redirection ouverte vers `//ailleurs`, `https://ailleurs`,
 * `/\ailleurs` ou `javascript:`.
 *
 * Une seule règle pour tous : le middleware et les pages publiques fabriquent
 * le lien par `urlConnexion`, le formulaire relit la cible par
 * `cheminDeRetour`, la config Auth.js filtre ses redirections par
 * `redirectionApresConnexion`. Module pur, compatible Edge (importé par le
 * middleware).
 */

export const PAGE_CONNEXION = "/login"
export const RETOUR_PAR_DEFAUT = "/"

/** Origine fictive : résout un chemin relatif quand l'hôte n'est pas connu. */
const ORIGINE_NEUTRE = "https://gleba.invalid"

/**
 * Chemin relatif sûr (chemin + requête + ancre) vers lequel revenir, ou `null`
 * si la valeur est absente ou mène hors du site.
 *
 * `origine` (celle du site) fait aussi accepter une URL absolue de même
 * origine : c'est la forme qu'Auth.js pose dans ses propres redirections.
 */
export function cheminDeRetour(valeur: string | null | undefined, origine?: string): string | null {
  if (typeof valeur !== "string" || valeur.length === 0) return null

  let base = ORIGINE_NEUTRE
  if (origine) {
    try {
      base = new URL(origine).origin
    } catch {
      return null
    }
  }

  let cible: URL
  try {
    // L'analyseur d'URL est celui du navigateur : `/\ailleurs`, `/<tab>/ailleurs`
    // ou ` //ailleurs` y deviennent `//ailleurs`, donc un autre hôte, refusé
    // ci-dessous. `javascript:` ou `data:` ont l'origine « null ».
    cible = new URL(valeur, base)
  } catch {
    return null
  }
  if (cible.origin !== base) return null

  const chemin = cible.pathname + cible.search + cible.hash
  // `/.//ailleurs` se normalise en `//ailleurs` : relu par le navigateur, ce
  // chemin désignerait un autre hôte.
  if (!chemin.startsWith("/") || chemin.startsWith("//")) return null
  return chemin
}

/**
 * Page ouverte après une connexion réussie, lue sur les paramètres de
 * `/login` : c'est la valeur que le formulaire passe à `router.push` (mot de
 * passe) et au bouton Google. Absente ou hors du site : l'accueil.
 */
export function cibleApresConnexion(
  parametres: Pick<URLSearchParams, "get">,
  origine?: string,
): string {
  return cheminDeRetour(parametres.get("callbackUrl"), origine) ?? RETOUR_PAR_DEFAUT
}

/**
 * Lien vers la page de connexion qui ramènera à `cheminRetour` (requête
 * comprise). Une cible refusée donne la page de connexion seule.
 */
export function urlConnexion(cheminRetour: string): string {
  const chemin = cheminDeRetour(cheminRetour)
  if (!chemin) return PAGE_CONNEXION
  return `${PAGE_CONNEXION}?${new URLSearchParams({ callbackUrl: chemin })}`
}

/**
 * Callback `redirect` d'Auth.js (retour de Google, déconnexion, refus du
 * callback `signIn`) : même règle que le formulaire. La requête est gardée ;
 * hors du site, retour à l'accueil.
 */
export function redirectionApresConnexion({ url, baseUrl }: { url: string; baseUrl: string }): string {
  const origine = new URL(baseUrl).origin
  return `${origine}${cheminDeRetour(url, origine) ?? RETOUR_PAR_DEFAUT}`
}
