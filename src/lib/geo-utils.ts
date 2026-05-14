/**
 * Utilitaires geographiques isomorphes (client + serveur)
 * Calcul de surface et centroide a partir de coordonnees GeoJSON
 */

/**
 * Extrait les coordonnees du premier anneau d'un GeoJSON Polygon/MultiPolygon
 */
function getFirstRing(geojsonStr: string): number[][] | null {
  try {
    const geo = JSON.parse(geojsonStr)
    return geo.type === 'MultiPolygon'
      ? geo.coordinates[0][0]
      : geo.coordinates[0]
  } catch {
    return null
  }
}

/**
 * Calcule la surface en hectares a partir d'un GeoJSON string (Polygon/MultiPolygon)
 * Formule de Shoelace adaptee aux coordonnees GPS
 */
export function calculateSurfaceHa(geojsonStr: string): number | null {
  const coords = getFirstRing(geojsonStr)
  if (!coords) return null
  const toRad = (d: number) => (d * Math.PI) / 180
  let area = 0
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length
    const lat1 = toRad(coords[i][1])
    const lat2 = toRad(coords[j][1])
    const dLng = toRad(coords[j][0] - coords[i][0])
    area += dLng * (2 + Math.sin(lat1) + Math.sin(lat2))
  }
  area = Math.abs((area * 6378137 * 6378137) / 2)
  return Math.round(area / 100) / 100
}

/**
 * Calcule le centroide d'un polygone GeoJSON
 * Moyenne arithmetique des coordonnees du premier anneau
 */
export function calculateCentroid(geojsonStr: string): { lat: number; lng: number } | null {
  const coords = getFirstRing(geojsonStr)
  if (!coords) return null
  const n = coords.length
  const sum = coords.reduce(
    (acc: [number, number], c: number[]): [number, number] => [acc[0] + c[0], acc[1] + c[1]],
    [0, 0] as [number, number]
  )
  return { lng: sum[0] / n, lat: sum[1] / n }
}
