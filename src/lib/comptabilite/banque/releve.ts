import { createHash } from 'node:crypto'
import { ErreurReglement, lireMontant } from '../monnaie'
export interface LigneReleve {
  date: Date
  libelle: string
  montantCentimes: number
  reference: string
}
// Les exports bancaires commencent souvent par quelques lignes d'information
// (titulaire, compte, solde) avant la ligne d'en-tête.
const LIGNES_AVANT_ENTETE = 40
function normaliser(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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
  // Une heure éventuelle (export horodaté) est ignorée : seule la date compte.
  const texte = s
    .trim()
    .replace(/[ T]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/, '')
  const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(texte)
  const f = /^(\d{1,2})([/.-])(\d{1,2})\2(\d{4}|\d{2})$/.exec(texte)
  if (!m && !f) throw new ErreurReglement('Date attendue au format AAAA-MM-JJ ou JJ/MM/AAAA.', 400)
  const an = m ? Number(m[1]) : f![4].length === 2 ? 2000 + Number(f![4]) : Number(f![4]),
    mois = Number(m ? m[2] : f![3]),
    jour = Number(m ? m[3] : f![1])
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
// Montant tel que l'écrivent les banques et Excel : « +320,00 », « 45,60 € »,
// « 1.234,56 » ou « 1,234.56 ». Un séparateur de milliers n'est retiré que
// devant deux décimales explicites : « 1,234 » reste refusé (trois décimales).
function lireMontantReleve(valeur: string) {
  let texte = valeur
    .replace(/[\s  ]/g, '')
    .replace(/^(?:€|eur)/i, '')
    .replace(/(?:€|eur|euros?)$/i, '')
  if (/^\+\d/.test(texte)) texte = texte.slice(1)
  if (/^-?\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(texte)) texte = texte.replace(/\./g, '')
  else if (/^-?\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(texte)) texte = texte.replace(/,/g, '')
  return lireMontant(texte)
}
interface Colonnes {
  date: number
  libelle: number
  montant: number
  debit: number
  credit: number
  ref: number
}
function reperer(noms: string[]): Colonnes | null {
  const exact = (...aliases: string[]) => noms.findIndex((v) => aliases.includes(v))
  const motif = (...motifs: RegExp[]) => {
    for (const m of motifs) {
      const i = noms.findIndex((v) => m.test(v))
      if (i >= 0) return i
    }
    return -1
  }
  const sansUnite = (v: string) => v.replace(/(?:en)?(?:euros?|eur)$/, '')
  // Les noms historiques passent d'abord : un relevé déjà accepté garde les
  // mêmes colonnes, donc les mêmes références d'import (aucun doublon au rejeu).
  let date = exact('date', 'dateoperation', 'datecomptable')
  if (date < 0)
    date = motif(/^date(?:de)?l?operation/, /^date(?:de)?compta/, /^date(?!(?:de)?valeur)/)
  let libelle = exact('libelle', 'description', 'libelleoperation')
  if (libelle < 0) libelle = motif(/^libelle/, /^intitule/, /^detail/, /contrepartie/)
  let montant = exact('montant', 'amount'),
    debit = exact('debit'),
    credit = exact('credit')
  if (montant < 0 && (debit < 0 || credit < 0)) {
    // « Débit euros », « Crédit euros » (Crédit Agricole)…
    const d = noms.findIndex((v) => ['debit', 'debits'].includes(sansUnite(v)))
    const c = noms.findIndex((v) => ['credit', 'credits'].includes(sansUnite(v)))
    if (d >= 0 && c >= 0) {
      debit = d
      credit = c
    } else {
      // « Montant(EUROS) » plutôt que « Montant(FRANCS) » (La Banque Postale),
      // « Montant de l'opération » (Société Générale), « Montant operation » (BNP).
      const candidats = noms
        .map((v, i) => ({ v, i }))
        .filter(
          ({ v }) =>
            /^(?:montant|amount)/.test(v) && !/franc|frf|tva|vat|solde|devise|^montantht$/.test(v),
        )
      montant = (candidats.find(({ v }) => v.includes('eur')) ?? candidats[0])?.i ?? -1
    }
  }
  const ref = exact('reference', 'id', 'identifiant', 'referenceoperation')
  if (date < 0 || libelle < 0 || (montant < 0 && (debit < 0 || credit < 0))) return null
  return { date, libelle, montant, debit, credit, ref }
}
function trouverEntete(texte: string) {
  const premiere = texte.split(/\r?\n/, 1)[0] ?? ''
  const prefere = premiere.includes(';') ? ';' : premiere.includes('\t') ? '\t' : ','
  let erreurPreferee: unknown = null
  for (const sep of [prefere, ...[';', '\t', ','].filter((s) => s !== prefere)]) {
    let rows: string[][]
    try {
      rows = cellules(texte, sep)
    } catch (e) {
      if (sep === prefere) erreurPreferee = e
      continue
    }
    for (let i = 0; i < Math.min(rows.length, LIGNES_AVANT_ENTETE); i++) {
      const colonnes = reperer(rows[i].map(normaliser))
      if (colonnes) return { rows, entete: i, colonnes }
    }
  }
  if (erreurPreferee) throw erreurPreferee
  // Montrer ce qui a été lu aide l'utilisateur et le support à voir le défaut.
  const lignes = texte.split(/\r?\n/).filter((l) => l.trim())
  const apercu = (
    lignes.slice(0, LIGNES_AVANT_ENTETE).find((l) => /date/i.test(l)) ??
    lignes[0] ??
    ''
  )
    .trim()
    .slice(0, 120)
  throw new ErreurReglement(
    'Colonnes requises : Date, Libellé, Montant (ou Débit et Crédit). Référence est facultative.' +
      (texte.includes('�')
        ? ' Le fichier semble mal encodé : réenregistrez-le au format « CSV UTF-8 ».'
        : '') +
      (apercu ? ' En-tête lu : « ' + apercu + ' ».' : ''),
    400,
  )
}
export function lireReleveCsv(texte: string): LigneReleve[] {
  if (Buffer.byteLength(texte, 'utf8') > 1_000_000)
    throw new ErreurReglement('Le relevé doit faire moins de 1 Mo.', 413)
  texte = texte.replace(/^﻿/, '')
  const { rows, entete, colonnes } = trouverEntete(texte)
  const { date, libelle, montant, debit, credit, ref } = colonnes
  const largeur = rows[entete].length
  const montants = montant >= 0 ? [montant] : [debit, credit]
  const vide = (row: string[], i: number) => !(row[i] ?? '').trim()
  // Une ligne sans date ni montant (titre, total, ligne de séparation) n'est
  // pas une opération ; toute autre ligne illisible arrête l'import.
  const operations = rows
    .slice(entete + 1)
    .map((row, index) => ({ row, numero: entete + index + 2 }))
    .filter(({ row }) => !(vide(row, date) && montants.every((i) => vide(row, i))))
  if (!operations.length || operations.length > 5000)
    throw new ErreurReglement('Le relevé doit contenir de 1 à 5 000 opérations.', 400)
  const repetitions = new Map<string, number>()
  const references = new Map<string, string>()
  return operations.map(({ row: brute, numero }) => {
    try {
      // Cellules vides en fin de ligne (Excel) tolérées ; une cellule remplie
      // au-delà de l'en-tête signale un libellé non cité qui décale les colonnes.
      if (brute.length > largeur && brute.slice(largeur).some((v) => v.trim()))
        throw new ErreurReglement('Nombre de colonnes incorrect.', 400)
      const row = Array.from({ length: largeur }, (_, i) => brute[i] ?? '')
      const d = lireDate(row[date])
      const label = row[libelle].trim()
      if (!label || label.length > 500)
        throw new ErreurReglement('Libellé requis, 500 caractères maximum.', 400)
      let cents: number
      if (montant >= 0) cents = lireMontantReleve(row[montant])
      else {
        // Un débit peut être écrit négatif (Caisse d'Épargne, Banque Populaire).
        const deb = row[debit].trim() ? Math.abs(lireMontantReleve(row[debit])) : 0,
          cred = row[credit].trim() ? lireMontantReleve(row[credit]) : 0
        if (cred < 0 || (deb > 0 && cred > 0))
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
        throw new ErreurReglement('Ligne ' + numero + ' : ' + e.message, e.status)
      throw e
    }
  })
}
