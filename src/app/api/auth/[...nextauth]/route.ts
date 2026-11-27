/**
 * Routes NextAuth.js
 */

import type { NextRequest } from "next/server"
import { handlers } from "@/lib/auth"
import { sansCookieSessionRecopie } from "@/lib/session-cookie-recopie"

export const { POST } = handlers

/**
 * La lecture de la session par le navigateur (`GET /api/auth/session`, au
 * montage et au retour sur l'onglet) recopie le jeton reçu : partie avant un
 * changement de mot de passe, elle remplaçait le cookie réémis (équipe debug,
 * D198). Connexion, retour du fournisseur et déconnexion posent leur cookie
 * normalement. Attention : `POST /api/auth/session` (la fonction `update()`,
 * que l'application n'appelle nulle part) recopie lui aussi le jeton reçu sans
 * être filtré ; qui l'introduirait ferait revenir ce défaut.
 */
export async function GET(requete: NextRequest) {
  const reponse = await handlers.GET(requete)
  return new URL(requete.url).pathname.endsWith("/session") ? sansCookieSessionRecopie(requete, reponse) : reponse
}

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
