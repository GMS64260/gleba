import { z } from "zod"

export const feedbackSchema = z.object({
  type: z.enum(["bug", "evolution", "autre"]),
  message: z
    .string()
    .min(10, "Le message doit contenir au moins 10 caractères")
    .max(2000, "Le message ne peut pas dépasser 2000 caractères"),
})

export type FeedbackInput = z.infer<typeof feedbackSchema>
