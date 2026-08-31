/**
 * Routes NextAuth.js
 */

import { handlers } from "@/lib/auth"

export const { GET, POST } = handlers

/**
 * `HEAD` répond sans passer par Auth.js.
 *
 * Constaté le 2026-08-26 : `api_errors` portait cinq lignes rouges
 * `UnknownAction: Only GET and POST requests are supported`, toutes pendant la
 * première session d'un compte neuf. Mécanisme, prouvé par sonde sur la
 * production et non déduit — `HEAD /api/auth/session` et `HEAD /api/auth/csrf`
 * rendaient 400 avec exactement ce message : ce fichier n'exporte que `GET` et
 * `POST`, Next.js répond alors aux `HEAD` en appelant l'export `GET`, et le
 * handler Auth.js contrôle lui-même `req.method`, voit `HEAD` et lève.
 *
 * Rien n'était cassé pour l'utilisateur, mais le compteur d'erreurs comptait des
 * non-incidents — et un compteur d'erreurs qui compte des non-incidents cesse
 * d'être un signal. `405` avec l'en-tête `Allow` est la réponse juste : la
 * méthode n'est pas supportée sur ces points d'entrée, et on le dit dans le
 * vocabulaire HTTP au lieu d'un 400 accompagné d'une trace.
 *
 * L'émetteur de ces `HEAD` reste inconnu (scanner de liens, préchargement
 * navigateur, sonde) : `gleba.fr` n'a aucune directive `log` côté Caddy, donc
 * aucune trace de requête n'existe pour l'application.
 */
export function HEAD() {
  return new Response(null, {
    status: 405,
    headers: { Allow: "GET, POST" },
  })
}
