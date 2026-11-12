/**
 * Réseau des notifications push : quels endpoints sont acceptables, et
 * comment les joindre sans rester bloqué.
 *
 * Revue Codex du 2026-11-12 (SEC-05) :
 *   - l'abonnement acceptait tout endpoint commençant par « https:// »,
 *     boucle locale et réseau privé compris : le serveur ouvrait alors des
 *     connexions vers son propre réseau ;
 *   - `webpush.sendNotification` ne pose aucun délai par défaut : un endpoint
 *     qui accepte la connexion puis se tait tenait l'envoi, donc le scan des
 *     alertes, en attente sans fin.
 *
 * Un service push de navigateur (FCM, Mozilla, Apple, Microsoft) est un hôte
 * public joint en HTTPS sur le port 443. Tout le reste est refusé à
 * l'abonnement ET à l'envoi (les abonnements déjà enregistrés passent par la
 * même garde), y compris un nom de domaine qui se résoudrait vers une adresse
 * privée (`lookupPublic`).
 */

import dns from "node:dns"
import https from "node:https"
import net from "node:net"

/** Délai absolu d'un envoi : au-delà, la requête est détruite. */
export const DELAI_ENVOI_PUSH_MS = 10_000

const NON_PUBLIQUES = new net.BlockList()
for (const [adresse, prefixe] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) NON_PUBLIQUES.addSubnet(adresse, prefixe, "ipv4")
for (const [adresse, prefixe] of [
  // IPv4 projetée dans IPv6 (::ffff:a.b.c.d) : BlockList la juge avec les
  // règles IPv4 ci-dessus ; bloquer tout ::ffff:0:0/96 bloquerait aussi
  // toutes les adresses IPv4.
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["100::", 64],
  ["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8],
] as const) NON_PUBLIQUES.addSubnet(adresse, prefixe, "ipv6")

/** Vrai pour une adresse IP routable publiquement (ni locale, ni privée, ni réservée). */
export function estAdresseIpPublique(ip: string): boolean {
  const famille = net.isIP(ip)
  if (famille === 0) return false
  return !NON_PUBLIQUES.check(ip, famille === 4 ? "ipv4" : "ipv6")
}

const SUFFIXES_LOCAUX = [".localhost", ".local", ".internal", ".intranet", ".lan", ".home.arpa", ".localdomain"]

export type VerdictEndpoint = { ok: true; url: URL } | { ok: false; raison: string }

/** Un endpoint push acceptable : HTTPS, port 443, hôte public, sans identifiants. */
export function endpointPushValide(endpoint: string): VerdictEndpoint {
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return { ok: false, raison: "adresse invalide" }
  }
  if (url.protocol !== "https:") return { ok: false, raison: "HTTPS obligatoire" }
  if (url.username || url.password) return { ok: false, raison: "identifiants interdits dans l'adresse" }
  if (url.port && url.port !== "443") return { ok: false, raison: "port 443 seulement" }
  const hote = url.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "")
  if (net.isIP(hote)) {
    return estAdresseIpPublique(hote) ? { ok: true, url } : { ok: false, raison: "adresse IP non publique" }
  }
  if (!hote.includes(".") || hote === "localhost" || SUFFIXES_LOCAUX.some((s) => hote.endsWith(s))) {
    return { ok: false, raison: "nom d'hôte non public" }
  }
  return { ok: true, url }
}

/**
 * Résolution DNS qui refuse un nom pointant vers une adresse non publique
 * (rebinding, enregistrement interne). Utilisée par la requête d'envoi.
 */
export const lookupPublic = ((hostname: string, options: dns.LookupOptions, callback: (...args: unknown[]) => void) => {
  dns.lookup(hostname, { ...options, all: true }, (erreur, adresses) => {
    if (erreur) return callback(erreur)
    const liste = adresses as dns.LookupAddress[]
    if (liste.length === 0 || liste.some((a) => !estAdresseIpPublique(a.address))) {
      return callback(Object.assign(new Error(`Endpoint push refusé : ${hostname} ne résout pas vers une adresse publique`), { code: "EADDRNOTPUBLIC" }))
    }
    if (options.all) return callback(null, liste)
    return callback(null, liste[0].address, liste[0].family)
  })
}) as unknown as net.LookupFunction

export interface RequetePush {
  endpoint: string
  method: string
  headers: Record<string, string | number>
  body?: Buffer | null
}

/** Réponse non 2xx d'un service push (404 et 410 : abonnement mort). */
export class ErreurServicePush extends Error {
  constructor(readonly statusCode: number) {
    super(`Service push : réponse ${statusCode}`)
  }
}

/**
 * Envoie une requête préparée par `webpush.generateRequestDetails`, bornée par
 * un délai ABSOLU : à son terme la requête et sa socket sont détruites, même
 * si le serveur distant égrène encore des octets. Le délai d'inactivité de la
 * socket détruit plus tôt une connexion muette.
 */
export function posterNotificationPush(requete: RequetePush, delaiMs = DELAI_ENVOI_PUSH_MS): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = new URL(requete.endpoint)
    let termine = false
    const finir = (erreur: Error | null, statut?: number) => {
      if (termine) return
      termine = true
      clearTimeout(minuteur)
      if (erreur) reject(erreur)
      else resolve(statut!)
    }
    const req = https.request({
      hostname: url.hostname.replace(/^\[|\]$/g, ""),
      port: url.port || 443,
      path: `${url.pathname}${url.search}`,
      method: requete.method,
      headers: requete.headers,
      timeout: delaiMs,
      lookup: lookupPublic,
      agent: false,
    }, (res) => {
      res.resume()
      res.on("end", () => {
        const statut = res.statusCode ?? 0
        finir(statut >= 200 && statut <= 299 ? null : new ErreurServicePush(statut), statut)
      })
      res.on("error", (e) => finir(e))
    })
    const minuteur = setTimeout(() => {
      const erreur = new Error(`Service push muet au-delà de ${delaiMs} ms`)
      req.destroy(erreur)
      finir(erreur)
    }, delaiMs)
    req.on("timeout", () => req.destroy(new Error("Délai d'inactivité de la socket dépassé")))
    req.on("error", (e) => finir(e))
    req.end(requete.body ?? undefined)
  })
}
