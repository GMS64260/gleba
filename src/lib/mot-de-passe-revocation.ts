/**
 * Ce qu'un nouveau mot de passe révoque, quel que soit le chemin qui le pose
 * (changement depuis Paramètres, lien « Mot de passe oublié », réglage par un
 * administrateur).
 *
 * SEC-01 (revue Codex du 2026-11-12) : un lien de réinitialisation émis avant
 * un changement de mot de passe restait valable et permettait d'écraser le
 * nouveau mot de passe. Le jeton d'API (MCP) suit la même règle depuis
 * l'audit 2026-07 (#20) : un mot de passe changé après un soupçon de fuite ne
 * doit laisser aucun accès dérivé de l'ancien.
 *
 * MC3 (revue globale du 2026-11-11) : la version de session augmente, ce qui
 * coupe toutes les sessions ouvertes avant (cf. `session-version.ts`). La
 * session qui change elle-même son mot de passe est réémise par sa route.
 */
export const REVOCATION_CHANGEMENT_MOT_DE_PASSE = {
  resetPasswordToken: null,
  resetPasswordExpires: null,
  apiToken: null,
  sessionVersion: { increment: 1 },
} as const
