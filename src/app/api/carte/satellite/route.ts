/**
 * API Route - Image satellite IGN pour une zone donnée
 * GET /api/carte/satellite?bbox=lng1,lat1,lng2,lat2&width=1024&height=1024
 *
 * Proxy vers le WMS IGN Géoplateforme pour récupérer une image satellite
 * d'un bounding box donné. Retourne l'image en base64 data URL.
 */

import { NextRequest, NextResponse } from 'next/server'

// URL WMS IGN Géoplateforme - Orthophotos (satellite haute résolution)
const IGN_WMS_URL = 'https://data.geopf.fr/wms-r/wms'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl

    // Paramètre requis : bbox au format lng1,lat1,lng2,lat2 (WGS84)
    const bbox = searchParams.get('bbox')
    if (!bbox) {
      return NextResponse.json(
        { error: 'Le paramètre bbox est obligatoire (format: lng1,lat1,lng2,lat2)' },
        { status: 400 }
      )
    }

    // Valider le format bbox
    const parts = bbox.split(',').map(Number)
    if (parts.length !== 4 || parts.some(isNaN)) {
      return NextResponse.json(
        { error: 'Format bbox invalide. Attendu: lng1,lat1,lng2,lat2' },
        { status: 400 }
      )
    }

    const [lng1, lat1, lng2, lat2] = parts

    // Dimensions de l'image (optionnelles, défaut 1024x1024, max 2048)
    const width = Math.min(parseInt(searchParams.get('width') || '1024'), 2048)
    const height = Math.min(parseInt(searchParams.get('height') || '1024'), 2048)

    // Pour le WMS IGN en CRS EPSG:4326, le BBOX est en lat,lng (norme OGC)
    // Inverse du GeoJSON standard qui est en lng,lat
    const wmsBbox = `${lat1},${lng1},${lat2},${lng2}`

    // Construire l'URL WMS GetMap
    const wmsParams = new URLSearchParams({
      SERVICE: 'WMS',
      VERSION: '1.3.0',
      REQUEST: 'GetMap',
      LAYERS: 'ORTHOIMAGERY.ORTHOPHOTOS',
      CRS: 'EPSG:4326',
      BBOX: wmsBbox,
      WIDTH: width.toString(),
      HEIGHT: height.toString(),
      FORMAT: 'image/jpeg',
      STYLES: '',
    })

    const wmsUrl = `${IGN_WMS_URL}?${wmsParams.toString()}`

    // Récupérer l'image depuis l'IGN
    const response = await fetch(wmsUrl, {
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      console.error(`WMS IGN erreur: ${response.status} ${response.statusText}`)
      return NextResponse.json(
        { error: 'Impossible de récupérer l\'image satellite depuis l\'IGN' },
        { status: 502 }
      )
    }

    const contentType = response.headers.get('content-type') || ''

    // Si l'IGN retourne du XML au lieu d'une image, c'est une erreur
    if (contentType.includes('xml') || contentType.includes('text')) {
      const text = await response.text()
      console.error('WMS IGN a retourné une erreur:', text)
      return NextResponse.json(
        { error: 'L\'IGN a retourné une erreur au lieu d\'une image' },
        { status: 502 }
      )
    }

    // Convertir l'image en base64
    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const dataUrl = `data:image/jpeg;base64,${base64}`

    // Calculer les dimensions réelles en mètres
    const toRad = (d: number) => (d * Math.PI) / 180
    const R = 6378137 // rayon terrestre en mètres

    // Largeur en mètres (distance est-ouest au milieu de la latitude)
    const midLat = (lat1 + lat2) / 2
    const widthMeters = Math.abs(lng2 - lng1) * toRad(1) * R * Math.cos(toRad(midLat))

    // Hauteur en mètres (distance nord-sud)
    const heightMeters = Math.abs(lat2 - lat1) * toRad(1) * R

    // Scale = mètres par pixel
    const scaleX = widthMeters / width
    const scaleY = heightMeters / height

    return NextResponse.json({
      image: dataUrl,
      width,
      height,
      bbox: { lng1, lat1, lng2, lat2 },
      dimensions: {
        widthMeters: Math.round(widthMeters * 100) / 100,
        heightMeters: Math.round(heightMeters * 100) / 100,
        scaleX: Math.round(scaleX * 10000) / 10000,
        scaleY: Math.round(scaleY * 10000) / 10000,
      },
    })
  } catch (err) {
    console.error('GET /api/carte/satellite error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'image satellite' },
      { status: 500 }
    )
  }
}
