import cron from 'node-cron'
import prisma from '@/lib/prisma'
import { synchroniserStripe } from './stripe'

let initialise = false
let enCours = false
let dernierId = ''

/** Une connexion par cycle, sans parallélisme ni rapprochement automatique. */
export async function synchroniserProchaineConnexion() {
  if (enCours) return
  enCours = true
  try {
    const maintenant = new Date()
    const where = {
      actif: true,
      AND: [
        { OR: [{ verrouSynchroJusqua: null }, { verrouSynchroJusqua: { lt: maintenant } }] },
        {
          OR: [
            { derniereSynchro: null },
            { derniereSynchro: { lt: new Date(maintenant.getTime() - 15 * 60_000) } },
            { historiqueComplet: false },
            { curseurNouveaux: { not: null } },
          ],
        },
      ],
    }
    const selection = { id: true, userId: true } as const
    const connexion =
      (await prisma.connexionStripe.findFirst({
        where: { ...where, id: { gt: dernierId } },
        orderBy: { id: 'asc' },
        select: selection,
      })) ??
      (await prisma.connexionStripe.findFirst({ where, orderBy: { id: 'asc' }, select: selection }))
    if (!connexion) return
    dernierId = connexion.id
    await synchroniserStripe(connexion.userId, connexion.id)
  } catch {
    // Aucune charge bancaire, identité ou réponse du fournisseur dans les logs.
    console.warn('[banque] Synchronisation Stripe différée ; réessai au prochain cycle.')
  } finally {
    enCours = false
  }
}

export function initBanqueScheduler() {
  if (
    initialise ||
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.STRIPE_SYNC_ENABLED === 'false'
  )
    return
  initialise = true
  cron.schedule('* * * * *', () => {
    void synchroniserProchaineConnexion()
  })
}
