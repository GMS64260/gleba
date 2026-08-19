import webpush from "web-push"
import { APP_URL } from "./mail"
import prisma from "./prisma"
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
export function pushConfigure(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

/** Retourne la clé publique VAPID utilisable par le navigateur. */
export function getVapidPublicKey(): string | null {
  return pushConfigure() ? process.env.VAPID_PUBLIC_KEY! : null
}

/** Construit le payload commun aux alertes urgentes email et push. */
export function construirePayloadAlerteUrgente(alerte: AlerteUrgente): PushPayload {
  return {
    title: alerte.titre,
    body: alerte.message,
    url: `${APP_URL}${alerte.type === "stock-bas" ? "/comptabilite/stocks" : "/calendrier"}`,
    tag: alerte.key,
  }
}

/** Configure VAPID puis envoie un abonnement navigateur. */
export async function envoyerPushSubscription(
  subscription: PushSubscriptionInput,
  payload: PushPayload
): Promise<"ok" | "gone"> {
  if (!pushConfigure()) return "ok"

  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:contact@gleba.fr",
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    )
    await webpush.sendNotification(subscription, JSON.stringify(payload))
    return "ok"
  } catch (error: unknown) {
    const statusCode =
      typeof error === "object" && error !== null && "statusCode" in error
        ? (error as { statusCode?: unknown }).statusCode
        : undefined
    if (statusCode === 404 || statusCode === 410) return "gone"

    console.error("[notifications] Envoi push échoué:", error)
    return "ok"
  }
}

/** Envoie une notification à tous les navigateurs enregistrés d'un utilisateur. */
export async function envoyerPushUtilisateur(userId: string, payload: PushPayload): Promise<number> {
  if (!pushConfigure()) return 0

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

  const subscriptionsMortes = resultats.filter(({ resultat }) => resultat === "gone")
  if (subscriptionsMortes.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: subscriptionsMortes.map(({ id }) => id) } },
    })
  }

  return resultats.filter(({ resultat }) => resultat === "ok").length
}
