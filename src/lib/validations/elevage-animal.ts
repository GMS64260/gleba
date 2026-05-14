import { z } from 'zod'
import { isValidIdentifiant, TYPES_IDENTIFIANT, type TypeIdentifiant } from '@/lib/identification-animal'
import { caseInsensitiveEnum } from './case-insensitive-enum'

export const animalSchema = z
  .object({
    especeAnimaleId: z.string().min(1, 'Espèce animale requise'),
    lotId: z.number().int().nullable().optional(),
    identifiant: z.string().max(100).nullable().optional(),
    // PROMPT 19A — type d'identifiant pour validation regex
    typeIdentifiant: z.enum(TYPES_IDENTIFIANT).nullable().optional(),
    nom: z.string().max(100).nullable().optional(),
    race: z.string().max(100).nullable().optional(),
    sexe: z.string().max(20).nullable().optional(),
    dateNaissance: z.coerce.date().nullable().optional(),
    dateArrivee: z.coerce.date().optional(),
    provenance: z.string().max(200).nullable().optional(),
    // PROMPT 19A — exploitations origine/destination (registre élevage)
    nExploitationOrigine: z.string().max(50).nullable().optional(),
    nExploitationDestination: z.string().max(50).nullable().optional(),
    // DEV1 T1 — Résilient à la casse : 'vente', 'VENTE', 'Vente' → 'Vente'.
    motifSortie: caseInsensitiveEnum(['Vente', 'Mort', 'Abattage', 'Réforme', 'Don'] as const).nullable().optional(),
    statutSanitaire: z.array(z.string()).optional().default([]),
    prixAchat: z.number().min(0).nullable().optional(),
    statut: z.string().max(50).default('actif'),
    posX: z.number().nullable().optional(),
    posY: z.number().nullable().optional(),
    mereId: z.number().int().nullable().optional(),
    // PROMPT 18 — Père relié au cheptel (FK) + fallback texte si père externe
    pereId: z.number().int().nullable().optional(),
    pereIdentifiant: z.string().max(100).nullable().optional(),
    poidsActuel: z.number().min(0).nullable().optional(),
    couleur: z.string().max(50).nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
  })
  .refine(
    (d) => isValidIdentifiant(d.identifiant, (d.typeIdentifiant as TypeIdentifiant | null) ?? null),
    {
      message: "Identifiant invalide pour le type sélectionné",
      path: ['identifiant'],
    }
  )
