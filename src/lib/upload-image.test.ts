import { describe, expect, it } from "vitest"
import sharp from "sharp"
import { formatsPhotoSansMetadonnees } from "./upload-image"

describe("photo envoyée : aucune métadonnée de l'original ne sort (revue du 2026-11-11)", () => {
  it("retire la position GPS et l'auteur des deux formats, 1200 et 300", async () => {
    const original = await sharp({ create: { width: 1600, height: 900, channels: 3, background: "#4c7259" } })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Artist: "Auteur fictif" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "45/1 0/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "2/1 0/1 0/1" } } })
      .toBuffer()
    // Témoin : l'image d'essai porte bien des EXIF, sinon le test ne prouverait rien.
    const exifOriginal = (await sharp(original).metadata()).exif
    expect(exifOriginal?.includes(Buffer.from("Auteur fictif"))).toBe(true)

    const { grand, vignette } = await formatsPhotoSansMetadonnees(original)
    for (const sortie of [grand, vignette]) {
      const meta = await sharp(sortie).metadata()
      expect(meta.format).toBe("jpeg")
      expect(meta.exif).toBeUndefined()
      expect(meta.xmp).toBeUndefined()
      expect(meta.iptc).toBeUndefined()
      expect(sortie.includes(Buffer.from("Auteur fictif"))).toBe(false)
    }
    expect((await sharp(grand).metadata()).width).toBe(1200)
    expect(await sharp(vignette).metadata()).toMatchObject({ width: 300, height: 300 })
  })

  it("applique l'orientation de l'appareil avant de la retirer", async () => {
    const couche = await sharp({ create: { width: 400, height: 200, channels: 3, background: "#ffffff" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer()
    const { grand } = await formatsPhotoSansMetadonnees(couche)
    const meta = await sharp(grand).metadata()
    expect([meta.width, meta.height]).toEqual([200, 400])
    expect(meta.orientation).toBeUndefined()
  })
})
