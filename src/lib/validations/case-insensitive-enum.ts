/**
 * Helper Zod — enum résilient à la casse.
 *
 * DEV1 Ticket 1 (audit QA 2026-05-14) : l'UI envoyait `type: "Particulier"`
 * tandis que le schema Zod attendait `"particulier"` (lowercase). Au lieu
 * d'aligner les deux, on durcit le schema serveur : il accepte la valeur
 * quelle que soit sa casse et la normalise vers la valeur canonique de
 * l'enum.
 *
 * Usage :
 *   type: caseInsensitiveEnum(['particulier', 'professionnel', 'amap'])
 *
 *   // Inputs acceptés et leur normalisation :
 *   //   "particulier"   → "particulier"
 *   //   "Particulier"   → "particulier"
 *   //   "PROFESSIONNEL" → "professionnel"
 *   //   "Toto"          → error invalid_enum_value
 *
 * Particularité : la valeur canonique retournée est celle déclarée dans
 * `values` (n'importe quelle casse). Si l'enum est défini avec
 * `['Vente', 'Mort']`, l'output sera 'Vente' / 'Mort' (capitalisé) même
 * si l'input était 'vente' / 'MORT'.
 */

import { z } from "zod"

export function caseInsensitiveEnum<T extends string>(values: readonly T[]) {
  if (values.length === 0) {
    throw new Error("caseInsensitiveEnum: la liste de valeurs ne peut pas être vide")
  }
  // Pre-map lowercase → canonical pour O(1) lookup.
  const canonical = new Map(values.map((v) => [v.toLowerCase(), v]))

  return z.string().transform((input, ctx) => {
    const canon = canonical.get(input.toLowerCase())
    if (!canon) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Valeur invalide. Attendues : ${values.join(" | ")} (insensible à la casse)`,
      })
      return z.NEVER
    }
    return canon
  })
}
