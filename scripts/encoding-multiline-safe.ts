/**
 * Passe de correction conservative pour les textes JSX sur leur PROPRE ligne.
 *
 * Cible UNIQUEMENT :
 *   line N-1 finit par `>`    (closing tag)
 *   line N   est `<whitespace><texte sans <,>,{,},(,),;,=>`
 *   line N+1 commence par `<` (next tag)
 *
 * C'est typiquement :
 *   <CardTitle>
 *     Récoltes              ← cette ligne
 *   </CardTitle>
 *
 * Cela évite les pièges TypeScript : generics, destructurations, etc.
 */

import * as fs from "fs"
import * as path from "path"

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bVariete\b/g, "Variété"], [/\bVarietes\b/g, "Variétés"],
  [/\bEspece\b/g, "Espèce"], [/\bEspeces\b/g, "Espèces"],
  [/\bAnnee\b/g, "Année"], [/\bAnnees\b/g, "Années"],
  [/\bRecolte\b/g, "Récolte"], [/\bRecoltes\b/g, "Récoltes"],
  [/\bCategorie\b/g, "Catégorie"], [/\bCategories\b/g, "Catégories"],
  [/\bItineraire\b/g, "Itinéraire"], [/\bItineraires\b/g, "Itinéraires"],
  [/\bParametre\b/g, "Paramètre"], [/\bParametres\b/g, "Paramètres"],
  [/\bMaraichage\b/g, "Maraîchage"], [/\bMaraichere\b/g, "Maraîchère"], [/\bMaraicher\b/g, "Maraîcher"],
  [/\bReference\b/g, "Référence"], [/\bReferences\b/g, "Références"], [/\bReferentiel\b/g, "Référentiel"],
  [/\bDetail\b/g, "Détail"], [/\bDetails\b/g, "Détails"],
  [/\bNecessaire\b/g, "Nécessaire"], [/\bNecessaires\b/g, "Nécessaires"],
  [/\bBeneficient\b/g, "Bénéficient"], [/\bbeneficient\b/g, "bénéficient"],
  [/\bNumerote\b/g, "Numéroté"], [/\bNumerotee\b/g, "Numérotée"],
  [/\bGenere\b/g, "Généré"], [/\bGeneree\b/g, "Générée"],
  [/\bPlantees\b/g, "Plantées"], [/\bSemees\b/g, "Semées"],
  [/\bTermines\b/g, "Terminés"], [/\bTerminees\b/g, "Terminées"], [/\bSauvegardees\b/g, "Sauvegardées"],
  [/\bDefinir\b/g, "Définir"], [/\bDefinit\b/g, "Définit"], [/\bDefinissent\b/g, "Définissent"],
  [/\bCree\b/g, "Créé"], [/\bCrees\b/g, "Créés"], [/\bCreee\b/g, "Créée"],
  [/\bPepiniere\b/g, "Pépinière"], [/\bElevage\b/g, "Élevage"], [/\belevage\b/g, "élevage"],
  [/\bGerez\b/g, "Gérez"], [/\bGere\b/g, "Gère"],
  [/\bHeberge\b/g, "Hébergé"], [/\bHebergeable\b/g, "Hébergeable"],
  [/\bDiversifiees\b/g, "Diversifiées"], [/\bConfigurees\b/g, "Configurées"],
  [/\bmodifiee\b/g, "modifiée"], [/\bajoutee\b/g, "ajoutée"], [/\bsupprimee\b/g, "supprimée"],
  [/\benregistree\b/g, "enregistrée"], [/\bcreee\b/g, "créée"],
  [/\bassociees\b/g, "associées"], [/\bassociee\b/g, "associée"],
  [/\btrouvee\b/g, "trouvée"], [/\bnecessaires\b/g, "nécessaires"], [/\bnecessaire\b/g, "nécessaire"],
  [/\breferences\b/g, "références"], [/\bdefinit\b/g, "définit"], [/\bdefinir\b/g, "définir"],
  [/\bgeneree\b/g, "générée"], [/\bgenere\b/g, "généré"],
  [/\brecolte\b/g, "récolte"], [/\brecoltes\b/g, "récoltes"],
  [/\bvariete\b/g, "variété"], [/\bvarietes\b/g, "variétés"],
  [/\bespece\b/g, "espèce"], [/\bespeces\b/g, "espèces"],
  [/\bcategorie\b/g, "catégorie"], [/\bcategories\b/g, "catégories"],
  [/\bparametres\b/g, "paramètres"], [/\bparametre\b/g, "paramètre"],
  [/\bitineraire\b/g, "itinéraire"], [/\bitineraires\b/g, "itinéraires"],
  [/\bmaraichage\b/g, "maraîchage"], [/\bmaraichere\b/g, "maraîchère"],
  [/\bdefinissent\b/g, "définissent"],
  [/\bEtape\b/g, "Étape"], [/\bEtat\b/g, "État"], [/\bEtats\b/g, "États"],
  [/\bEvenement\b/g, "Événement"], [/\bEvenements\b/g, "Événements"],
  [/\betape\b/g, "étape"], [/\betapes\b/g, "étapes"],
  [/\bSelectionner\b/g, "Sélectionner"], [/\bSelection\b/g, "Sélection"],
  [/\bselectionner\b/g, "sélectionner"], [/\bselection\b/g, "sélection"],
  [/\bDuree\b/g, "Durée"], [/\bduree\b/g, "durée"],
  [/\bDelai\b/g, "Délai"], [/\bdelai\b/g, "délai"],
  [/\bModifie\b/g, "Modifié"], [/\bSupprime\b/g, "Supprimé"], [/\bAjoute\b/g, "Ajouté"],
  [/\bcreer\b/g, "créer"], [/\bCreer\b/g, "Créer"],
  [/\bprevue\b/g, "prévue"], [/\bprevues\b/g, "prévues"],
  [/\bprevu\b/g, "prévu"], [/\bprevus\b/g, "prévus"],
  [/\bDefinissez\b/g, "Définissez"],
  [/\binfluencees\b/g, "influencées"], [/\binfluencee\b/g, "influencée"],
  [/\bpremiere\b/g, "première"], [/\bPremiere\b/g, "Première"],
  [/\benvoye\b/g, "envoyé"], [/\benvoyee\b/g, "envoyée"],
  [/\bmise a jour\b/g, "mise à jour"],
  [/\bDelai Avant\b/g, "Délai Avant"],
  [/\bMaraichers\b/g, "Maraîchers"],
  // « a ete » → « a été » (auxiliaire être au passé composé)
  [/\ba ete\b/g, "a été"],
  [/\bete\b/g, "été"],
]

function isPureJsxTextLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  // Pas de caractères de code TS/JS/JSX
  if (/[<>{}();=]/.test(trimmed)) return false
  // Doit contenir au moins une lettre (sinon c'est juste ponctuation)
  if (!/[A-Za-zÀ-ÿ]/.test(trimmed)) return false
  return true
}

function lineEndsWithJsxTagOpen(line: string): boolean {
  // Une ligne qui se termine par > (close d'un tag JSX) mais pas par /> (self-closing)
  // ni par => (arrow function)
  const trimmed = line.trimEnd()
  if (!trimmed.endsWith(">")) return false
  if (trimmed.endsWith("=>")) return false
  if (trimmed.endsWith("/>")) return true  // self-closing is OK (next text would be sibling)
  // Vérifier qu'il y a un < quelque part avant ce > (pour confirmer que c'est un tag)
  // On vise des patterns comme <Tag>, <Tag attr="x">, <Tag {...spread}>
  // Pas des generics : useState<Type> aurait useState avant
  // Heuristique simple : si le `>` est précédé par un caractère qui n'est PAS `]` ou `)` ou nombre,
  // c'est probablement un tag (les generics terminent souvent par `]>` ou `>`)
  const lastChar = trimmed[trimmed.length - 2]
  // Skip si le > est un generic close: precedent est ], ou un nombre, ou un autre >
  if (lastChar === "]" || /[0-9]/.test(lastChar || "")) return false
  return true
}

function lineStartsWithJsxTagClose(line: string): boolean {
  const trimmed = line.trimStart()
  return trimmed.startsWith("<")
}

function processFile(filePath: string): { changes: number } {
  const original = fs.readFileSync(filePath, "utf8")
  const lines = original.split("\n")
  let changes = 0

  for (let i = 1; i < lines.length - 1; i++) {
    const prev = lines[i - 1]
    const cur = lines[i]
    const next = lines[i + 1]
    if (
      lineEndsWithJsxTagOpen(prev) &&
      isPureJsxTextLine(cur) &&
      lineStartsWithJsxTagClose(next)
    ) {
      let newLine = cur
      for (const [re, to] of REPLACEMENTS) {
        newLine = newLine.replace(re, to)
      }
      if (newLine !== cur) {
        lines[i] = newLine
        changes++
      }
    }
  }

  if (changes > 0) {
    fs.writeFileSync(filePath, lines.join("\n"), "utf8")
  }
  return { changes }
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
let totalChanges = 0
let fileCount = 0
for (const f of files) {
  const { changes } = processFile(f)
  if (changes > 0) {
    totalChanges += changes
    fileCount++
  }
}
// eslint-disable-next-line no-console
console.log(`Passe multilignes safe : ${totalChanges} corrections dans ${fileCount} fichiers.`)
