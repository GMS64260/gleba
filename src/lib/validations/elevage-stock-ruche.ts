import { z } from "zod"
import { PRODUITS_RUCHE, UNITES_PRODUITS_RUCHE } from "@/lib/elevage/produits-ruche"

export const sortieStockRucheSchema = z.object({
  date: z.coerce.date().optional(),
  produit: z.enum(PRODUITS_RUCHE),
  quantite: z.number().positive("La quantité doit être positive").max(1_000_000),
  unite: z.enum(UNITES_PRODUITS_RUCHE),
  type: z.enum(["autoconsommation", "don", "destruction"]),
  notes: z.string().trim().max(5000).nullable().optional(),
})
