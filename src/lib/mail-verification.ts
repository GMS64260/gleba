/**
 * Envoi de l'email de vérification, avec un verdict exploitable par l'écran.
 *
 * Signalement vigie1919cd84 (2026-08-17) : l'inscription envoyait cet email en
 * « fire and forget ». Un refus définitif du serveur SMTP (« 550 invalid DNS MX
 * or A/AAAA resource record » : domaine du destinataire inexistant) n'était que
 * journalisé, et l'écran affichait quand même « Vérifiez votre email ». Le
 * nouvel inscrit attendait un message qui ne partirait jamais, sans savoir que
 * son adresse était en cause.
 *
 * Deux surfaces l'utilisent — l'inscription et le renvoi — et doivent dire la
 * même chose.
 */

import { sendMail } from '@/lib/mail'

/** Délai au-delà duquel on n'attend plus le serveur SMTP (l'inscrit patiente). */
const TIMEOUT_ENVOI_MS = 8000

export type CauseEchecEnvoi = 'adresse_refusee' | 'envoi_impossible'

export type ResultatEnvoiVerification =
  | { envoye: true }
  | { envoye: false; cause: CauseEchecEnvoi }

/**
 * Un refus définitif du destinataire (5xx SMTP) n'appelle pas la même consigne
 * qu'une panne d'acheminement : dans le premier cas, c'est l'adresse qu'il faut
 * corriger, dans le second il suffit de réessayer.
 */
export function qualifierEchecEnvoi(erreur: unknown): CauseEchecEnvoi {
  const code = (erreur as { responseCode?: number })?.responseCode
  const texte = erreur instanceof Error ? erreur.message : String(erreur)
  const refusDefinitif =
    (typeof code === 'number' && code >= 500 && code < 600) ||
    /recipients? (were |was )?rejected|invalid DNS MX|mailbox unavailable/i.test(texte)
  return refusDefinitif ? 'adresse_refusee' : 'envoi_impossible'
}

export async function envoyerVerification(
  destinataire: string,
  verify: { subject: string; html: string },
): Promise<ResultatEnvoiVerification> {
  try {
    await Promise.race([
      sendMail({ to: destinataire, subject: verify.subject, html: verify.html }),
      new Promise((_, rejeter) =>
        setTimeout(() => rejeter(new Error('SMTP_TIMEOUT')), TIMEOUT_ENVOI_MS),
      ),
    ])
    return { envoye: true }
  } catch (erreur) {
    console.error('Erreur envoi email verification:', erreur)
    return { envoye: false, cause: qualifierEchecEnvoi(erreur) }
  }
}
