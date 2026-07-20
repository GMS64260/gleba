import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

export type StoredReferentielImage = {
  url: string;
  miniatureUrl: string;
  absolutePaths: string[];
};

export function verifierTailleImage(size: number) {
  if (size <= 0 || size > MAX_SOURCE_BYTES) {
    throw new Error("IMAGE_SIZE");
  }
}

export async function stockerImageReferentiel(buffer: Buffer, source: "membre" | "commons"): Promise<StoredReferentielImage> {
  verifierTailleImage(buffer.length);
  const relativeDir = path.join("uploads", "referentiel", source);
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);
  await mkdir(absoluteDir, { recursive: true });

  const id = randomUUID();
  const largeName = `${id}-1200.jpg`;
  const thumbName = `${id}-360.jpg`;
  const largePath = path.join(absoluteDir, largeName);
  const thumbPath = path.join(absoluteDir, thumbName);

  const image = sharp(buffer, { failOn: "warning" }).rotate();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height || metadata.width < 300 || metadata.height < 300) {
    throw new Error("IMAGE_DIMENSIONS");
  }

  const [large, thumb] = await Promise.all([
    image.clone().resize(1200, 1200, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 84, mozjpeg: true }).toBuffer(),
    image.clone().resize(360, 360, { fit: "cover", position: "centre" }).jpeg({ quality: 80, mozjpeg: true }).toBuffer(),
  ]);
  await Promise.all([writeFile(largePath, large), writeFile(thumbPath, thumb)]);

  return {
    url: `/${relativeDir}/${largeName}`.replaceAll("\\", "/"),
    miniatureUrl: `/${relativeDir}/${thumbName}`.replaceAll("\\", "/"),
    absolutePaths: [largePath, thumbPath],
  };
}

export async function supprimerImagesStockees(paths: string[]) {
  await Promise.all(paths.map((file) => unlink(file).catch(() => undefined)));
}

