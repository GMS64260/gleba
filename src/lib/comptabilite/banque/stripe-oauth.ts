import { estCompteDemo } from '@/lib/demo-garde'
import { createHash, randomBytes } from 'node:crypto'
import prisma from '@/lib/prisma'
import { ErreurReglement } from '../monnaie'
import { CLEFS, dechiffrerJeton, enregistrerConnexionStripe } from './stripe'
function origine() {
  const url = new URL(process.env.NEXTAUTH_URL || process.env.AUTH_URL || 'https://gleba.fr')
  if (
    url.protocol !== 'https:' &&
    !(process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname))
  )
    throw new ErreurReglement('L’URL publique HTTPS de Gleba doit être configurée.', 503)
  return url.origin
}
const empreinte = (s: string) => createHash('sha256').update(s).digest('hex')
export async function preparerConnexionStripe(userId: string, acteurId: string) {
  if (await estCompteDemo(userId))
    throw new ErreurReglement(
      'Créez votre propre compte pour connecter Stripe ; la démonstration est partagée.',
      403,
    )
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID
  if (!clientId || !/^ca_[A-Za-z0-9]+$/.test(clientId) || !process.env.STRIPE_SECRET_KEY)
    throw new ErreurReglement(
      'Stripe Connect n’est pas configuré. Vous pouvez aussi utiliser une clé restreinte de lecture.',
      503,
    )
  const etat = randomBytes(32).toString('base64url')
  await prisma.etatConnexionStripe.deleteMany({ where: { userId, expireLe: { lt: new Date() } } })
  await prisma.etatConnexionStripe.create({
    data: { userId, acteurId, empreinte: empreinte(etat), expireLe: new Date(Date.now() + 600000) },
  })
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: 'read_write',
    redirect_uri: origine() + '/api/comptabilite/banque/stripe/retour',
    state: etat,
  })
  return { url: 'https://connect.stripe.com/oauth/authorize?' + query }
}
export async function terminerConnexionStripe(
  userId: string,
  acteurId: string,
  etat: string,
  code: string,
) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(etat) || !/^ac_[A-Za-z0-9_]{5,500}$/.test(code))
    throw new ErreurReglement('Retour Stripe invalide.', 400)
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) throw new ErreurReglement('Stripe Connect n’est pas configuré.', 503)
  const claim = await prisma.etatConnexionStripe.updateMany({
    where: {
      userId,
      acteurId,
      empreinte: empreinte(etat),
      utiliseLe: null,
      expireLe: { gt: new Date() },
    },
    data: { utiliseLe: new Date() },
  })
  if (claim.count !== 1)
    throw new ErreurReglement(
      'Cette connexion a expiré ou a déjà été utilisée. Relancez la connexion.',
    )
  let response: Response
  try {
    response = await fetch('https://connect.stripe.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_secret: secret, grant_type: 'authorization_code', code }),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    })
  } catch {
    throw new ErreurReglement('Stripe est momentanément injoignable. Relancez la connexion.', 502)
  }
  if (!response.ok)
    throw new ErreurReglement('Stripe n’a pas autorisé la connexion. Relancez-la.', 502)
  const donnees: unknown = await response.json()
  if (!donnees || typeof donnees !== 'object')
    throw new ErreurReglement('Réponse Stripe invalide.', 502)
  const d = donnees as Record<string, unknown>
  if (
    typeof d.access_token !== 'string' ||
    typeof d.livemode !== 'boolean' ||
    typeof d.stripe_user_id !== 'string'
  )
    throw new ErreurReglement('Réponse Stripe incomplète.', 502)
  // L'identité est vérifiée par GET /account avec le jeton réellement délivré.
  return enregistrerConnexionStripe(userId, d.access_token, !d.livemode)
}
export function retourBanqueStripe(resultat: 'connecte' | 'echec') {
  return origine() + '/comptabilite/banque?connexion=' + resultat
}

/**
 * Révoque chez Stripe l'autorisation OAuth `read_write` donnée à la plateforme
 * (revue du 2026-10-29 : la déconnexion effaçait seulement le jeton local).
 * Renvoie `false` si Stripe ne confirme pas la révocation.
 */
export async function revoquerAutorisationStripe(compteStripeId: string) {
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID,
    secret = process.env.STRIPE_SECRET_KEY
  if (!clientId || !secret || !/^acct_[A-Za-z0-9]+$/.test(compteStripeId)) return false
  try {
    const response = await fetch('https://connect.stripe.com/oauth/deauthorize', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + secret,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ client_id: clientId, stripe_user_id: compteStripeId }),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) {
      console.warn(`[banque] Révocation Stripe refusée (HTTP ${response.status}).`)
      return false
    }
    const donnees: unknown = await response.json()
    return Boolean(
      donnees &&
        typeof donnees === 'object' &&
        (donnees as Record<string, unknown>).stripe_user_id === compteStripeId,
    )
  } catch {
    console.warn('[banque] Révocation Stripe injoignable.')
    return false
  }
}

/**
 * Déconnexion par le propriétaire : l'accès local est toujours retiré (jeton
 * effacé, historique conservé). Une connexion OAuth est aussi révoquée chez
 * Stripe ; un échec n'empêche pas la déconnexion mais revient en avertissement.
 * Une clé restreinte appartient au compte Stripe : Gleba ne peut pas la
 * supprimer, le message invite à la révoquer dans le tableau de bord.
 */
export async function deconnecterStripe(userId: string, connexionId: string) {
  const connexion = await prisma.connexionStripe.findFirst({
    where: { id: connexionId, userId },
    select: { compteStripeId: true, jetonChiffre: true },
  })
  const refus = 'Connexion introuvable ou synchronisation en cours. Réessayez après sa fin.'
  if (!connexion) throw new ErreurReglement(refus)
  let nature: 'cle' | 'oauth' | 'inconnue' = 'inconnue'
  if (connexion.jetonChiffre) {
    try {
      nature = CLEFS.test(dechiffrerJeton(connexion.jetonChiffre)) ? 'cle' : 'oauth'
    } catch {
      // Jeton illisible : la nature de l'accès n'est plus connue.
    }
  }
  const resultat = await prisma.connexionStripe.updateMany({
    where: {
      id: connexionId,
      userId,
      OR: [{ verrouSynchroJusqua: null }, { verrouSynchroJusqua: { lt: new Date() } }],
    },
    data: { actif: false, jetonChiffre: '' },
  })
  if (!resultat.count) throw new ErreurReglement(refus)
  if (nature === 'cle')
    return {
      message:
        'Accès retiré de Gleba, historique conservé. Révoquez aussi la clé restreinte dans votre tableau de bord Stripe (Développeurs, Clés API) : Gleba ne peut pas la supprimer.',
    }
  if (await revoquerAutorisationStripe(connexion.compteStripeId))
    return { message: 'Accès Stripe révoqué et retiré de Gleba, historique conservé.' }
  return {
    message: 'Accès retiré de Gleba, historique conservé.',
    avertissement:
      nature === 'oauth'
        ? 'Stripe n’a pas confirmé la révocation de l’accès. Retirez Gleba des applications autorisées dans votre tableau de bord Stripe.'
        : 'Stripe n’a pas confirmé de révocation. Retirez l’accès de Gleba dans votre tableau de bord Stripe : application autorisée ou clé restreinte.',
  }
}
