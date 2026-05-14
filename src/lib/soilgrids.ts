/**
 * Service SoilGrids (ISRIC)
 * Récupère les propriétés du sol par coordonnées GPS
 * API gratuite, résolution 250m, données mondiales
 * https://rest.isric.org/soilgrids/v2.0/docs
 */

// ── Types ──────────────────────────────────────────────────

export interface SoilGridsData {
  argile: number    // % (0-100)
  limon: number     // % (0-100)
  sable: number     // % (0-100)
  ph: number        // pH (0-14)
  carboneOrg: number // % (0-100)
}

interface SoilGridsAPILayer {
  name: string
  unit_measure: { mapped_units: string; target_units: string; d_factor: number }
  depths: Array<{
    label: string
    range: { top_depth: number; bottom_depth: number; unit_depth: string }
    values: { mean?: number; Q0_05?: number; Q0_5?: number; Q0_95?: number; uncertainty?: number }
  }>
}

interface SoilGridsAPIResponse {
  type: string
  geometry: { type: string; coordinates: [number, number] }
  properties: {
    layers: SoilGridsAPILayer[]
  }
}

// PROMPT 25 LOT A — Cache persistant via GenericCache
// (avant : Map en mémoire vidée à chaque redémarrage Docker)
import { getOrFetch } from "./cache-helper"

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 jours (les sols changent peu)

function cacheKey(lat: number, lng: number): string {
  // Arrondir à 3 décimales (~110 m, compatible avec résolution 250 m de SoilGrids)
  return `soilgrids:${lat.toFixed(3)},${lng.toFixed(3)}`
}

// ── API ────────────────────────────────────────────────────

const SOILGRIDS_BASE_URL = 'https://rest.isric.org/soilgrids/v2.0/properties/query'

/**
 * Récupère les propriétés du sol depuis SoilGrids pour un point GPS
 * Couche 0-5cm (surface, la plus pertinente pour le jardinage)
 *
 * Conversions d'unités SoilGrids :
 * - clay/silt/sand : g/kg → % (÷ 10)
 * - phh2o : pH×10 → pH (÷ 10)
 * - soc (soil organic carbon) : dg/kg → % (÷ 100)
 */
export async function fetchSoilData(lat: number, lng: number): Promise<SoilGridsData | null> {
  // PROMPT 25 LOT A — Cache persistant DB (avant : Map en mémoire)
  return getOrFetch<SoilGridsData | null>(cacheKey(lat, lng), () => _fetchSoilDataLive(lat, lng), CACHE_TTL_MS)
}

async function _fetchSoilDataLive(lat: number, lng: number): Promise<SoilGridsData | null> {
  try {
    const params = new URLSearchParams({
      lon: lng.toFixed(4),
      lat: lat.toFixed(4),
      property: 'clay',
      depth: '0-5cm',
      value: 'mean',
    })
    // Ajouter les autres propriétés (URLSearchParams supporte les clés multiples)
    params.append('property', 'silt')
    params.append('property', 'sand')
    params.append('property', 'phh2o')
    params.append('property', 'soc')

    const url = `${SOILGRIDS_BASE_URL}?${params.toString()}`

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000), // 15s timeout
    })

    if (!response.ok) {
      console.error(`SoilGrids API error: ${response.status} ${response.statusText}`)
      return null
    }

    const json: SoilGridsAPIResponse = await response.json()

    // Extraire les valeurs moyennes de la couche 0-5cm
    const layers = json.properties?.layers
    if (!layers || layers.length === 0) return null

    const getValue = (propertyName: string): number | null => {
      const layer = layers.find(l => l.name === propertyName)
      if (!layer) return null
      const depth0_5 = layer.depths?.find(d => d.range.top_depth === 0 && d.range.bottom_depth === 5)
      return depth0_5?.values?.mean ?? null
    }

    const clayRaw = getValue('clay')     // g/kg
    const siltRaw = getValue('silt')     // g/kg
    const sandRaw = getValue('sand')     // g/kg
    const phRaw = getValue('phh2o')      // pH × 10
    const socRaw = getValue('soc')       // dg/kg

    // Si données essentielles manquantes, retourner null
    if (clayRaw === null || siltRaw === null || sandRaw === null) return null

    // Conversion vers unités Gleba
    const data: SoilGridsData = {
      argile: Math.round(clayRaw / 10 * 10) / 10,       // g/kg → %
      limon: Math.round(siltRaw / 10 * 10) / 10,        // g/kg → %
      sable: Math.round(sandRaw / 10 * 10) / 10,        // g/kg → %
      ph: phRaw !== null ? Math.round(phRaw / 10 * 10) / 10 : 7.0,  // pH×10 → pH
      carboneOrg: socRaw !== null ? Math.round(socRaw / 100 * 100) / 100 : 0, // dg/kg → %
    }

    // Normaliser : s'assurer que argile + limon + sable = 100%
    const total = data.argile + data.limon + data.sable
    if (total > 0 && Math.abs(total - 100) > 1) {
      const factor = 100 / total
      data.argile = Math.round(data.argile * factor * 10) / 10
      data.limon = Math.round(data.limon * factor * 10) / 10
      data.sable = Math.round((100 - data.argile - data.limon) * 10) / 10
    }

    return data
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      console.error('SoilGrids API timeout')
    } else {
      console.error('SoilGrids API error:', error)
    }
    return null
  }
}
