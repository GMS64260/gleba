import { z } from "zod"

/** Longueur maximale d'un message du salon, en caractères (après nettoyage). */
export const LONGUEUR_MAX_MESSAGE_SALON = 1000

/** Envoi d'un message dans le salon de la communauté */
export const messageSalonSchema = z.object({
  contenu: z
    .string()
    .trim()
    .min(1, "Le message est vide.")
    .max(
      LONGUEUR_MAX_MESSAGE_SALON,
      `Le message ne peut pas dépasser ${LONGUEUR_MAX_MESSAGE_SALON} caractères.`
    )
    // Au plus une ligne vide d'affilée : un message ne peut pas pousser le fil
    // hors de l'écran à coups de retours à la ligne.
    .transform((s) => s.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n")),
})

export type MessageSalonInput = z.infer<typeof messageSalonSchema>
