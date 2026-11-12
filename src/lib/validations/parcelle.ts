/**
 * Schemas de validation Zod pour les Parcelles
 */

import { z } from 'zod'
import { partielSansDefauts } from './partiel'
import { geometrieParcelleValide } from '@/lib/geo-utils'

export const COUCHES_ACTIVITE = ['MARAICHAGE', 'VERGER', 'ELEVAGE', 'PATURAGE'] as const

// Tous les anneaux de toutes les composantes (reliquat GEO-01) : voir geo-utils.
const geojsonSchema = z.string().refine((val) => geometrieParcelleValide(val), { message: "Contour GeoJSON invalide (chaque contour et chaque trou : fermé, au moins 3 sommets, coordonnées numériques)" })

const coucheActiviteSchema = z.enum(COUCHES_ACTIVITE)

export const parcelleSchema = z.object({
  nom: z.string().min(1, "Le nom de la parcelle est requis").max(100),
  geometry: geojsonSchema,
  couches: z.array(coucheActiviteSchema).default([]),
  commune: z.string().max(100).nullable().optional(),
  section: z.string().max(20).nullable().optional(),
  numero: z.string().max(20).nullable().optional(),
  prefixe: z.string().max(20).nullable().optional(),
  contenance: z.number().min(0).nullable().optional(),
  typeSol: z.string().max(100).nullable().optional(),
  usage: z.string().max(100).nullable().optional(),
  couleur: z.string().max(20).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  surface: z.number().min(0).nullable().optional(),
})

export const createParcelleSchema = parcelleSchema
// Sans le défaut `couches: []` : renommer une parcelle ne lui retire plus ses
// ateliers (revue Codex DATA-02).
export const updateParcelleSchema = partielSansDefauts(parcelleSchema)
