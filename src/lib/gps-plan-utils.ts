import {
  fondVersMonde,
  mondeVersFond,
  type FondReglages,
  type Point,
} from "@/lib/plan-fond-utils"

type CoordGps = [number, number]

interface ProjectionLineaire {
  pente: number
  origine: number
}

interface ProjectionGpsPixels {
  x: ProjectionLineaire
  y: ProjectionLineaire
}

function estCoordGps(value: unknown): value is CoordGps {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1])
  )
}

function anneauxExterieurs(geometryGeoJson: string): CoordGps[][] | null {
  try {
    const geometry = JSON.parse(geometryGeoJson) as {
      type?: unknown
      coordinates?: unknown
    }

    if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) {
      const anneau = geometry.coordinates[0]
      return Array.isArray(anneau) && anneau.every(estCoordGps) ? [anneau] : null
    }

    if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
      const anneaux = geometry.coordinates.map((polygone) =>
        Array.isArray(polygone) ? polygone[0] : null
      )
      return anneaux.every(
        (anneau): anneau is CoordGps[] => Array.isArray(anneau) && anneau.every(estCoordGps)
      )
        ? anneaux
        : null
    }
  } catch {
    return null
  }

  return null
}

function ajusterProjection(entrees: number[], sorties: number[]): ProjectionLineaire | null {
  if (entrees.length < 2 || entrees.length !== sorties.length) return null

  const moyenneEntree = entrees.reduce((somme, valeur) => somme + valeur, 0) / entrees.length
  const moyenneSortie = sorties.reduce((somme, valeur) => somme + valeur, 0) / sorties.length
  let variance = 0
  let covariance = 0

  for (let index = 0; index < entrees.length; index++) {
    const entreeCentree = entrees[index] - moyenneEntree
    variance += entreeCentree * entreeCentree
    covariance += entreeCentree * (sorties[index] - moyenneSortie)
  }

  if (variance <= 1e-20) return null
  const pente = covariance / variance
  const origine = moyenneSortie - pente * moyenneEntree
  if (!Number.isFinite(pente) || !Number.isFinite(origine)) return null
  return { pente, origine }
}

/**
 * Retrouve la transformation WGS84 → pixels à partir des mêmes sommets :
 * le GeoJSON de la parcelle et son contour enregistré avec la capture IGN.
 *
 * Cette correspondance évite de dépendre d'une marge ou d'une dimension de
 * capture codée en dur. Elle reste valable après calibration, translation ou
 * rotation du fond, qui sont appliquées dans un second temps.
 */
function projectionGpsPixels(
  geometryGeoJson: string,
  contour: number[][][]
): ProjectionGpsPixels | null {
  const anneauxGps = anneauxExterieurs(geometryGeoJson)
  if (!anneauxGps || anneauxGps.length !== contour.length) return null

  const longitudes: number[] = []
  const latitudes: number[] = []
  const pixelsX: number[] = []
  const pixelsY: number[] = []

  for (let anneauIndex = 0; anneauIndex < anneauxGps.length; anneauIndex++) {
    const gps = anneauxGps[anneauIndex]
    const pixels = contour[anneauIndex]
    if (!Array.isArray(pixels) || gps.length !== pixels.length) return null

    for (let pointIndex = 0; pointIndex < gps.length; pointIndex++) {
      const pixel = pixels[pointIndex]
      if (
        !Array.isArray(pixel) ||
        pixel.length < 2 ||
        !Number.isFinite(pixel[0]) ||
        !Number.isFinite(pixel[1])
      ) {
        return null
      }
      longitudes.push(gps[pointIndex][0])
      latitudes.push(gps[pointIndex][1])
      pixelsX.push(pixel[0])
      pixelsY.push(pixel[1])
    }
  }

  const x = ajusterProjection(longitudes, pixelsX)
  const y = ajusterProjection(latitudes, pixelsY)
  return x && y ? { x, y } : null
}

