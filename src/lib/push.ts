import webpush from "web-push"
import { APP_URL } from "./mail"
import { CHEMIN_TACHES } from "./notifications/templates"
import prisma from "./prisma"
import { DELAI_ENVOI_PUSH_MS, endpointPushValide, ErreurServicePush, posterNotificationPush } from "./push-reseau"
import type { AlerteUrgente } from "./notifications/types"

export interface PushPayload {
  title: string
  body: string
  url: string
  tag: string
}

export interface PushSubscriptionInput {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

/** Indique si les deux clés VAPID nécessaires aux envois sont configurées. */
export async function pushConfigure(): Promise<boolean> {
  const { getSetting } = await import("@/lib/settings")
  const [publicKey, privateKey] = await Promise.all([
    getSetting("vapid.publicKey"),
    getSetting("vapid.privateKey"),
  ])
  return Boolean(publicKey && privateKey)
}

/** Retourne la clé publique VAPID utilisable par le navigateur. */
export async function getVapidPublicKey(): Promise<string | null> {
  const { getSetting } = await import("@/lib/settings")
  const [publicKey, privateKey] = await Promise.all([
    getSetting("vapid.publicKey"),
    getSetting("vapid.privateKey"),
  ])
  return publicKey && privateKey ? publicKey : null
}

/** Génère une nouvelle paire de clés VAPID. */
export function genererClesVapid(): { publicKey: string; privateKey: string } {
  return webpush.generateVAPIDKeys()
}

/** Construit le payload commun aux alertes urgentes email et push. */
export function construirePayloadAlerteUrgente(alerte: AlerteUrgente): PushPayload {
  return {
    title: alerte.titre,
    body: alerte.message,
    url: `${APP_URL}${alerte.type === "stock-bas" ? "/comptabilite/stocks" : CHEMIN_TACHES}`,
    tag: alerte.key,
  }
}

/**
 * Issue d'un envoi : « ok » seulement si le service push a accepté le message.
 * Revue Codex du 2026-11-12 (SEC-05) : une erreur réseau, un 5xx ou un délai
 * dépassé renvoyaient aussi « ok » et étaient comptés comme livrés.
 *   - gone : abonnement mort (404/410), à supprimer ;
 *   - refuse : endpoint non public, jamais contacté ;
 *   - echec : erreur réseau, délai dépassé ou réponse inattendue ;
 *   - non_configure : clés VAPID absentes, rien n'est envoyé.
 */
export type ResultatEnvoiPush = "ok" | "gone" | "refuse" | "echec" | "non_configure"

/**
 * Envoie un message chiffré à un abonnement navigateur, dans un délai ABSOLU
 * (`DELAI_ENVOI_PUSH_MS`) au terme duquel la requête est détruite : un
 * service push muet ne peut plus tenir le scan des alertes en attente.
 * Ne lève jamais.
 */
export async function envoyerPushSubscription(
  subscription: PushSubscriptionInput,
  payload: PushPayload,
  options: { delaiMs?: number } = {}
): Promise<ResultatEnvoiPush> {
  const { getSetting } = await import("@/lib/settings")
  const [publicKey, privateKey, subject] = await Promise.all([
    getSetting("vapid.publicKey"),
    getSetting("vapid.privateKey"),
    getSetting("vapid.subject"),
  ])
  if (!publicKey || !privateKey) return "non_configure"

  const verdict = endpointPushValide(subscription.endpoint)
  if (!verdict.ok) {
    console.warn(`[notifications] Endpoint push refusé (${verdict.raison})`)
    return "refuse"
  }

  try {
    const requete = webpush.generateRequestDetails(subscription, JSON.stringify(payload), {
      vapidDetails: { subject, publicKey, privateKey },
    })
    await posterNotificationPush(requete as Parameters<typeof posterNotificationPush>[0], options.delaiMs ?? DELAI_ENVOI_PUSH_MS)
    return "ok"
  } catch (error: unknown) {
    const statusCode = error instanceof ErreurServicePush
      ? error.statusCode
      : typeof error === "object" && error !== null && "statusCode" in error
        ? (error as { statusCode?: unknown }).statusCode
        : undefined
    if (statusCode === 404 || statusCode === 410) return "gone"

    console.error("[notifications] Envoi push échoué:", error instanceof Error ? error.message : error)
    return "echec"
  }
}

/**
 * Envoie une notification à tous les navigateurs enregistrés d'un utilisateur,
 * en parallèle : chaque abonnement est borné par son propre délai, un échec
 * n'affecte pas les autres. Retourne le nombre d'envois réellement acceptés.
 */
export async function envoyerPushUtilisateur(userId: string, payload: PushPayload): Promise<number> {
  if (!(await pushConfigure())) return 0

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  })
  const resultats = await Promise.all(
    subscriptions.map(async (subscription) => ({
      id: subscription.id,
      resultat: await envoyerPushSubscription(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload
      ),
    }))
  )

  // Mort (404/410) ou endpoint non public enregistré avant la garde du
  // 2026-11-12 : ni l'un ni l'autre ne sera jamais livrable.
  const subscriptionsMortes = resultats.filter(({ resultat }) => resultat === "gone" || resultat === "refuse")
  if (subscriptionsMortes.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: subscriptionsMortes.map(({ id }) => id) } },
    })
  }

  return resultats.filter(({ resultat }) => resultat === "ok").length
}
