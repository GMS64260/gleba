import { createHash } from 'node:crypto'
import { ErreurReglement, lireMontant } from '../monnaie'
export interface LigneReleve {
  date: Date
  libelle: string
  montantCentimes: number
  reference: string
}
function normaliser(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}
function cellules(texte: string, separateur: string) {
  const lignes: string[][] = []
  let ligne: string[] = [],
    cellule = '',
    guillemets = false
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i]
    if (c === '"') {
      if (guillemets && texte[i + 1] === '"') {
        cellule += '"'
        i++
      } else guillemets = !guillemets
    } else if (!guillemets && c === separateur) {
      ligne.push(cellule)
      cellule = ''
    } else if (!guillemets && (c === '\n' || c === '\r')) {
      if (c === '\r' && texte[i + 1] === '\n') i++
      ligne.push(cellule)
      if (ligne.some((v) => v.trim())) lignes.push(ligne)
      ligne = []
      cellule = ''
    } else cellule += c
    if (cellule.length > 10000 || lignes.length > 5000)
      throw new ErreurReglement('Relevé trop volumineux : 5 000 lignes maximum.', 400)
  }
  if (guillemets) throw new ErreurReglement('Guillemets non fermés dans le relevé.', 400)
  ligne.push(cellule)
  if (ligne.some((v) => v.trim())) lignes.push(ligne)
  return lignes
}
function lireDate(s: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  const f = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim())
  if (!m && !f) throw new ErreurReglement('Date attendue au format AAAA-MM-JJ ou JJ/MM/AAAA.', 400)
  const an = Number(m?.[1] ?? f![3]),
    mois = Number(m?.[2] ?? f![2]),
    jour = Number(m?.[3] ?? f![1])
  const date = new Date(Date.UTC(an, mois - 1, jour, 12))
  if (
    an < 1990 ||
    an > 2200 ||
    date.getUTCFullYear() !== an ||
    date.getUTCMonth() + 1 !== mois ||
    date.getUTCDate() !== jour
  )
    throw new ErreurReglement('Date bancaire invalide.', 400)
  return date
}
export function lireReleveCsv(texte: string): LigneReleve[] {
  if (Buffer.byteLength(texte, 'utf8') > 1_000_000)
    throw new ErreurReglement('Le relevé doit faire moins de 1 Mo.', 413)
  texte = texte.replace(/^\uFEFF/, '')
  const entete = texte.split(/\r?\n/, 1)[0] ?? ''
  const sep = entete.includes(';') ? ';' : entete.includes('\t') ? '\t' : ','
  const rows = cellules(texte, sep)
  const noms = (rows.shift() ?? []).map(normaliser)
  const trouver = (...aliases: string[]) => noms.findIndex((v) => aliases.includes(v))
  const date = trouver('date', 'dateoperation', 'datecomptable'),
    libelle = trouver('libelle', 'description', 'libelleoperation')
  const montant = trouver('montant', 'amount'),
    debit = trouver('debit'),
    credit = trouver('credit')
  const ref = trouver('reference', 'id', 'identifiant', 'referenceoperation')
  if (date < 0 || libelle < 0 || (montant < 0 && (debit < 0 || credit < 0)))
    throw new ErreurReglement(
      'Colonnes requises : Date, Libellé, Montant (ou Débit et Crédit). Référence est facultative.',
      400,
    )
  if (!rows.length || rows.length > 5000)
    throw new ErreurReglement('Le relevé doit contenir de 1 à 5 000 opérations.', 400)
  const repetitions = new Map<string, number>()
  const references = new Map<string, string>()
  return rows.map((row, index) => {
    try {
      if (row.length !== noms.length)
        throw new ErreurReglement('Nombre de colonnes incorrect.', 400)
      const d = lireDate(row[date])
      const label = row[libelle].trim()
      if (!label || label.length > 500)
        throw new ErreurReglement('Libellé requis, 500 caractères maximum.', 400)
      let cents: number
      if (montant >= 0) cents = lireMontant(row[montant])
      else {
        const deb = row[debit].trim() ? lireMontant(row[debit]) : 0,
          cred = row[credit].trim() ? lireMontant(row[credit]) : 0
        if (deb < 0 || cred < 0 || (deb > 0 && cred > 0))
          throw new ErreurReglement('Une seule colonne Débit ou Crédit positive est attendue.', 400)
        cents = cred - deb
      }
      if (!cents) throw new ErreurReglement('Montant nul.', 400)
      const empreinte = createHash('sha256')
        .update(JSON.stringify([d.toISOString(), label, cents]))
        .digest('hex')
      const occurrence = (repetitions.get(empreinte) ?? 0) + 1
      repetitions.set(empreinte, occurrence)
      const reference =
        ref >= 0 && row[ref].trim() ? row[ref].trim() : 'csv:' + empreinte + ':' + occurrence
      if (reference.length > 200) throw new ErreurReglement('Référence trop longue.', 400)
      if (references.has(reference))
        throw new ErreurReglement('Référence répétée dans ce fichier.', 400)
      references.set(reference, empreinte)
      return { date: d, libelle: label, montantCentimes: cents, reference }
    } catch (e) {
      if (e instanceof ErreurReglement)
        throw new ErreurReglement('Ligne ' + (index + 2) + ' : ' + e.message, e.status)
      throw e
    }
  })
}
