/**
 * Vocabulaire des échecs d'envoi de l'email de vérification — partie PURE,
 * partagée par le serveur et les formulaires.
 *
 * Ce module ne dépend de rien : c'est ce qui lui permet d'être importé par un
 * composant client. `mail-verification.ts`, lui, importe `mail.ts` donc
 * `nodemailer`, un module Node — l'y laisser faisait tirer nodemailer dans le
 * bundle navigateur de l'écran d'inscription et cassait le build.
 *
 * Même découpage que `lib/auth-refus.ts` pour les refus de connexion : un
 * vocabulaire fermé, ses phrases à côté, et une seule copie des deux.
 */

export type CauseEchecEnvoi = 'adresse_refusee' | 'smtp_absent' | 'envoi_impossible'

export type ResultatEnvoiVerification =
  | { envoye: true }
  | { envoye: false; cause: CauseEchecEnvoi }

/**
 * Ce que l'utilisateur doit lire pour chaque cause.
 *
 * Les deux surfaces (inscription et renvoi) disaient la même chose avec deux
 * littéraux différents, et il aurait fallu les modifier tous les deux pour
 * ajouter la cause `smtp_absent`.
 */
export const PHRASE_ECHEC_ENVOI: Record<CauseEchecEnvoi, string> = {
  adresse_refusee:
    "Le serveur de messagerie a refusé cette adresse. Vérifiez qu'elle est exacte, puis relancez l'envoi. Si l'adresse est fausse, créez un compte avec la bonne adresse.",
  smtp_absent:
    "Cette instance Gleba n'a pas de serveur d'envoi d'email configuré : aucun message de vérification ne peut partir. Demandez à l'administrateur de l'instance d'activer votre compte, ou de configurer SMTP.",
  envoi_impossible:
    "L'envoi a échoué pour une raison temporaire. Relancez-le dans un instant ; si le problème persiste, écrivez à contact@gleba.fr.",
}

/** Relancer n'a de sens que si l'envoi peut aboutir un jour. */
export function relanceUtile(cause: CauseEchecEnvoi): boolean {
  return cause !== 'smtp_absent'
}

/**
 * Vrai si la valeur reçue de l'API est une cause connue.
 *
 * `valeur in PHRASE_ECHEC_ENVOI` ne convient pas : `in` remonte la chaîne de
 * prototypes, donc `'constructor'` ou `'toString'` passaient pour des causes
 * valides et l'écran aurait affiché le contenu d'une propriété d'`Object`.
 */
export function estCauseConnue(valeur: unknown): valeur is CauseEchecEnvoi {
  return (
    typeof valeur === 'string' &&
    Object.prototype.hasOwnProperty.call(PHRASE_ECHEC_ENVOI, valeur)
  )
}
