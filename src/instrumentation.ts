/**
 * Instrumentation Next.js — démarre le journal global des erreurs serveur.
 *
 * register() patch console.error au boot du process Node (les routes API
 * logguent leurs erreurs attrapées par convention `console.error('... error:', err)`),
 * et onRequestError capte les erreurs NON attrapées (500 sans catch).
 * Voir src/lib/error-journal.ts pour les garde-fous.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { installErrorJournal } = await import('@/lib/error-journal')
    installErrorJournal()
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
