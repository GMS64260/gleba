/**
 * Réémission du cookie de session après un changement de mot de passe (MC3).
 *
 * Le changement incrémente la version de session du compte : toutes les
 * sessions tombent, y compris celle qui vient de le faire. Celle-ci est
 * réémise ici, côté serveur, avec la nouvelle version : c'est la seule voie,
 * le rappel `jwt` sur `update` ne recopiant jamais la version (cf.
 * `session-version.ts`).
 *
 * Le cookie est écrit exactement comme Auth.js l'écrit : même nom (préfixe
 * `__Secure-` selon le protocole de l'URL publique), même sel de chiffrement
 * (le nom du cookie), même secret, mêmes options, même durée. Le jeton
 * d'origine est relu depuis la requête et seule sa version change.
 *
 * Réservé aux routes : ce module n'est pas atteignable depuis `auth.ts` ni le
 * middleware.
 */
import { decode, encode, type JWT } from "next-auth/jwt"
import type { NextResponse } from "next/server"
import { DUREE_SESSION_SECONDES } from "@/lib/session-version"

const NOM_COOKIE = "authjs.session-token"
// Au-delà, Auth.js découpe le cookie en morceaux : non géré ici.
const TAILLE_MAX_COOKIE = 3800

/** Même règle qu'Auth.js : URL publique configurée, sinon protocole de la requête. */
function cookieSecurise(requete: Request): boolean {
  const urlPublique = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL
  if (urlPublique) return new URL(urlPublique).protocol === "https:"
  const proto = requete.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  return (proto ? `${proto}:` : new URL(requete.url).protocol) === "https:"
}

function lireCookie(requete: Request, nom: string): string | null {
  for (const morceau of (requete.headers.get("cookie") ?? "").split(";")) {
    const i = morceau.indexOf("=")
    if (i > 0 && morceau.slice(0, i).trim() === nom) return decodeURIComponent(morceau.slice(i + 1).trim())
  }
  return null
}

/**
 * Pose sur `reponse` le cookie de session réémis avec `sessionVersion`.
 * Rend `false` (et ne pose rien) si le jeton de la requête n'est pas lisible,
 * n'est pas celui de `acteurId` ou est une consultation administrateur :
 * l'appelant doit alors inviter à se reconnecter.
 */
export async function reemettreSession(
  requete: Request,
  reponse: NextResponse,
  attendu: { acteurId: string; sessionVersion: number },
): Promise<boolean> {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) return false
  const securise = cookieSecurise(requete)
  const nom = `${securise ? "__Secure-" : ""}${NOM_COOKIE}`
  const brut = lireCookie(requete, nom)
  if (!brut) return false

  let jeton: JWT | null
  try {
    jeton = await decode({ token: brut, secret, salt: nom })
  } catch {
    return false
  }
  if (!jeton || jeton.id !== attendu.acteurId || jeton.impersonatedBy) return false

  // `encode` repose `iat`, `exp` et `jti` : la session repart pour sa durée
  // pleine, comme à chaque rafraîchissement par Auth.js.
  const valeur = await encode({
    token: { ...jeton, sessionVersion: attendu.sessionVersion },
    secret,
    salt: nom,
    maxAge: DUREE_SESSION_SECONDES,
  })
  if (valeur.length > TAILLE_MAX_COOKIE) return false

  reponse.cookies.set(nom, valeur, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: securise,
    expires: new Date(Date.now() + DUREE_SESSION_SECONDES * 1000),
  })
  return true
}
