/**
 * Identité du compte de démonstration public (bouton « Essayer la démo »).
 *
 * Module volontairement pur (constante + prédicat, zéro import) : il est
 * importé par auth.ts, donc atteignable depuis le middleware — il doit
 * rester compatible Edge.
 */

export const DEMO_EMAIL = "demo@gleba.fr"

/** Vrai si cette adresse est celle du compte de démonstration partagé. */
export function estEmailDemo(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === DEMO_EMAIL
}
