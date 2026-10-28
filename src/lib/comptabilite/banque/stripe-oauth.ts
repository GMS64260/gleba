import { estCompteDemo } from '@/lib/demo-garde'
import { createHash, randomBytes } from 'node:crypto'
import prisma from '@/lib/prisma'
import { ErreurReglement } from '../monnaie'
import { enregistrerConnexionStripe } from './stripe'
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
