/**
 * Schéma de modification partielle SANS les valeurs par défaut du schéma de création.
 *
 * Avec zod 4, `.partial()` garde les `.default()` : un champ absent du corps
 * ressort avec sa valeur par défaut, et une route qui étale les données l'écrit.
 * Revue Codex DATA-02 (2026-11-12) : corriger la seule note d'une variété bio la
 * rendait conventionnelle (`bio: false`), renommer une parcelle effaçait ses
 * ateliers (`couches: []`). Ici, un champ absent reste absent ; un champ envoyé
 * garde les contrôles de son schéma.
 */
import { z } from 'zod'

function sansDefaut(champ: z.ZodType): z.ZodType {
  if (champ instanceof z.ZodDefault || champ instanceof z.ZodPrefault) return sansDefaut(champ.unwrap() as z.ZodType)
  if (champ instanceof z.ZodOptional) return sansDefaut(champ.unwrap() as z.ZodType).optional()
  if (champ instanceof z.ZodNullable) return sansDefaut(champ.unwrap() as z.ZodType).nullable()
  return champ
}

/** Même type que `schema.partial()` : seule la valeur par défaut disparaît à l'exécution. */
export function partielSansDefauts<Forme extends z.ZodRawShape, Config extends z.core.$ZodObjectConfig>(
  schema: z.ZodObject<Forme, Config>
): z.ZodObject<{ [k in keyof Forme]: z.ZodOptional<Forme[k]> }, Config> {
  const forme: Record<string, z.ZodType> = {}
  for (const [cle, champ] of Object.entries(schema.shape)) forme[cle] = sansDefaut(champ as z.ZodType)
  return schema.extend(forme).partial() as unknown as z.ZodObject<{ [k in keyof Forme]: z.ZodOptional<Forme[k]> }, Config>
}
