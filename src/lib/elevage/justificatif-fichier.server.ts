import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { URL_FICHIER_JUSTIFICATIF } from "./fichier-justificatif"

const MAX_BYTES = 10 * 1024 * 1024

export class ErreurFichierJustificatif extends Error {}

export async function verifierFichierJustificatif(
  userId: string,
  fichierUrl: string,
): Promise<{ tailleOctets: number; empreinteSha256: string }> {
  if (!URL_FICHIER_JUSTIFICATIF.test(fichierUrl)) {
    throw new ErreurFichierJustificatif("Référence de fichier invalide")
  }
  const filename = fichierUrl.slice(fichierUrl.lastIndexOf("/") + 1)
  let contenu: Buffer
  try {
    contenu = await readFile(
      path.join(process.cwd(), "storage", "justificatifs", userId, filename),
    )
  } catch {
    throw new ErreurFichierJustificatif(
      "Le fichier téléversé est introuvable pour ce compte",
    )
  }
  if (contenu.byteLength > MAX_BYTES) {
    throw new ErreurFichierJustificatif("Le fichier dépasse la taille maximale")
  }
  return {
    tailleOctets: contenu.byteLength,
    empreinteSha256: createHash("sha256").update(contenu).digest("hex"),
  }
}
