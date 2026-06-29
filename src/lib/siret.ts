/**
 * Validation et utilitaires SIRET / SIREN / TVA intracommunautaire.
 *
 * - SIREN : 9 chiffres, contrôle par algorithme de Luhn.
 * - SIRET : 14 chiffres (SIREN + NIC), contrôle par algorithme de Luhn.
 *   Cas particulier La Poste (SIREN 356000000) : exempté du Luhn,
 *   chaque SIRET doit avoir la somme de ses chiffres divisible par 5.
 * - TVA FR : "FR" + clé(2 chiffres) + SIREN. Clé = (12 + 3 × (SIREN % 97)) % 97.
 */

const SIREN_LA_POSTE = '356000000'

/** Calcul de Luhn sur une chaîne de chiffres. Retourne true si la somme % 10 === 0. */
function luhn(digits: string): boolean {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let n = parseInt(digits[digits.length - 1 - i], 10)
    if (i % 2 === 1) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
  }
  return sum % 10 === 0
}

/** Valide un SIREN (9 chiffres + Luhn). */
export function isValidSiren(value: string | null | undefined): boolean {
  if (!value) return false
  const clean = value.replace(/\s+/g, '')
  if (!/^\d{9}$/.test(clean)) return false
  return luhn(clean)
}

/** Valide un SIRET (14 chiffres + Luhn ou cas La Poste). */
export function isValidSiret(value: string | null | undefined): boolean {
  if (!value) return false
  const clean = value.replace(/\s+/g, '')
  if (!/^\d{14}$/.test(clean)) return false

  const siren = clean.substring(0, 9)
  if (siren === SIREN_LA_POSTE) {
    // La Poste : somme des chiffres divisible par 5
    const sum = clean.split('').reduce((s, d) => s + parseInt(d, 10), 0)
    return sum % 5 === 0
  }
  return luhn(clean)
}

/** Extrait le SIREN (9 premiers chiffres) d'un SIRET. Suppose le SIRET déjà validé. */
export function sirenFromSiret(siret: string): string {
  return siret.replace(/\s+/g, '').substring(0, 9)
}

/** Calcule le numéro de TVA intracommunautaire FR depuis un SIREN. */
export function tvaIntracomFromSiren(siren: string): string {
  const clean = siren.replace(/\s+/g, '')
  if (!/^\d{9}$/.test(clean)) return ''
  const key = (12 + 3 * (parseInt(clean, 10) % 97)) % 97
  return `FR${key.toString().padStart(2, '0')}${clean}`
}

/** Format d'affichage SIRET "XXX XXX XXX XXXXX". */
export function formatSiret(siret: string): string {
  const clean = siret.replace(/\s+/g, '')
  if (clean.length !== 14) return siret
  return `${clean.substring(0, 3)} ${clean.substring(3, 6)} ${clean.substring(6, 9)} ${clean.substring(9, 14)}`
}

/** Format d'affichage SIREN "XXX XXX XXX". */
export function formatSiren(siren: string): string {
  const clean = siren.replace(/\s+/g, '')
  if (clean.length !== 9) return siren
  return `${clean.substring(0, 3)} ${clean.substring(3, 6)} ${clean.substring(6, 9)}`
}

/** Valide un numéro de TVA intracommunautaire FR. */
export function isValidTvaIntracomFr(value: string | null | undefined): boolean {
  if (!value) return false
  const clean = value.replace(/\s+/g, '').toUpperCase()
  if (!/^FR\d{11}$/.test(clean)) return false
  const key = parseInt(clean.substring(2, 4), 10)
  const siren = clean.substring(4)
  if (!isValidSiren(siren)) return false
  return key === (12 + 3 * (parseInt(siren, 10) % 97)) % 97
}

// ============================================================
// Identifiants des territoires d'outre-mer (hors système SIRENE)
// ============================================================

/**
 * Valide un numéro RIDET (Nouvelle-Calédonie).
 * Le RIDET identifie un établissement : numéro Ridet de l'entreprise (6 à 7
 * chiffres) suivi éventuellement d'un suffixe établissement de 3 chiffres,
 * souvent noté « 0858878.004 ». Il n'y a pas de clé de contrôle publique
 * normalisée : on valide donc uniquement le format (6 à 10 chiffres).
 */
export function isValidRidet(value: string | null | undefined): boolean {
  if (!value) return false
  const clean = value.replace(/[\s.]/g, '')
  return /^\d{6,10}$/.test(clean)
}

/** Format d'affichage RIDET « 0858878.004 » (base . établissement). */
export function formatRidet(value: string): string {
  const clean = value.replace(/[\s.]/g, '')
  if (clean.length >= 9) {
    return `${clean.substring(0, clean.length - 3)}.${clean.slice(-3)}`
  }
  return clean
}

/**
 * Valide un numéro Tahiti (Polynésie française).
 * Le « N° Tahiti » est un identifiant à 6 chiffres, parfois suivi d'une lettre
 * clé. Pas de checksum public : validation de format uniquement.
 */
export function isValidNumeroTahiti(value: string | null | undefined): boolean {
  if (!value) return false
  const clean = value.replace(/\s/g, '').toUpperCase()
  return /^\d{6}[A-Z]?$/.test(clean)
}
