import { isValidIdentifiant, placeholderIdentifiant, TYPES_IDENTIFIANT, type TypeIdentifiant } from '@/lib/identification-animal'
import { ORIENTATIONS_PRODUCTION, type OrientationProduction } from '@/lib/validations/elevage-animal'
// La normalisation du sexe est partagée avec le schéma d'écriture : source unique.
export { normaliserSexe } from '@/lib/elevage/sexe'
import { normaliserSexe } from '@/lib/elevage/sexe'

/**
 * Import CSV de troupeau — parsing et normalisation.
 *
 * Leçon du 2026-08-06 (import réel de 99 ovins) : le modèle public
 * `public/csv-templates/animaux.csv` portait des en-têtes camelCase
 * (`dateNaissance`…) alors que ce module n'acceptait que le snake_case ;
 * les colonnes non reconnues étaient vidées sans avertissement. Règles
 * depuis : les en-têtes sont comparés sous forme canonique (minuscules,
 * sans accents ni séparateurs), les colonnes inconnues sont REMONTÉES à
 * l'utilisateur, et aucune valeur fournie n'est écartée en silence — une
 * valeur invalide bloque la ligne avec un message qui cite la valeur.
 */

export const ANIMAUX_CSV_COLUMNS = [
  'espece', 'identifiant', 'type_identifiant', 'nom', 'race', 'sexe',
  'date_naissance', 'date_arrivee', 'provenance', 'orientation',
  'prix_achat', 'poids_kg', 'notes',
] as const

export type AnimalCsvColumn = (typeof ANIMAUX_CSV_COLUMNS)[number]
export type AnimalCsvRow = Record<AnimalCsvColumn, string>

/** Forme canonique pour comparer en-têtes et libellés : minuscules, sans accents ni ponctuation. */
export const cleCanonique = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

// `cleCanonique` gomme underscores et casse : `date_naissance` et `dateNaissance`
// convergent d'eux-mêmes. Ne restent ici que les synonymes réels.
const ALIAS_ENTETES: Record<string, AnimalCsvColumn> = {
  orientationproduction: 'orientation',
  prix: 'prix_achat',
  prixdachat: 'prix_achat',
  poids: 'poids_kg',
}
for (const colonne of ANIMAUX_CSV_COLUMNS) ALIAS_ENTETES[cleCanonique(colonne)] = colonne

function parseLine(line: string, separator: string): string[] {
  const values: string[] = []
  let value = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i++ }
      else quoted = !quoted
    } else if (char === separator && !quoted) {
      values.push(value.trim()); value = ''
    } else value += char
  }
  if (quoted) throw new Error('Guillemet non ferme dans le fichier CSV')
  values.push(value.trim())
  return values
}

export type AnimauxCsvParse = {
  rows: AnimalCsvRow[]
  /** En-têtes présents dans le fichier mais inconnus : leurs colonnes ne seront PAS importées. */
  entetesIgnores: string[]
}

export function parseAnimauxCsv(content: string): AnimauxCsvParse {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) throw new Error('Le fichier doit contenir un en-tete et au moins une ligne')
  const separator = ([';', ',', '\t'] as const)
    .map((sep) => ({ sep, n: lines[0].split(sep).length - 1 }))
    .sort((a, b) => b.n - a.n)[0].sep
  const headersBruts = parseLine(lines[0], separator)
  const mapping = headersBruts.map((h) => ALIAS_ENTETES[cleCanonique(h)])
  if (!mapping.includes('espece')) throw new Error('La colonne obligatoire « espece » est absente')
  const entetesIgnores = headersBruts.filter((h, i) => h && !mapping[i])
  const indexParColonne = new Map<AnimalCsvColumn, number>()
  mapping.forEach((colonne, i) => { if (colonne && !indexParColonne.has(colonne)) indexParColonne.set(colonne, i) })
  const rows = lines.slice(1).map((line) => {
    const cells = parseLine(line, separator)
    return Object.fromEntries(ANIMAUX_CSV_COLUMNS.map((colonne) => {
      const index = indexParColonne.get(colonne)
      return [colonne, index === undefined ? '' : (cells[index]?.trim() ?? '')]
    })) as AnimalCsvRow
  })
  return { rows, entetesIgnores }
}

/**
 * Date CSV → ISO `AAAA-MM-JJ`. Formats acceptés : ISO, `JJ/MM/AAAA`,
 * année seule `AAAA` (⇒ 1er janvier, usage courant des registres ovins).
 * Renvoie `null` si vide, `undefined` si invalide.
 */
export function parseDateCsv(value: string): string | null | undefined {
  const v = value.trim()
  if (!v) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const fr = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (fr) return `${fr[3]}-${fr[2].padStart(2, '0')}-${fr[1].padStart(2, '0')}`
  if (/^\d{4}$/.test(v)) return `${v}-01-01`
  return undefined
}

