import { z } from "zod"
import { PRODUITS_RUCHE, UNITES_PRODUITS_RUCHE } from "@/lib/elevage/produits-ruche"

export const productionRucheSchema = z.object({
  date: z.coerce.date().optional(),
  produit: z.enum(PRODUITS_RUCHE),
  quantite: z.number().positive("La quantité doit être positive").max(1_000_000),
  unite: z.enum(UNITES_PRODUITS_RUCHE),
  lotId: z.number().int().positive().nullable().optional(),
  // QA cmsbtlka1 — rattachement à une ruche gérée en animal individuel.
  animalId: z.number().int().positive().nullable().optional(),
  numeroLot: z.string().trim().max(100).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
}).refine(
  (d) => d.lotId == null || d.animalId == null,
  { message: "Renseignez une ruche OU un lot apicole, pas les deux.", path: ["animalId"] },
)
