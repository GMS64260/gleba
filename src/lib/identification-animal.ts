/**
 * Validation des identifiants animaux selon le type (PROMPT 19A).
 *
 * Sources :
 * - BDNI bovin : FR + 2 chiffres département + 8 chiffres = 14 caractères
 *   (instruction technique DGAL/SDSPA/2018-528). Le code pays peut être
 *   omis dans l'usage courant — on accepte les deux.
 * - IPG ovin/caprin : "FR" + indicatif de marquage de l'exploitation
 *   (6 chiffres, attribué par l'EDE) + numéro d'ordre (5 chiffres), soit
 *   FR + 11 chiffres (arrêté du 19 décembre 2005, animaux nés après le
 *   09/07/2005). L'ancien motif FR + 12 chiffres reste toléré pour les
 *   identifiants historiques déjà saisis.
 * - IPG porcin : tatouage à l'oreille (5 chiffres) ou identifiant
 *   éleveur structuré : "FR" + 7 chiffres exploitation + 5 chiffres
 *   animal (notes DGAL). Accepte tatouage 5 chiffres en fallback.
 * - SIRE équin : UELN 15 caractères (250 + 12 chiffres pour les chevaux
 *   nés en France), ou n° SIRE 8 chiffres. La grande majorité des chevaux
 *   FR enregistrés ont une UELN commençant par 250.
 */

export const TYPES_IDENTIFIANT = [
  'BDNI bovin',
  'IPG ovin',
  'IPG caprin',
  'IPG porcin',
  'SIRE équin',
  'Bague volière',
  'Boucle aux.',
  'Puce RFID',
  'Auxiliaire éleveur',
] as const

export type TypeIdentifiant = (typeof TYPES_IDENTIFIANT)[number]

const PATTERNS: Record<TypeIdentifiant, RegExp> = {
  // Bovin : "FR" optionnel + 10 chiffres (dpt 2 + 8) — accepte aussi
  // les anciens identifiants nationaux à 10 chiffres
  'BDNI bovin': /^(FR)?\d{10}$/i,
  // Ovin : FR + 11 chiffres (indicatif 6 + ordre 5) ; 12 toléré (historique)
  'IPG ovin': /^FR\d{11,12}$/i,
  // Caprin : même format qu'ovin
  'IPG caprin': /^FR\d{11,12}$/i,
  // Porcin : FR + 12 chiffres OU tatouage 5 chiffres
  'IPG porcin': /^(FR\d{12}|\d{5})$/i,
  // Équin SIRE : UELN 15 chiffres ou n° SIRE 8 chiffres
  'SIRE équin': /^(250\d{12}|\d{8})$/,
  // Volaille : bague — texte court alphanumérique
  'Bague volière': /^[A-Z0-9-]{3,20}$/i,
  // Boucle auxiliaire : alphanumérique libre court
  'Boucle aux.': /^[A-Z0-9-]{3,30}$/i,
  // Puce RFID ISO 11784 : 15 chiffres (3 pays + 12 ID)
  'Puce RFID': /^\d{15}$/,
  // Identifiant interne éleveur : libre
  'Auxiliaire éleveur': /^.{1,50}$/,
}

export function isValidIdentifiant(value: string | null | undefined, type: TypeIdentifiant | null | undefined): boolean {
  if (!type || !value) return true // pas de type ⇒ pas de validation forte
  const clean = value.replace(/\s+/g, '')
  const re = PATTERNS[type]
  if (!re) return true
  return re.test(clean)
}

/** Label affiché à côté de l'input pour aider à la saisie. */
export function placeholderIdentifiant(type: TypeIdentifiant | null | undefined): string {
  switch (type) {
    case 'BDNI bovin':
      return 'FR + 10 chiffres (ex: FR2412345678)'
    case 'IPG ovin':
    case 'IPG caprin':
      return 'FR + 11 chiffres (ex: FR64123412345)'
    case 'IPG porcin':
      return 'FR+12 chiffres ou tatouage 5 chiffres'
    case 'SIRE équin':
      return 'UELN 15 chiffres (250...) ou n° SIRE 8 chiffres'
    case 'Bague volière':
      return 'ex: AB-2026-001'
    case 'Boucle aux.':
      return 'Identifiant secondaire'
    case 'Puce RFID':
      return '15 chiffres (ISO 11784)'
    case 'Auxiliaire éleveur':
      return 'Identifiant interne libre'
    default:
      return ''
  }
}
