/**
 * Motifs de refus de connexion, et le seul canal qui les transporte.
 *
 * Le serveur écrivait quatre messages de refus soignés et distincts, dont
 * aucun n'atteignait l'utilisateur : Auth.js v5 enveloppe toute erreur levée
 * dans `authorize` et ne rend au client qu'un code. Vérifié le 2026-08-26 en
 * interrogeant le point d'entrée réel — `POST /api/auth/callback/credentials`
 * redirigeait vers `?error=Configuration`, et le formulaire affichait donc le
 * mot « Configuration » dans sa boîte rouge. Vingt-quatre refus pour adresse
 * non vérifiée, dont cinq dans les cinq minutes suivant l'inscription, et
 * cinquante et un pour mot de passe erroné ont été traités ainsi.
 *
 * `CredentialsSignin.code` est la propriété qu'Auth.js propage jusqu'au
 * client : c'est le seul canal disponible, et il impose un vocabulaire fermé
 * plutôt qu'un texte libre. Le texte, lui, vit côté formulaire.
 *
 * Ce code VOYAGE DANS L'URL. Deux conséquences tenues ici :
 *   - « adresse inconnue » et « mot de passe faux » partagent volontairement
 *     le même code, comme le faisaient déjà les deux messages du serveur :
 *     les distinguer transformerait le formulaire en oracle d'existence ;
 *   - les trois autres motifs révèlent qu'un compte existe. C'est assumé —
 *     l'inscription le révèle déjà — et c'est le prix d'un message utile.
 */

export const REFUS_CONNEXION = {
  /** Adresse inconnue OU mot de passe erroné. Jamais distingués. */
  IDENTIFIANTS: "identifiants",
  CHAMPS_MANQUANTS: "champs_manquants",
  EMAIL_NON_VERIFIE: "email_non_verifie",
  COMPTE_DESACTIVE: "compte_desactive",
  COMPTE_GOOGLE: "compte_google",
} as const

export type CodeRefusConnexion =
  (typeof REFUS_CONNEXION)[keyof typeof REFUS_CONNEXION]

/**
 * Le texte montré pour chaque motif. Un code inconnu retombe sur une phrase
 * neutre : c'est l'invariant qui empêche le défaut d'origine de revenir, où le
 * formulaire affichait le code brut « Configuration » à l'utilisateur.
 */
const MESSAGES: Record<CodeRefusConnexion, string> = {
  [REFUS_CONNEXION.IDENTIFIANTS]: "Adresse email ou mot de passe incorrect.",
  [REFUS_CONNEXION.CHAMPS_MANQUANTS]:
    "Renseignez votre adresse email et votre mot de passe.",
  [REFUS_CONNEXION.EMAIL_NON_VERIFIE]:
    "Votre adresse n'est pas encore vérifiée. Ouvrez le message que nous vous avons envoyé et cliquez sur le lien, puis revenez vous connecter.",
  [REFUS_CONNEXION.COMPTE_DESACTIVE]:
    "Ce compte a été désactivé. Écrivez à contact@gleba.fr.",
  [REFUS_CONNEXION.COMPTE_GOOGLE]:
    "Ce compte utilise la connexion Google. Cliquez sur « Continuer avec Google », ou créez un mot de passe via « Mot de passe oublié ».",
}

export const REFUS_MESSAGE_PAR_DEFAUT =
  "La connexion a échoué. Réessayez dans un instant."

/** Traduit un code de refus. Tolère `undefined` et tout code inattendu. */
export function messageRefusConnexion(code: string | null | undefined): string {
  if (!code) return REFUS_MESSAGE_PAR_DEFAUT
  return MESSAGES[code as CodeRefusConnexion] ?? REFUS_MESSAGE_PAR_DEFAUT
}
