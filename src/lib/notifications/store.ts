/**
 * Anti-redondance des notifications : store PERSISTANT des alertes déjà
 * envoyées (table `generic_cache`).
 *
 * Il était en mémoire, et ce choix était assumé : « au pire un redémarrage du
 * conteneur peut re-émettre une alerte du jour — acceptable ». Ce n'était pas
 * acceptable, et le 2026-08-20 l'a chiffré : la bascule de 14:07 a rejoué une
 * alerte 31 s après la mise en service, celle de 17:24 en a rejoué DEUX — le
 * compte grimpe à chaque activation d'alertes, et chaque déploiement de la
 * journée en produisait un lot. Un utilisateur qui reçoit deux fois le même
 * courriel n'apprend pas qu'on a redémarré un conteneur : il apprend que les
 * alertes de Gleba ne sont pas fiables, et il les coupe.
 *
 * Trois propriétés tenues ici.
 *
 * 1. **Correction indépendante de l'ordre d'appel.** `alerteDejaEnvoyee` lit la
 *    base quand la clé n'est pas déjà connue. `prechargerAlertesEnvoyees` n'est
 *    qu'une optimisation (une requête au lieu de N) : l'oublier ralentit un
 *    scan, ça ne fabrique pas de doublon. C'est le contraire d'un cache qu'il
 *    faudrait penser à hydrater.
 * 2. **Le cache mémoire ne garde que les entrées POSITIVES.** Mémoriser une
 *    absence permettrait à une écriture manquée de passer pour un « jamais
 *    envoyé » pendant tout le scan.
 * 3. **Une panne de base ne casse pas le scan.** La marque est posée en mémoire
 *    AVANT la base ; si l'écriture échoue, on journalise et on retombe sur
 *    l'ancien comportement (protégé jusqu'au prochain redémarrage) au lieu
 *    d'interrompre l'envoi.
 *
 * Les clés sont propres à (utilisateur, alerte) — le sender préfixe par l'id
 * utilisateur. Une entrée expire à la fin de son jour de validité (`until`), ou
 * après 7 jours sans date, ce qui permet de re-notifier une alerte qui revient
 * (le gel d'une autre nuit).
 */

import prisma from "@/lib/prisma"

/** Préfixe de clé dans `generic_cache`, pour ne pas croiser les autres caches. */
const PREFIXE = "notif:envoyee:"

const TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 jours

export interface EntreeAlerteEnvoyee {
  sentAt: number // epoch ms
  /** Date (YYYY-MM-DD) jusqu'à laquelle l'alerte reste « déjà notifiée ». */
  until?: string
}

/** Entrées POSITIVES connues (cf. propriété 2 de l'en-tête). */
const sentAlerts = new Map<string, EntreeAlerteEnvoyee>()

