/**
 * Utilitaires geographiques isomorphes (client + serveur)
 * Calcul de surface et centroide a partir de coordonnees GeoJSON
 *
 * GEO-01 (revue Codex du 2026-11-12) : seul le premier anneau de la première
 * composante était lu. Une parcelle en plusieurs morceaux (MultiPolygon) ou
 * percée d'un trou (mare, bâtiment) avait une surface fausse, recalculée à
 * chaque PUT de géométrie, et le ratio de cuivre par hectare avec elle. Toutes
 * les composantes sont désormais sommées, trous déduits. La surface n'est plus
 * arrondie à 0,01 ha avant stockage (moins de 50 m² devenait 0) : les écrans
 * arrondissent à l'affichage.
 */

type Anneau = number[][]
/** Un polygone GeoJSON : anneau extérieur puis trous. */
type Polygone = Anneau[]

const RAYON_TERRE_M = 6378137

/** Composantes d'un GeoJSON Polygon/MultiPolygon, ou null s'il est illisible. */
function lirePolygones(geojsonStr: string): Polygone[] | null {
  try {
    const geo = JSON.parse(geojsonStr)
    const brut: unknown =
      geo?.type === 'MultiPolygon' ? geo.coordinates
      : geo?.type === 'Polygon' ? [geo.coordinates]
      : null
    if (!Array.isArray(brut)) return null
    const polygones = brut.filter(
      (p): p is Polygone => Array.isArray(p) && p.length > 0 && Array.isArray(p[0]) && p[0].length >= 3
    )
    return polygones.length > 0 ? polygones : null
  } catch {
    return null
  }
}

/** Surface d'un anneau en m², sans signe (formule sphérique de l'ancienne version). */
function surfaceAnneauM2(coords: Anneau): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  let area = 0
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length
    const lat1 = toRad(coords[i][1])
    const lat2 = toRad(coords[j][1])
    const dLng = toRad(coords[j][0] - coords[i][0])
    area += dLng * (2 + Math.sin(lat1) + Math.sin(lat2))
  }
  return Math.abs((area * RAYON_TERRE_M * RAYON_TERRE_M) / 2)
}

/** Surface d'un polygone en m² : extérieur moins les trous, jamais négative. */
function surfacePolygoneM2([exterieur, ...trous]: Polygone): number {
  const nette = surfaceAnneauM2(exterieur) - trous.reduce((s, t) => s + surfaceAnneauM2(t), 0)
  return Math.max(0, nette)
}

/**
 * Calcule la surface en hectares a partir d'un GeoJSON string (Polygon/MultiPolygon)
 * Somme des composantes, trous déduits ; valeur non arrondie.
 */
export function calculateSurfaceHa(geojsonStr: string): number | null {
  const polygones = lirePolygones(geojsonStr)
  if (!polygones) return null
  return polygones.reduce((s, p) => s + surfacePolygoneM2(p), 0) / 10000
}

/**
 * Aire signée (plane) et centroïde d'un anneau, formule du lacet, en
 * coordonnées relatives à `origine` pour ne pas perdre de précision.
 */
function momentAnneau(coords: Anneau, origine: number[]): { aire: number; x: number; y: number } {
  let a = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < coords.length; i++) {
    const x0 = coords[i][0] - origine[0]
    const y0 = coords[i][1] - origine[1]
    const suivant = coords[(i + 1) % coords.length]
    const x1 = suivant[0] - origine[0]
    const y1 = suivant[1] - origine[1]
    const f = x0 * y1 - x1 * y0
    a += f
    cx += (x0 + x1) * f
    cy += (y0 + y1) * f
  }
  a /= 2
  return a === 0 ? { aire: 0, x: 0, y: 0 } : { aire: a, x: cx / (6 * a), y: cy / (6 * a) }
}

/**
 * Calcule le centroide d'un polygone GeoJSON
 * Barycentre des surfaces : toutes les composantes, trous déduits. Le repère
 * plan en degrés suffit à l'échelle d'une parcelle (la correction en cos(lat)
 * est commune à tous les anneaux et ne déplace pas le barycentre).
 * Géométrie dégénérée (surface nulle) : moyenne des sommets extérieurs.
 */
export function calculateCentroid(geojsonStr: string): { lat: number; lng: number } | null {
  const polygones = lirePolygones(geojsonStr)
  if (!polygones) return null
  const origine = polygones[0][0][0]
  let aire = 0
  let sx = 0
  let sy = 0
  for (const anneaux of polygones) {
    anneaux.forEach((anneau, index) => {
      const m = momentAnneau(anneau, origine)
      // Extérieur compté positivement, trous négativement, quel que soit le sens.
      const poids = index === 0 ? Math.abs(m.aire) : -Math.abs(m.aire)
      aire += poids
      sx += poids * m.x
      sy += poids * m.y
    })
  }
  if (aire > 0) return { lng: origine[0] + sx / aire, lat: origine[1] + sy / aire }
  const sommets = polygones.flatMap(([exterieur]) => exterieur)
  const somme = sommets.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1]], [0, 0])
  return { lng: somme[0] / sommets.length, lat: somme[1] / sommets.length }
}
