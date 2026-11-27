/**
 * Cookie de session recopié par Auth.js sur une réponse (équipe debug, D198).
 *
 * À chaque requête, Auth.js décode le jeton REÇU et le réécrit tel quel dans
 * la réponse, pour prolonger la session. Une requête partie avant un
 * changement de mot de passe porte l'ancienne version de session ; si sa
 * réponse arrive après celle du changement, ce cookie recopié remplaçait le
 * cookie tout juste réémis, et la session qui venait de changer son mot de
 * passe se retrouvait révoquée comme les autres.
 *
 * La prolongation n'est donc gardée que sur une navigation de document : les
 * appels faits par une page déjà ouverte (API, données de navigation, lecture
 * de `/api/auth/session`) ne réécrivent plus le cookie. Une suppression de
 * cookie (valeur vide) passe toujours, et un cookie posé par la route
 * elle-même (connexion, réémission, mise à jour de session) n'est pas
 * concerné : seul l'appelant décide d'appliquer ce filtre.
 *
 * Sans en-tête `Sec-Fetch-Dest` (navigateur ancien), rien n'est retiré : la
 * session continue de se prolonger comme avant.
 */
const COOKIE_SESSION = /^(?:__Secure-)?authjs\.session-token(?:\.\d+)?=([^;]*)/

export function sansCookieSessionRecopie<R extends Response>(requete: { headers: Headers }, reponse: R): R {
  const destination = requete.headers.get("sec-fetch-dest")
  if (!destination || destination === "document") return reponse
  const cookies = reponse.headers.getSetCookie()
  const gardes = cookies.filter((cookie) => {
    const session = COOKIE_SESSION.exec(cookie)
    return !session || session[1] === ""
  })
  if (gardes.length === cookies.length) return reponse
  try {
    reponse.headers.delete("set-cookie")
    for (const cookie of gardes) reponse.headers.append("set-cookie", cookie)
    return reponse
  } catch {
    // En-têtes figés : la réponse est reconstruite à l'identique, sans le cookie.
    const entetes = new Headers(reponse.headers)
    entetes.delete("set-cookie")
    for (const cookie of gardes) entetes.append("set-cookie", cookie)
    return new Response(reponse.body, { status: reponse.status, statusText: reponse.statusText, headers: entetes }) as R
  }
}
