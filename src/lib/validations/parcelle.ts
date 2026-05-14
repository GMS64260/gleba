/**
 * Schemas de validation Zod pour les Parcelles
 */

import { z } from 'zod'

export const COUCHES_ACTIVITE = ['MARAICHAGE', 'VERGER', 'ELEVAGE', 'PATURAGE'] as const

const geojsonSchema = z.string().refine((val) => {
  try {
    const geo = JSON.parse(val)
    if (!['Polygon', 'MultiPolygon'].includes(geo.type)) return false
    const ring = geo.type === 'MultiPolygon'
      ? geo.coordinates?.[0]?.[0]
      : geo.coordinates?.[0]
    if (!Array.isArray(ring) || ring.length < 4) return false
    // Verifier que chaque coordonnee est un [number, number]
    if (!ring.every((c: unknown) => Array.isArray(c) && c.length >= 2
      && typeof c[0] === 'number' && typeof c[1] === 'number'
      && isFinite(c[0]) && isFinite(c[1]))) return false
    // Verifier que le polygon est ferme (premier point = dernier point, RFC 7946)
    const first = ring[0], last = ring[ring.length - 1]
    if (first[0] !== last[0] || first[1] !== last[1]) return false
    return true
  } catch { return false }
}, { message: "Contour GeoJSON invalide (Polygon ferme avec au moins 3 sommets et coordonnees numeriques requis)" })

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
export const updateParcelleSchema = parcelleSchema.partial()

export type ParcelleInput = z.infer<typeof parcelleSchema>
export type CreateParcelleInput = z.infer<typeof createParcelleSchema>
export type UpdateParcelleInput = z.infer<typeof updateParcelleSchema>
