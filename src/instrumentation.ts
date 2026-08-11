/**
 * Hameçon de démarrage serveur Next.js (instrumentation, stable depuis
 * Next 15). `register()` est appelé une fois à l'init du serveur Node —
 * c'est le point d'attache durable du cron de notifications : il survit
 * aux redémarrages (re-registré à chaque boot) et ne dépend d'aucune
 * requête entrante.
 *
 * Le module est importé dynamiquement et tout est encapsulé en try/catch :
 * un problème de scheduler ne doit jamais empêcher le serveur de démarrer.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  try {
    const { initNotifScheduler } = await import("@/lib/notifications/scheduler")
    initNotifScheduler()
  } catch (error) {
    console.error("[notifications] Échec d'initialisation du scheduler:", error)
  }
}
