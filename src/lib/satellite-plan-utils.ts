type CoordGps = [number, number]

export interface PointGps {
  lat: number
  lng: number
}

export interface BboxGps {
  lng1: number
  lat1: number
  lng2: number
  lat2: number
}

function collecterCoords(value: unknown, resultat: CoordGps[]) {
  if (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1])
  ) {
    resultat.push([value[0], value[1]])
    return
  }
  if (Array.isArray(value)) {
    for (const enfant of value) collecterCoords(enfant, resultat)
  }
}

/**
 * Étendue de capture commune à la parcelle et à ses relevés GPS.
 * Les arbres proches mais extérieurs au polygone restent ainsi visibles sur
 * l'orthophoto et ne sont plus rejetés dans un coin du plan.
 */
export function calculerBboxCapture(
  geometryGeoJson: string,
  points: PointGps[] = [],
  margeRatio = 0.05
): BboxGps | null {
  try {
    const geometry = JSON.parse(geometryGeoJson) as { coordinates?: unknown }
    const coords: CoordGps[] = []
    collecterCoords(geometry.coordinates, coords)
    for (const point of points) {
      if (
        Number.isFinite(point.lat) &&
        Number.isFinite(point.lng) &&
        point.lat >= -90 &&
        point.lat <= 90 &&
        point.lng >= -180 &&
        point.lng <= 180
      ) {
        coords.push([point.lng, point.lat])
      }
    }
    if (coords.length === 0) return null

    let minLng = Infinity
    let minLat = Infinity
    let maxLng = -Infinity
    let maxLat = -Infinity
    for (const [lng, lat] of coords) {
      minLng = Math.min(minLng, lng)
      minLat = Math.min(minLat, lat)
      maxLng = Math.max(maxLng, lng)
      maxLat = Math.max(maxLat, lat)
    }
    const dLng = Math.max(maxLng - minLng, 0.000001)
    const dLat = Math.max(maxLat - minLat, 0.000001)
    return {
      lng1: minLng - dLng * margeRatio,
      lat1: minLat - dLat * margeRatio,
      lng2: maxLng + dLng * margeRatio,
      lat2: maxLat + dLat * margeRatio,
    }
  } catch {
    return null
  }
}

/**
 * Dimensions WMS dont les pixels ont quasiment la même taille au sol sur X
 * et Y. Une taille fixe 1280×1024 déformait les parcelles non carrées.
 */
export function dimensionsCaptureMetrique(
  bbox: BboxGps,
  coteMax = 1280
): { width: number; height: number } | null {
  const milieuLat = (bbox.lat1 + bbox.lat2) / 2
  const largeur = Math.abs(bbox.lng2 - bbox.lng1) * Math.cos((milieuLat * Math.PI) / 180)
  const hauteur = Math.abs(bbox.lat2 - bbox.lat1)
  if (!(largeur > 0) || !(hauteur > 0) || !(coteMax > 0)) return null
  const plusGrand = Math.max(largeur, hauteur)
  return {
    width: Math.max(1, Math.round((coteMax * largeur) / plusGrand)),
    height: Math.max(1, Math.round((coteMax * hauteur) / plusGrand)),
  }
}

/** Projette le contour GeoJSON dans les pixels exacts de la capture WMS. */
export function contourEnPixels(
  geometryGeoJson: string,
  bbox: BboxGps,
  width: number,
  height: number
): number[][][] | null {
  try {
    const geometry = JSON.parse(geometryGeoJson) as {
      type?: unknown
      coordinates?: unknown
    }
    const rings: CoordGps[][] =
      geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)
        ? geometry.coordinates.map((polygon) =>
            Array.isArray(polygon) && Array.isArray(polygon[0])
              ? (polygon[0] as CoordGps[])
              : []
          )
        : geometry.type === "Polygon" &&
            Array.isArray(geometry.coordinates) &&
            Array.isArray(geometry.coordinates[0])
          ? [geometry.coordinates[0] as CoordGps[]]
          : []
    if (rings.length === 0 || rings.some((ring) => ring.length < 3)) return null
    const dLng = bbox.lng2 - bbox.lng1
    const dLat = bbox.lat2 - bbox.lat1
    if (!(dLng > 0) || !(dLat > 0) || !(width > 0) || !(height > 0)) return null
    return rings.map((ring) =>
      ring.map(([lng, lat]) => [
        Math.round(((lng - bbox.lng1) / dLng) * width * 100) / 100,
        Math.round(((bbox.lat2 - lat) / dLat) * height * 100) / 100,
      ])
    )
  } catch {
    return null
  }
}