/** Type d'identifiant CSV → valeur canonique (`IPG Ovin` → `IPG ovin`). `undefined` si inconnu. */
export function normaliserTypeIdentifiant(value: string): TypeIdentifiant | null | undefined {
  if (!value.trim()) return null
  const k = cleCanonique(value)
  return TYPES_IDENTIFIANT.find((t) => cleCanonique(t) === k)
}

/** Orientation de production CSV → valeur canonique. `undefined` si inconnue. */
export function normaliserOrientation(value: string): OrientationProduction | null | undefined {
  if (!value.trim()) return null
  const k = cleCanonique(value)
  return ORIENTATIONS_PRODUCTION.find((o) => cleCanonique(o) === k)
}

const numberOrNull = (value: string) => {
  if (!value) return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

export type EspeceOption = { id: string; nom: string }

/**
 * Résout la valeur de la colonne `espece` : identifiant Gleba ou nom, sans
 * sensibilité à la casse, aux accents ni à la ponctuation résiduelle (un
 * point final collé depuis une phrase a déjà bloqué un import entier).
 */
export function resoudreEspece(especes: EspeceOption[], value: string): EspeceOption | undefined {
  const k = cleCanonique(value)
  if (!k) return undefined
  return especes.find((e) => cleCanonique(e.id) === k || cleCanonique(e.nom) === k)
}

/** Suggestion pour une espèce non résolue : inclusion canonique dans un sens ou l'autre. */
export function suggererEspece(especes: EspeceOption[], value: string): EspeceOption | undefined {
  const k = cleCanonique(value)
  if (k.length < 3) return undefined
  return especes.find((e) => {
    const nom = cleCanonique(e.nom)
    const id = cleCanonique(e.id)
    return nom.includes(k) || k.includes(nom) || id.includes(k) || k.includes(id)
  })
}

const ANNEE_MIN = 1990
const anneePlausible = (iso: string) => {
  const annee = Number(iso.slice(0, 4))
  return annee >= ANNEE_MIN && annee <= new Date().getFullYear() + 1
}

/**
 * Problèmes intrinsèques d'une ligne (hors contexte espèce/doublons, gérés
 * par l'appelant). Chaque message cite la valeur fautive.
 */
export function problemesLigne(row: AnimalCsvRow): string[] {
  const problemes: string[] = []
  if (row.sexe && normaliserSexe(row.sexe) === undefined) {
    problemes.push(`sexe « ${row.sexe} » non reconnu (femelle, male ou inconnu)`)
  }
  const type = normaliserTypeIdentifiant(row.type_identifiant)
  if (row.type_identifiant && type === undefined) {
    problemes.push(`type d'identifiant « ${row.type_identifiant} » inconnu (attendu : ${TYPES_IDENTIFIANT.join(', ')})`)
  }
  if (type && row.identifiant && !isValidIdentifiant(row.identifiant, type)) {
    problemes.push(`identifiant « ${row.identifiant} » invalide pour ${type} (${placeholderIdentifiant(type)})`)
  }
  if (row.orientation && normaliserOrientation(row.orientation) === undefined) {
    problemes.push(`orientation « ${row.orientation} » inconnue (${ORIENTATIONS_PRODUCTION.join(', ')})`)
  }
  for (const [label, valeur] of [['date de naissance', row.date_naissance], ["date d'arrivée", row.date_arrivee]] as const) {
    if (!valeur) continue
    const iso = parseDateCsv(valeur)
    if (iso === undefined) problemes.push(`${label} « ${valeur} » illisible (attendu AAAA-MM-JJ, JJ/MM/AAAA ou année seule)`)
    else if (iso && !anneePlausible(iso)) problemes.push(`${label} « ${valeur} » hors bornes (année entre ${ANNEE_MIN} et ${new Date().getFullYear() + 1})`)
  }
  for (const [label, valeur] of [['prix', row.prix_achat], ['poids', row.poids_kg]] as const) {
    if (valeur && !Number.isFinite(Number(valeur.replace(',', '.')))) problemes.push(`${label} « ${valeur} » invalide`)
  }
  return problemes
}

export type ImportOptions = { orientationParDefaut?: OrientationProduction | null }

/** Payload de CRÉATION (POST /api/elevage/animaux). Suppose la ligne validée par `problemesLigne`. */
export function csvRowToAnimal(row: AnimalCsvRow, especeAnimaleId: string, options: ImportOptions = {}) {
  return {
    especeAnimaleId,
    identifiant: row.identifiant || null,
    typeIdentifiant: normaliserTypeIdentifiant(row.type_identifiant) ?? null,
    nom: row.nom || null,
    race: row.race || null,
    sexe: normaliserSexe(row.sexe) ?? null,
    dateNaissance: parseDateCsv(row.date_naissance) ?? null,
    dateArrivee: parseDateCsv(row.date_arrivee) || undefined,
    provenance: row.provenance || null,
    orientationProduction: normaliserOrientation(row.orientation) ?? options.orientationParDefaut ?? null,
    prixAchat: numberOrNull(row.prix_achat),
    poidsActuel: numberOrNull(row.poids_kg),
    notes: row.notes || null,
    statut: 'actif',
  }
}

/**
 * Appariement des identifiants encore MASQUÉS (2026-08-07).
 *
 * Un troupeau importé depuis un export partiel peut porter des identifiants
 * tronqués du type `XXXXXX61010` : le masque cache le préfixe et conserve les
 * derniers chiffres. Cas mesuré : 66 animaux sur 99, l'éleveur invité à
 * re-verser son fichier complet en mode « mettre à jour ». Or l'appariement se
 * fait sur l'identifiant : `FR…61010` ne correspondait à `XXXXXX61010` pour
 * aucune clé, donc les 66 lignes repartaient en CRÉATION et l'éleveur se
 * retrouvait avec 165 animaux au lieu de 99 complétés — l'aperçu annonçant
 * « 66 à créer » sans signaler l'anomalie.
 *
 * Règle retenue : on rattache par le suffixe de chiffres, et UNIQUEMENT quand il
 * désigne un seul animal. Un suffixe ambigu n'apparie rien — mieux vaut une
 * création signalée qu'une donnée écrite sur le mauvais animal.
 */
export const LONGUEUR_MIN_SUFFIXE_MASQUE = 4

const EST_MASQUE = /xxx/

/** `XXXXXX61010` → `61010`. `null` si non masqué ou suffixe trop court. */
export function suffixeIdentifiantMasque(identifiant: string | null | undefined): string | null {
  if (!identifiant) return null
  const cle = cleCanonique(identifiant)
  if (!EST_MASQUE.test(cle)) return null
  const suffixe = /(\d+)$/.exec(cle)?.[1] ?? ''
  return suffixe.length >= LONGUEUR_MIN_SUFFIXE_MASQUE ? suffixe : null
}

export type IdentifiantMasque = { id: number; identifiant: string; suffixe: string }

/**
 * Index des animaux à identifiant masqué. Les suffixes partagés par plusieurs
 * animaux sont écartés : ils ne peuvent pas désigner une cible unique.
 */
export function indexerIdentifiantsMasques(
  animaux: Array<{ id: number; identifiant: string | null }>
): IdentifiantMasque[] {
  const entrees: IdentifiantMasque[] = []
  for (const animal of animaux) {
    const suffixe = suffixeIdentifiantMasque(animal.identifiant)
    if (suffixe) entrees.push({ id: animal.id, identifiant: animal.identifiant!, suffixe })
  }
  const occurrences = new Map<string, number>()
  for (const e of entrees) occurrences.set(e.suffixe, (occurrences.get(e.suffixe) ?? 0) + 1)
  return entrees.filter((e) => occurrences.get(e.suffixe) === 1)
}

/**
 * Identifiant complet du CSV → animal dont l'identifiant est encore masqué.
 * `null` si aucun candidat, ou si plusieurs suffixes conviennent.
 */
export function apparierIdentifiantMasque(
  identifiantCsv: string,
  masques: IdentifiantMasque[]
): IdentifiantMasque | null {
  const cle = cleCanonique(identifiantCsv)
  if (!cle || EST_MASQUE.test(cle)) return null
  const candidats = masques.filter((m) => cle.endsWith(m.suffixe))
  return candidats.length === 1 ? candidats[0] : null
}

/**
 * Payload de MISE À JOUR (PATCH /api/elevage/animaux) : seules les cellules
 * renseignées sont envoyées — une cellule vide n'écrase JAMAIS une donnée
 * existante. L'espèce n'est volontairement pas modifiable par ce chemin.
 *
 * `completerIdentifiant` n'est vrai que pour un rattachement par suffixe
 * masqué : c'est le seul cas où l'import a le droit de RÉÉCRIRE l'identifiant,
 * puisque c'est précisément ce que l'éleveur vient compléter. Une mise à jour
 * ordinaire ne touche jamais à l'identité de l'animal.
 */
export function csvRowToAnimalUpdate(
  row: AnimalCsvRow,
  animalId: number,
  options: { completerIdentifiant?: boolean } = {}
) {
  const payload: Record<string, unknown> = { id: animalId }
  if (options.completerIdentifiant && row.identifiant) payload.identifiant = row.identifiant
  if (row.nom) payload.nom = row.nom
  if (row.race) payload.race = row.race
  if (row.sexe) payload.sexe = normaliserSexe(row.sexe)
  if (row.type_identifiant) payload.typeIdentifiant = normaliserTypeIdentifiant(row.type_identifiant)
  if (row.date_naissance) payload.dateNaissance = parseDateCsv(row.date_naissance)
  if (row.date_arrivee) payload.dateArrivee = parseDateCsv(row.date_arrivee)
  if (row.provenance) payload.provenance = row.provenance
  if (row.orientation) payload.orientationProduction = normaliserOrientation(row.orientation)
  if (row.prix_achat) payload.prixAchat = numberOrNull(row.prix_achat)
  if (row.poids_kg) payload.poidsActuel = numberOrNull(row.poids_kg)
  if (row.notes) payload.notes = row.notes
  return payload
}
