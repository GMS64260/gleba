/**
 * Réversion ciblée : restaure les identifiants TypeScript qui ont été
 * accidentellement renommés avec des accents par le script encoding-audit.ts
 * (passe multi-lignes trop large).
 *
 * Stratégie : ne touche que les occurrences en CONTEXTE CODE (pas dans une
 * chaîne "..." ni dans du texte JSX >...<). On scanne chaque ligne en
 * supprimant temporairement les zones "..." et >...< puis on revert
 * uniquement dans le reste.
 */

import * as fs from "fs"
import * as path from "path"

// Identifiants à reverter quand ils apparaissent en code (pas dans des strings ou JSX text).
const REVERT_MAP: Record<string, string> = {
  variétés: "varietes",
  espèces: "especes",
  récoltes: "recoltes",
  catégories: "categories",
  paramètres: "parametres",
  étapes: "etapes",
  variété: "variete",
  espèce: "espece",
  récolte: "recolte",
  catégorie: "categorie",
  paramètre: "parametre",
  étape: "etape",
  itinéraires: "itineraires",
  itinéraire: "itineraire",
  référence: "reference",
  références: "references",
  référentiel: "referentiel",
  détail: "detail",
  détails: "details",
  nécessaire: "necessaire",
  nécessaires: "necessaires",
  élevage: "elevage",
  année: "annee",
  années: "annees",
  pépinière: "pepiniere",
  durée: "duree",
  délai: "delai",
  sélection: "selection",
  prévue: "prevue",
  prévues: "prevues",
}

function processFile(filePath: string): boolean {
  const original = fs.readFileSync(filePath, "utf8")
  const lines = original.split("\n")
  let changed = false

  const newLines = lines.map((line) => {
    // Build a "code-only" version of the line by removing strings and JSX text segments.
    // Then check if any of our target words appear in CODE context.

    // Mask "double-quoted" strings, 'single-quoted', and `template` strings (line-level)
    let masked = line
    // Mask JSX text segments: between > and < on this line
    const stringRanges: Array<[number, number]> = []
    const re1 = /"([^"\n]*)"/g
    let m: RegExpExecArray | null
    while ((m = re1.exec(line)) !== null) {
      stringRanges.push([m.index, m.index + m[0].length])
    }
    const re2 = /'([^'\n]*)'/g
    while ((m = re2.exec(line)) !== null) {
      stringRanges.push([m.index, m.index + m[0].length])
    }
    const re3 = />[^<>{}\n]+</g
    while ((m = re3.exec(line)) !== null) {
      stringRanges.push([m.index + 1, m.index + m[0].length - 1])
    }

    function isInString(pos: number): boolean {
      return stringRanges.some(([s, e]) => pos >= s && pos < e)
    }

    let newLine = ""
    let i = 0
    while (i < line.length) {
      // Try to match each target identifier at position i
      let matched = false
      for (const [accented, ascii] of Object.entries(REVERT_MAP)) {
        if (line.startsWith(accented, i)) {
          // Word boundary check
          const before = i === 0 ? "" : line[i - 1]
          const after = line[i + accented.length] ?? ""
          const isWordBoundaryBefore = !/[A-Za-zÀ-ÿ0-9_]/.test(before)
          const isWordBoundaryAfter = !/[A-Za-zÀ-ÿ0-9_]/.test(after)
          if (isWordBoundaryBefore && isWordBoundaryAfter && !isInString(i)) {
            newLine += ascii
            i += accented.length
            matched = true
            changed = true
            break
          }
        }
      }
      if (!matched) {
        newLine += line[i]
        i++
      }
    }
    return newLine
  })

  if (changed) {
    fs.writeFileSync(filePath, newLines.join("\n"), "utf8")
  }
  return changed
}

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else if (/\.tsx?$/.test(entry.name)) files.push(full)
  }
  return files
}

const root = path.resolve(__dirname, "..", "src")
const files = walk(root)
let changedCount = 0
for (const f of files) {
  if (processFile(f)) changedCount++
}
// eslint-disable-next-line no-console
console.log(`Identifiants restaurés dans ${changedCount} fichiers.`)
