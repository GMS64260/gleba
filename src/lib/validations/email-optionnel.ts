import { z } from 'zod'

/**
 * E-mail facultatif d'une fiche (client, fournisseur).
 *
 * Ticket cmv28y78w (QA 2026-10-10) — les formulaires envoient `email: ""`
 * quand le champ est laissé vide ; `z.string().email()` refusait cette chaîne
 * (« email: Email invalide ») alors que seul le nom est obligatoire. Une
 * chaîne vide ou blanche vaut absence d'e-mail (`null`, ce qui vide aussi le
 * champ à la modification) ; une adresse saisie est rognée puis validée.
 */
export const emailOptionnel = () =>
  z
    .preprocess(
      (v) => (typeof v === 'string' ? v.trim() || null : v),
      z.string().email('Email invalide').max(200).nullable(),
    )
    .optional()
