import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { COTE_MAX_PHOTO_AVIS, MAX_CORPS_AVIS, MAX_OCTETS_PHOTO_AVIS, MAX_PHOTOS_AVIS } from './photos'
export class ErreurAvis extends Error { constructor(public status: number, message: string) { super(message) } }
const legende = z.string().trim().max(300).optional()
export const photosAvisSchema = z.array(z.union([
  z.object({ id: z.string().uuid(), legende }).strict(),
  z.object({ dataUrl: z.string().max(Math.ceil(MAX_OCTETS_PHOTO_AVIS / 3) * 4 + 50), legende }).strict(),
])).max(MAX_PHOTOS_AVIS)
export type PhotoPreparee = { id: string; legende: string | null; donnees?: Buffer; width?: number; height?: number }
export async function lireCorpsAvis(request: Request): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > MAX_CORPS_AVIS) throw new ErreurAvis(413, 'Envoi trop volumineux. Réduisez les photos.')
  const reader = request.body?.getReader()
  if (!reader) throw new ErreurAvis(400, 'Corps JSON requis.')
  const chunks: Uint8Array[] = []; let taille = 0
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break
      taille += value.byteLength
      if (taille > MAX_CORPS_AVIS) { await reader.cancel(); throw new ErreurAvis(413, 'Envoi trop volumineux. Réduisez les photos.') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new ErreurAvis(400, 'Corps JSON invalide.') }
}
let traitement = Promise.resolve(), attente = 0
export async function preparerPhotosAvis(value: unknown, droits: unknown, nouvellesSeulement = false): Promise<PhotoPreparee[] | undefined> {
  if (value === undefined) return undefined
  const parsed = photosAvisSchema.safeParse(value)
  if (!parsed.success) throw new ErreurAvis(400, 'Choisissez au maximum trois photos JPEG, PNG ou WebP.')
  if (nouvellesSeulement && parsed.data.some(p => 'id' in p)) throw new ErreurAvis(400, 'Ajoutez vos propres photos à ce témoignage.')
  if (parsed.data.some(p => 'dataUrl' in p) && droits !== true) throw new ErreurAvis(400, 'Confirmez que vous disposez des droits pour partager ces photos.')
  const ids = parsed.data.filter(p => 'id' in p).map(p => p.id)
  if (new Set(ids).size !== ids.length) throw new ErreurAvis(400, 'Une photo ne peut être ajoutée deux fois.')
  if (attente >= 3) throw new ErreurAvis(429, 'Préparation des photos occupée. Réessayez dans quelques instants.')
  attente++; const avant = traitement; let liberer!: () => void
  traitement = new Promise<void>(resolve => { liberer = resolve }); await avant
  try {
    const result: PhotoPreparee[] = []
    for (const photo of parsed.data) {
      if ('id' in photo) { result.push({ id: photo.id, legende: photo.legende || null }); continue }
      const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(photo.dataUrl)
      if (!match || match[2].length % 4) throw new ErreurAvis(415, 'Format attendu : JPEG, PNG ou WebP.')
      const buffer = Buffer.from(match[2], 'base64')
      if (!buffer.length || buffer.length > MAX_OCTETS_PHOTO_AVIS) throw new ErreurAvis(413, 'Photo trop volumineuse.')
      try {
        const image = sharp(buffer, { limitInputPixels: 32_000_000, animated: false, sequentialRead: true })
        const meta = await image.metadata()
        if (meta.format !== match[1] || (meta.pages ?? 1) > 1) throw new Error('Format')
        const { data, info } = await image.rotate().resize(COTE_MAX_PHOTO_AVIS, COTE_MAX_PHOTO_AVIS, { fit: 'inside', withoutEnlargement: true })
          .flatten({ background: '#fff' }).jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true })
        if (data.length > MAX_OCTETS_PHOTO_AVIS) throw new ErreurAvis(413, 'Photo trop détaillée. Recadrez-la avant de réessayer.')
        result.push({ id: randomUUID(), donnees: data, width: info.width, height: info.height, legende: photo.legende || null })
      } catch (e) { if (e instanceof ErreurAvis) throw e; throw new ErreurAvis(422, 'Image illisible ou trop grande.') }
    }
    return result
  } finally { attente--; liberer() }
}

export function reponseErreurAvis(error: unknown): Response {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null
  const status = error instanceof ErreurAvis ? error.status : code === 'P2002' || code === 'P2034' ? 409 : code === 'P2003' || code === 'P2025' ? 404 : 500
  const message = error instanceof ErreurAvis ? error.message : status === 409 ? 'Cet avis vient de changer. Rechargez-le avant de réessayer.' : status === 404 ? 'Cet élément n’est plus disponible.' : 'L’opération n’a pas pu être enregistrée.'
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
}
