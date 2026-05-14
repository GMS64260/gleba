/**
 * DEV2 audit Larcher - P1 #5
 * Validation IBAN (Bank Account Number international, ISO 13616).
 *
 * Algorithme :
 *   1. Retirer les espaces et passer en majuscules.
 *   2. Vérifier longueur (variable selon pays — 27 pour FR).
 *   3. Déplacer les 4 premiers chars à la fin (XX## → ...XX##).
 *   4. Convertir les lettres en chiffres (A=10, B=11, ..., Z=35).
 *   5. Calculer modulo 97. Doit valoir 1 pour être valide.
 *
 * Validation BIC : 8 ou 11 caractères, format AAAA-BB-LL[-BBB].
 *   - AAAA = code banque (lettres)
 *   - BB   = code pays ISO 3166 (lettres)
 *   - LL   = code emplacement
 *   - BBB  = code branche optionnel
 */

const IBAN_LENGTHS: Record<string, number> = {
  FR: 27, BE: 16, DE: 22, ES: 24, IT: 27, NL: 18, LU: 20, PT: 25,
  IE: 22, AT: 20, FI: 18, MC: 27, AD: 24, GB: 22, CH: 21,
}

/**
 * Valide un IBAN par contrôle modulo 97.
 * Tolère les espaces et la casse.
 */
export function isValidIban(value: string | null | undefined): boolean {
  if (!value) return false
  const clean = value.replace(/\s+/g, '').toUpperCase()
  // Format général : 2 lettres pays + 2 chiffres clé + reste (alphanum)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(clean)) return false
  const country = clean.substring(0, 2)
  const expectedLen = IBAN_LENGTHS[country]
  if (expectedLen && clean.length !== expectedLen) return false

  // Réarrangement : 4 premiers chars à la fin
  const rearranged = clean.substring(4) + clean.substring(0, 4)
  // Conversion lettres → chiffres (A=10, B=11, ...)
  let numeric = ''
  for (const c of rearranged) {
    if (c >= 'A' && c <= 'Z') {
      numeric += (c.charCodeAt(0) - 55).toString() // A(65)→10, Z(90)→35
    } else {
      numeric += c
    }
  }
  // Modulo 97 sur grande chaîne — décomposé en blocs pour éviter overflow
  let remainder = 0
  for (let i = 0; i < numeric.length; i += 9) {
    const chunk = (remainder.toString() + numeric.substring(i, i + 9))
    remainder = parseInt(chunk, 10) % 97
  }
  return remainder === 1
}

/** Valide un BIC (SWIFT) 8 ou 11 caractères. */
export function isValidBic(value: string | null | undefined): boolean {
  if (!value) return false
  const clean = value.replace(/\s+/g, '').toUpperCase()
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(clean)
}

/** Formate un IBAN par groupes de 4 (lecture humaine). */
export function formatIban(iban: string | null | undefined): string {
  if (!iban) return ''
  const clean = iban.replace(/\s+/g, '').toUpperCase()
  return clean.replace(/(.{4})/g, '$1 ').trim()
}

/**
 * Types canoniques de fournisseur (audit Larcher : remplacer "Mixte" par
 * défaut par un typage métier précis).
 */
export const FOURNISSEUR_TYPES = [
  'Semencier',
  'Aliment',
  'Animal',
  'Materiel',
  'Phyto',
  'Engrais',
  'Service',
  'Mixte',
] as const

export type FournisseurType = (typeof FOURNISSEUR_TYPES)[number]