/** Date du jour locale (YYYY-MM-DD) pour les comparaisons d'expiration. */
function todayKey(): string {
  const now = new Date()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${m}-${d}`
}

/**
 * Instant d'expiration d'une entrée.
 *
 * Avec une date de validité, l'entrée court jusqu'à la FIN de ce jour local :
 * une alerte de gel pour le 21 doit rester bloquée toute la journée du 21, pas
 * jusqu'à son minuit initial. Sans date, on retombe sur le TTL.
 */
function expirationDepuisUntil(until: string | undefined, maintenant: Date): Date {
  if (!until) return new Date(maintenant.getTime() + TTL_MS)
  const [annee, mois, jour] = until.split("-").map(Number)
  if (!annee || !mois || !jour) return new Date(maintenant.getTime() + TTL_MS)
  return new Date(annee, mois - 1, jour, 23, 59, 59, 999)
}

/** L'entrée est-elle encore active aujourd'hui ? */
function encoreActive(entry: EntreeAlerteEnvoyee): boolean {
  return !(entry.until !== undefined && entry.until < todayKey())
}

/**
 * Charge en mémoire les alertes encore actives — UNE requête pour tout le scan.
 * Purement une optimisation : ne pas l'appeler ne change pas le résultat.
 */
export async function prechargerAlertesEnvoyees(): Promise<number> {
  try {
    const lignes = await prisma.genericCache.findMany({
      where: { key: { startsWith: PREFIXE }, expiresAt: { gt: new Date() } },
      select: { key: true, data: true },
    })
    for (const ligne of lignes) {
      const entry = ligne.data as unknown as EntreeAlerteEnvoyee
      if (entry && encoreActive(entry)) {
        sentAlerts.set(ligne.key.slice(PREFIXE.length), entry)
      }
    }
    return lignes.length
  } catch (error) {
    // Le scan continue : `alerteDejaEnvoyee` interrogera la base clé par clé.
    console.warn("[notifications] Préchargement de l'anti-redondance indisponible:", error)
    return 0
  }
}

/**
 * L'alerte (clé `key`) a-t-elle déjà été notifiée et est-elle encore active ?
 *
 * Lit la base quand la clé n'est pas connue en mémoire. Une entrée expirée est
 * supprimée au passage : la purge n'a pas besoin d'être ponctuelle pour que la
 * réponse soit juste.
 */
export async function alerteDejaEnvoyee(key: string): Promise<boolean> {
  const memoire = sentAlerts.get(key)
  if (memoire) {
    if (encoreActive(memoire)) return true
    sentAlerts.delete(key)
    await oublier(key)
    return false
  }

  const ligne = await prisma.genericCache.findUnique({
    where: { key: PREFIXE + key },
    select: { data: true, expiresAt: true },
  })
  if (!ligne) return false

  const entry = ligne.data as unknown as EntreeAlerteEnvoyee
  if (ligne.expiresAt <= new Date() || !entry || !encoreActive(entry)) {
    await oublier(key)
    return false
  }
  sentAlerts.set(key, entry)
  return true
}

/**
 * Marque une alerte comme envoyée, avec sa date de validité éventuelle.
 *
 * La mémoire d'abord : même si la base refuse l'écriture, le scan en cours ne
 * doublonnera pas.
 */
export async function marquerAlerteEnvoyee(
  key: string,
  options: { until?: string } = {}
): Promise<void> {
  const maintenant = new Date()
  const entry: EntreeAlerteEnvoyee = { sentAt: maintenant.getTime(), until: options.until }
  sentAlerts.set(key, entry)
  try {
    const expiresAt = expirationDepuisUntil(options.until, maintenant)
    await prisma.genericCache.upsert({
      where: { key: PREFIXE + key },
      create: { key: PREFIXE + key, data: entry as unknown as object, expiresAt },
      update: { data: entry as unknown as object, expiresAt },
    })
  } catch (error) {
    // Dégradation contrôlée : on retombe sur l'ancien comportement (protégé
    // jusqu'au prochain redémarrage) plutôt que d'interrompre les envois.
    console.warn(`[notifications] Anti-redondance non persistée pour ${key}:`, error)
  }
}

/** Retire une entrée, mémoire et base. */
async function oublier(key: string): Promise<void> {
  sentAlerts.delete(key)
  try {
    await prisma.genericCache.deleteMany({ where: { key: PREFIXE + key } })
  } catch {
    // Sans conséquence : l'entrée est expirée, elle ne bloque plus rien.
  }
}

/** Purge les entrées expirées ou trop anciennes (appelé à chaque scan). */
export async function nettoyerAlertesEnvoyees(): Promise<number> {
  const today = todayKey()
  const maintenant = Date.now()
  for (const [key, entry] of sentAlerts) {
    const expiree = entry.until !== undefined && entry.until < today
    const tropVieille = maintenant - entry.sentAt > TTL_MS
    if (expiree || tropVieille) sentAlerts.delete(key)
  }
  try {
    const { count } = await prisma.genericCache.deleteMany({
      where: { key: { startsWith: PREFIXE }, expiresAt: { lt: new Date() } },
    })
    return count
  } catch (error) {
    console.warn("[notifications] Purge de l'anti-redondance impossible:", error)
    return 0
  }
}

/** Nombre d'entrées actuellement en mémoire (diagnostic / tests). */
export function nombreAlertesMemorisees(): number {
  return sentAlerts.size
}

/** Vide le cache mémoire — réservé aux tests. */
export function resetStorePourTests(): void {
  sentAlerts.clear()
}