export interface ProjectionGpsSurPlanParams {
  gpsLat: number
  gpsLng: number
  geometryGeoJson: string
  contour: number[][][]
  fond: FondReglages
  imageWidth: number
  imageHeight: number
}

export interface ProjectionPlanSurGpsParams {
  posX: number
  posY: number
  geometryGeoJson: string
  contour: number[][][]
  fond: FondReglages
  imageWidth: number
  imageHeight: number
}

export interface PositionGps {
  gpsLat: number
  gpsLng: number
}

function pixelDansEtendueElargie(
  pixel: Point,
  imageWidth: number,
  imageHeight: number
): boolean {
  const margeX = imageWidth
  const margeY = imageHeight
  return (
    pixel.x >= -margeX &&
    pixel.x <= imageWidth + margeX &&
    pixel.y >= -margeY &&
    pixel.y <= imageHeight + margeY
  )
}

/**
 * Projette un relevé GPS d'arbre dans le repère métrique du plan 2D.
 *
 * Retourne null si le fond n'est pas géoréférencé ou si le relevé est très
 * loin de l'image. Un point proche mais extérieur au contour reste projeté :
 * les plantations réelles ne suivent pas nécessairement la limite dessinée.
 * La garde large empêche néanmoins une latitude/longitude inversée ou
 * erronée de dézoomer tout le plan.
 */
export function projeterGpsSurPlan({
  gpsLat,
  gpsLng,
  geometryGeoJson,
  contour,
  fond,
  imageWidth,
  imageHeight,
}: ProjectionGpsSurPlanParams): Point | null {
  if (
    !Number.isFinite(gpsLat) ||
    !Number.isFinite(gpsLng) ||
    gpsLat < -90 ||
    gpsLat > 90 ||
    gpsLng < -180 ||
    gpsLng > 180 ||
    !(imageWidth > 0) ||
    !(imageHeight > 0)
  ) {
    return null
  }

  const projection = projectionGpsPixels(geometryGeoJson, contour)
  if (!projection) return null

  const pixel = {
    x: projection.x.pente * gpsLng + projection.x.origine,
    y: projection.y.pente * gpsLat + projection.y.origine,
  }
  if (!pixelDansEtendueElargie(pixel, imageWidth, imageHeight)) return null

  return fondVersMonde(pixel, fond, imageWidth, imageHeight)
}

/**
 * Convertit un déplacement sur le plan 2D en coordonnées WGS84.
 *
 * Cette fonction est l'inverse de projeterGpsSurPlan. Elle ne doit être
 * utilisée qu'après confirmation explicite : déplacer un arbre géolocalisé
 * revient alors à remplacer son relevé terrain.
 */
export function projeterPlanSurGps({
  posX,
  posY,
  geometryGeoJson,
  contour,
  fond,
  imageWidth,
  imageHeight,
}: ProjectionPlanSurGpsParams): PositionGps | null {
  const projection = projectionGpsPixels(geometryGeoJson, contour)
  if (
    !projection ||
    Math.abs(projection.x.pente) <= 1e-12 ||
    Math.abs(projection.y.pente) <= 1e-12
  ) {
    return null
  }

  const pixel = mondeVersFond({ x: posX, y: posY }, fond, imageWidth, imageHeight)
  if (!pixel || !pixelDansEtendueElargie(pixel, imageWidth, imageHeight)) return null

  const gpsLng = (pixel.x - projection.x.origine) / projection.x.pente
  const gpsLat = (pixel.y - projection.y.origine) / projection.y.pente
  if (
    !Number.isFinite(gpsLat) ||
    !Number.isFinite(gpsLng) ||
    gpsLat < -90 ||
    gpsLat > 90 ||
    gpsLng < -180 ||
    gpsLng > 180
  ) {
    return null
  }

  // Sept décimales conservent une précision centimétrique sans persister le
  // bruit numérique de l'inversion matricielle.
  return {
    gpsLat: Math.round(gpsLat * 1e7) / 1e7,
    gpsLng: Math.round(gpsLng * 1e7) / 1e7,
  }
}
