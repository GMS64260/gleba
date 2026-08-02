/**
 * Journal global des erreurs serveur.
 *
 * Né du 2026-08-02 : un nouvel inscrit a enchaîné 10 erreurs 500 sur
 * PUT /api/cultures/[id] sans rien signaler ; la friction n'a été découverte
 * que par une lecture manuelle des logs docker — perdus au redéploiement
 * suivant. Les routes API suivent presque toutes la convention
 * `console.error('METHODE /api/... error:', err)` : plutôt que d'instrumenter
 * chaque catch, on patch console.error une seule fois (instrumentation.ts)
 * et on persiste les occurrences en base (table api_errors), où elles
 * survivent aux redéploiements et alimentent /admin/erreurs.
 *
 * Garde-fous : ré-entrance bloquée (un échec d'écriture qui se loggue ne doit
 * pas boucler), débit plafonné, purge opportuniste à 30 jours, et tout est
 * best-effort — le journal ne doit jamais casser la requête qu'il observe.
 */

import prisma from '@/lib/prisma'

const INSTALL_FLAG = Symbol.for('gleba.error-journal.installed')

const MAX_MESSAGE_CHARS = 4000
const MAX_WRITES_PER_MINUTE = 30
const RETENTION_DAYS = 30
const PURGE_EVERY_N_WRITES = 100
const ALERT_THROTTLE_MS = 6 * 60 * 60 * 1000 // au plus un email toutes les 6 h
const ALERT_CACHE_KEY = 'error-journal:last-alert'

let inFlight = 0
let windowStart = 0
let windowCount = 0
let writesSincePurge = 0

/** Détecte la convention `console.error('PUT /api/cultures/[id] error:', err)`. */
export function analyseConsoleArgs(
  args: unknown[],
): { route: string | null; message: string } | null {
  const first = typeof args[0] === 'string' ? args[0] : ''
  const erreur = args.find((a): a is Error => a instanceof Error)

  const routeMatch = first.match(/((?:GET|POST|PUT|PATCH|DELETE)\s+\/api\/[^\s:]+)/)
  const mentionneApi = first.includes('/api/') || /\berror\b/i.test(first)
  if (!routeMatch && !mentionneApi && !erreur) return null
  // Bruit hors périmètre : les logs prisma:error arrivent sans contexte de
  // route ni objet Error exploitable — déjà couverts quand la route les relaie.
  if (!routeMatch && !erreur && first.startsWith('prisma:')) return null

  const morceaux = args.map((a) => {
    if (typeof a === 'string') return a
    if (a instanceof Error) return `${a.name}: ${a.message}`
    try {
      return JSON.stringify(a)
    } catch {
      return String(a)
    }
  })
  return {
    route: routeMatch ? routeMatch[1] : null,
    message: morceaux.join(' ').slice(0, MAX_MESSAGE_CHARS),
  }
}

/** Plafond de débit en mémoire : au-delà, on laisse tomber (le stdout garde tout). */
export function rateLimitOk(now: number): boolean {
  if (now - windowStart > 60_000) {
    windowStart = now
    windowCount = 0
  }
  windowCount++
  return windowCount <= MAX_WRITES_PER_MINUTE
}

async function persist(source: 'console' | 'uncaught', route: string | null, message: string) {
  if (inFlight > 2) return
  if (!rateLimitOk(Date.now())) return
  inFlight++
  try {
    await prisma.apiError.create({ data: { source, route, message } })
    writesSincePurge++
    if (writesSincePurge >= PURGE_EVERY_N_WRITES) {
      writesSincePurge = 0
      const limite = new Date(Date.now() - RETENTION_DAYS * 86_400_000)
      await prisma.apiError.deleteMany({ where: { createdAt: { lt: limite } } })
    }
    await maybeSendAlert()
  } catch {
    // Best-effort : jamais de throw, et surtout pas de console.error ici.
  } finally {
    inFlight--
  }
}

/**
 * Alerte email throttlée vers ADMIN_EMAIL : au plus une toutes les 6 h, avec
 * le décompte des erreurs de la fenêtre par route. Le verrou vit dans
 * generic_cache pour survivre aux redémarrages et valoir pour toutes les
 * instances.
 */
async function maybeSendAlert() {
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail || !process.env.SMTP_HOST) return

  const cache = await prisma.genericCache.findUnique({ where: { key: ALERT_CACHE_KEY } })
  const now = Date.now()
  if (cache && new Date(cache.expiresAt).getTime() > now) return

  // Pose le verrou AVANT l'envoi : un échec SMTP ne doit pas déclencher une
  // rafale de tentatives à chaque nouvelle erreur.
  await prisma.genericCache.upsert({
    where: { key: ALERT_CACHE_KEY },
    create: {
      key: ALERT_CACHE_KEY,
      data: { sentAt: new Date(now).toISOString() },
      expiresAt: new Date(now + ALERT_THROTTLE_MS),
    },
    update: {
      data: { sentAt: new Date(now).toISOString() },
      expiresAt: new Date(now + ALERT_THROTTLE_MS),
    },
  })

  const depuis = new Date(now - ALERT_THROTTLE_MS)
  const parRoute = await prisma.apiError.groupBy({
    by: ['route'],
    where: { createdAt: { gte: depuis } },
    _count: { _all: true },
    orderBy: { _count: { id: 'desc' } },
    take: 8,
  })
  const total = parRoute.reduce((somme, r) => somme + r._count._all, 0)
  const lignes = parRoute
    .map((r) => `<li><code>${r.route ?? 'sans route identifiée'}</code> — ${r._count._all}</li>`)
    .join('')

  const { sendMail } = await import('@/lib/mail')
  await sendMail({
    to: adminEmail,
    subject: `[Gleba] ${total} erreur(s) serveur sur les 6 dernières heures`,
    html: [
      `<p>Des erreurs serveur ont été journalisées (fenêtre de 6 h) :</p>`,
      `<ul>${lignes}</ul>`,
      `<p>Détail : <a href="https://gleba.fr/admin/erreurs">gleba.fr/admin/erreurs</a>.</p>`,
      `<p>Prochaine alerte au plus tôt dans 6 h ; le journal continue d'enregistrer entre-temps.</p>`,
    ].join('\n'),
  })
}

/** Patch console.error (une seule fois par process). Appelé par instrumentation.ts. */
export function installErrorJournal() {
  const g = globalThis as Record<symbol, unknown>
  if (g[INSTALL_FLAG]) return
  g[INSTALL_FLAG] = true

  const original = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    original(...args)
    try {
      if (inFlight > 0) return // ré-entrance : une écriture en cours qui loggue
      const analyse = analyseConsoleArgs(args)
      if (analyse) void persist('console', analyse.route, analyse.message)
    } catch {
      // Le journal ne doit jamais perturber le flux d'origine.
    }
  }
}

/** Erreurs non attrapées des routes/pages, relayées par onRequestError. */
export async function recordUncaughtRequestError(
  err: unknown,
  request: { path?: string; method?: string },
) {
  const route = [request.method, request.path].filter(Boolean).join(' ') || null
  const message =
    err instanceof Error
      ? `${err.name}: ${err.message}`
      : typeof err === 'string'
        ? err
        : JSON.stringify(err)
  await persist('uncaught', route, (message || 'Erreur inconnue').slice(0, MAX_MESSAGE_CHARS))
}
