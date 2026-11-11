import sharp from "sharp"

/**
 * Les deux formats d'une photo envoyée (1200 px et vignette 300 px), sans
 * aucune métadonnée de l'original.
 *
 * `rotate()` applique d'abord l'orientation EXIF. Sharp ne recopie ensuite
 * aucune métadonnée tant qu'on ne le lui demande pas : surtout ne pas appeler
 * `withMetadata()`. `withMetadata({ exif: {} })` ne vide pas les EXIF, il les
 * FUSIONNE avec un objet vide et conserve donc tout, position GPS comprise,
 * dans des photos ensuite publiables sur la boutique (revue du 2026-11-11).
 */
export async function formatsPhotoSansMetadonnees(buffer: Buffer): Promise<{ grand: Buffer; vignette: Buffer }> {
  const base = sharp(buffer).rotate()
  const [grand, vignette] = await Promise.all([
    base
      .clone()
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer(),
    base
      .clone()
      .resize(300, 300, { fit: "cover", position: "centre" })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer(),
  ])
  return { grand, vignette }
}
