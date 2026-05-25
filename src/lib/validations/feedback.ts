import { z } from "zod"

export const feedbackSchema = z.object({
  type: z.enum(["bug", "evolution", "autre"]),
  message: z
    .string()
    .min(10, "Le message doit contenir au moins 10 caractères")
    .max(2000, "Le message ne peut pas dépasser 2000 caractères"),
  url: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional(),
  viewport: z.string().max(20).optional(),
})

export type FeedbackInput = z.infer<typeof feedbackSchema>
