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
import { qualifierEchecEnvoi } from '@/lib/mail-envoi'
import {
  PHRASE_ECHEC_ENVOI,
  type CauseEchecEnvoi,
  type ResultatEnvoiVerification,
} from '@/lib/mail-verification-messages'

// Le vocabulaire et ses phrases vivent dans un module PUR : ce fichier-ci
// importe `nodemailer` par `mail.ts`, et un composant client qui aurait besoin
// des phrases tirerait tout le transport SMTP dans son bundle.
export { PHRASE_ECHEC_ENVOI }
export { qualifierEchecEnvoi } from '@/lib/mail-envoi'
export type { CauseEchecEnvoi, ResultatEnvoiVerification }

/** Délai au-delà duquel on n'attend plus le serveur SMTP (l'inscrit patiente). */
const TIMEOUT_ENVOI_MS = 8000

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
