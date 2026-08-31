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

import { sendMail, SmtpNonConfigureError } from '@/lib/mail'
import {
  PHRASE_ECHEC_ENVOI,
  relanceUtile,
  type CauseEchecEnvoi,
  type ResultatEnvoiVerification,
} from '@/lib/mail-verification-messages'

// Le vocabulaire et ses phrases vivent dans un module PUR : ce fichier-ci
// importe `nodemailer` par `mail.ts`, et un composant client qui aurait besoin
// des phrases tirerait tout le transport SMTP dans son bundle.
export { PHRASE_ECHEC_ENVOI, relanceUtile }
export type { CauseEchecEnvoi, ResultatEnvoiVerification }

/** Délai au-delà duquel on n'attend plus le serveur SMTP (l'inscrit patiente). */
const TIMEOUT_ENVOI_MS = 8000

/**
 * Un refus définitif du destinataire (5xx SMTP) n'appelle pas la même consigne
 * qu'une panne d'acheminement : dans le premier cas, c'est l'adresse qu'il faut
 * corriger, dans le second il suffit de réessayer.
 *
 * Troisième cas depuis l'issue #32 : l'instance n'a PAS de serveur SMTP. Ce
 * n'est ni l'adresse ni le réseau, c'est la configuration de l'hébergeur — et
 * réessayer n'y changera rien. Le distinguer est ce qui permet à l'écran de
 * dire « demandez l'activation à l'administrateur » au lieu de « réessayez ».
 */
export function qualifierEchecEnvoi(erreur: unknown): CauseEchecEnvoi {
  if (erreur instanceof SmtpNonConfigureError) return 'smtp_absent'
  if ((erreur as { code?: string })?.code === 'SMTP_NON_CONFIGURE') return 'smtp_absent'
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
