import type { CauseEchecEnvoi } from '@/lib/mail-verification-messages'

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
  if ((erreur as { code?: string })?.code === 'SMTP_NON_CONFIGURE') return 'smtp_absent'
  const code = (erreur as { responseCode?: number })?.responseCode
  const texte = erreur instanceof Error ? erreur.message : String(erreur)
  const refusDefinitif =
    (typeof code === 'number' && code >= 500 && code < 600) ||
    /recipients? (were |was )?rejected|invalid DNS MX|mailbox unavailable/i.test(texte)
  return refusDefinitif ? 'adresse_refusee' : 'envoi_impossible'
}
