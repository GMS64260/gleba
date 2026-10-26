import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { lireCorpsAvis, preparerPhotosAvis } from './photos-serveur'
import { MAX_CORPS_AVIS } from './photos'
const req = (body: string, headers?: Record<string,string>) => new Request('http://localhost/avis', { method: 'POST', headers, body })
describe('corps et formats des photos privées', () => {
  it('borne les corps déclarés et réellement reçus avant JSON.parse', async () => {
    await expect(lireCorpsAvis(req('{}', { 'content-length': String(MAX_CORPS_AVIS + 1) }))).rejects.toMatchObject({ status: 413 })
    await expect(lireCorpsAvis(req('x'.repeat(MAX_CORPS_AVIS + 1)))).rejects.toMatchObject({ status: 413 })
    await expect(lireCorpsAvis(req('pas du JSON'))).rejects.toMatchObject({ status: 400 })
  })
  it('refuse plus de trois photos, les liens distants et les octets illisibles', async () => {
    await expect(preparerPhotosAvis(Array.from({ length: 4 }, () => ({ dataUrl: 'x' })), true)).rejects.toMatchObject({ status: 400 })
    await expect(preparerPhotosAvis([{ dataUrl: 'https://example.test/photo.jpg' }], true)).rejects.toMatchObject({ status: 415 })
    await expect(preparerPhotosAvis([{ dataUrl: 'data:image/png;base64,YWJjZA==' }], true)).rejects.toMatchObject({ status: 422 })
  })
  it('exige les droits pour une nouvelle image et interdit les réemplois sur un témoignage', async () => {
    await expect(preparerPhotosAvis([{ dataUrl: 'data:image/png;base64,YWJjZA==' }], false)).rejects.toMatchObject({ status: 400 })
    await expect(preparerPhotosAvis([{ id: '65d8714b-5856-479d-9e56-3889328cb67d' }], true, true)).rejects.toMatchObject({ status: 400 })
    expect(await preparerPhotosAvis(undefined, false)).toBeUndefined()
    expect(await preparerPhotosAvis([], false)).toEqual([])
  })
  it('réencode en JPEG, réduit les dimensions et supprime EXIF et orientation', async () => {
    const original = await sharp({ create: { width: 1700, height: 300, channels: 3, background: '#4c7259' } }).withMetadata({ orientation: 1, exif: { IFD0: { Artist: 'Auteur de test à retirer' } } }).png().toBuffer()
    const photos = await preparerPhotosAvis([{ dataUrl: `data:image/png;base64,${original.toString('base64')}` }], true)
    const photo = photos![0]
    expect(photo.donnees).toBeDefined(); expect(photo.donnees!.length).toBeLessThanOrEqual(700 * 1024)
    const meta = await sharp(photo.donnees!).metadata()
    expect(meta.format).toBe('jpeg'); expect(meta.width).toBeLessThanOrEqual(1600); expect(meta.exif).toBeUndefined(); expect(meta.orientation).toBeUndefined()
  })
})
