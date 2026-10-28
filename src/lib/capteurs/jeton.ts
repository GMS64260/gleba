/**
 * Jeton d'ingestion d'un connecteur : `glc_` + 48 caractères hexadécimaux
 * (192 bits). Montré une seule fois à sa création ; la base n'en garde que
 * l'empreinte SHA-256 et le début, pour le reconnaître à l'écran. À la
 * différence de `User.apiToken`, resté en clair (vault Gleba-technique).
 */
import { createHash, randomBytes } from "crypto"

const PREFIXE = "glc_"

export function genererJeton(): { jeton: string; hash: string; prefixe: string } {
  const jeton = PREFIXE + randomBytes(24).toString("hex")
  return { jeton, hash: hacherJeton(jeton), prefixe: jeton.slice(0, PREFIXE.length + 8) }
}

export function hacherJeton(jeton: string): string {
  return createHash("sha256").update(jeton, "utf8").digest("hex")
}

/** Jeton porté par `Authorization: Bearer glc_…`, ou null s'il a une autre forme. */
export function lireJetonBearer(entete: string | null): string | null {
  if (!entete) return null
  const m = /^Bearer\s+(glc_[0-9a-f]{48})\s*$/i.exec(entete)
  return m ? m[1].toLowerCase() : null
}
