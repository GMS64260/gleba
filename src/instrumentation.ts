/**
 * Instrumentation Next.js — démarre le journal global des erreurs serveur
 * et le scheduler de notifications métier.
 *
 * register() patch console.error au boot du process Node (les routes API
 * logguent leurs erreurs attrapées par convention `console.error('... error:', err)`),
 * et onRequestError capte les erreurs NON attrapées (500 sans catch).
 * Voir src/lib/error-journal.ts pour les garde-fous.
 *
 * register() est aussi le point d'attache durable du cron de notifications :
 * il survit aux redémarrages (re-registré à chaque boot) et ne dépend d'aucune
 * requête entrante. Chaque brique est isolée en try/catch — ni le journal ni le
 * scheduler ne doivent empêcher le serveur de démarrer.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  try {
    const { installErrorJournal } = await import('@/lib/error-journal')
    installErrorJournal()
  } catch (error) {
    console.error("[instrumentation] Échec d'installation du journal d'erreurs:", error)
  }

  try {
    const { initNotifScheduler } = await import('@/lib/notifications/scheduler')
    initNotifScheduler()
  } catch (error) {
    console.error("[notifications] Échec d'initialisation du scheduler:", error)
  }
}

export async function onRequestError(
  err: unknown,
  request: { path?: string; method?: string },
) {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  try {
    const { recordUncaughtRequestError } = await import('@/lib/error-journal')
    await recordUncaughtRequestError(err, request)
  } catch {
    // Le journal est best-effort.
  }
}
