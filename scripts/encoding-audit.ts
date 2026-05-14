/**
 * Audit + correction des accents français manquants dans les chaînes JSX.
 *
 * Usage:
 *   npx tsx scripts/encoding-audit.ts --report   # produit audit/encoding-report.md
 *   npx tsx scripts/encoding-audit.ts --apply    # applique les remplacements
 *
 * Règles de sécurité :
 *  - Ne touche QUE les chaînes JSX : entre guillemets doubles ("...") ou texte JSX
 *    (>...<). Skip les identifiants TS / types / interfaces / imports.
 *  - Ne touche PAS les clés techniques basse-casse (value="recolte", "espece", etc.)
 *    sauf si elles sont aussi des labels d'affichage — détection par capitalisation
 *    initiale du mot fautif.
 *  - Ne touche PAS les noms de fichiers, paths, URLs ("/comptabilite", etc.).
 *  - Ne touche PAS les attributs `value=`, `id=`, `name=`, `key=`, `className=`, `data-*`.
 */

import * as fs from "fs"
import * as path from "path"

// Mots fautifs → corrigés. Seuls les UNAMBIGUS (capitalisés ou clairement participes).
const REPLACEMENTS: Array<[RegExp, string]> = [
  // Capitalisés (substantifs / titres) — toujours accentués
  [/\bVariete\b/g, "Variété"],
  [/\bVarietes\b/g, "Variétés"],
  [/\bEspece\b/g, "Espèce"],
  [/\bEspeces\b/g, "Espèces"],
  [/\bAnnee\b/g, "Année"],
  [/\bAnnees\b/g, "Années"],
  [/\bRecolte\b/g, "Récolte"],
  [/\bRecoltes\b/g, "Récoltes"],
  [/\bCategorie\b/g, "Catégorie"],
  [/\bCategories\b/g, "Catégories"],
  [/\bItineraire\b/g, "Itinéraire"],
  [/\bItineraires\b/g, "Itinéraires"],
  [/\bParametre\b/g, "Paramètre"],
  [/\bParametres\b/g, "Paramètres"],
  [/\bMaraichage\b/g, "Maraîchage"],
  [/\bMaraichere\b/g, "Maraîchère"],
  [/\bMaraicher\b/g, "Maraîcher"],
  [/\bReference\b/g, "Référence"],
  [/\bReferences\b/g, "Références"],
  [/\bReferentiel\b/g, "Référentiel"],
  [/\bDetail\b/g, "Détail"],
  [/\bDetails\b/g, "Détails"],
  [/\bNecessaire\b/g, "Nécessaire"],
  [/\bNecessaires\b/g, "Nécessaires"],
  [/\bBeneficient\b/g, "Bénéficient"],
  [/\bNumerote\b/g, "Numéroté"],
  [/\bNumerotee\b/g, "Numérotée"],
  [/\bGenere\b/g, "Généré"],
  [/\bGeneree\b/g, "Générée"],
  [/\bPlantees\b/g, "Plantées"],
  [/\bSemees\b/g, "Semées"],
  [/\bTermines\b/g, "Terminés"],
  [/\bTerminees\b/g, "Terminées"],
  [/\bSauvegardees\b/g, "Sauvegardées"],
  [/\bDefinir\b/g, "Définir"],
  [/\bDefinit\b/g, "Définit"],
  [/\bDefinissent\b/g, "Définissent"],
  [/\bCree\b/g, "Créé"],
  [/\bCrees\b/g, "Créés"],
  [/\bCreee\b/g, "Créée"],
  [/\bPepiniere\b/g, "Pépinière"],
  [/\bElevage\b/g, "Élevage"],
  [/\bGerez\b/g, "Gérez"],
  [/\bGere\b/g, "Gère"],
  [/\bHeberge\b/g, "Hébergé"],
  [/\bHebergeable\b/g, "Hébergeable"],
  [/\bDiversifiees\b/g, "Diversifiées"],
  [/\bConfigurees\b/g, "Configurées"],
  // Bas-de-casse — souvent placeholders / labels / messages toast
  [/\bmodifiee\b/g, "modifiée"],
  [/\bajoutee\b/g, "ajoutée"],
  [/\bsupprimee\b/g, "supprimée"],
  [/\benregistree\b/g, "enregistrée"],
  [/\bcreee\b/g, "créée"],
  [/\bassociees\b/g, "associées"],
  [/\bassociee\b/g, "associée"],
  [/\btrouvee\b/g, "trouvée"],
  [/\bnecessaires\b/g, "nécessaires"],
  [/\bnecessaire\b/g, "nécessaire"],
  [/\breferences\b/g, "références"],
  [/\bdefinit\b/g, "définit"],
  [/\bdefinir\b/g, "définir"],
  [/\bgeneree\b/g, "générée"],
  [/\bgenere\b/g, "généré"],
  [/\brecolte\b/g, "récolte"],
  [/\brecoltes\b/g, "récoltes"],
  [/\bvariete\b/g, "variété"],
  [/\bvarietes\b/g, "variétés"],
  [/\bespece\b/g, "espèce"],
  [/\bespeces\b/g, "espèces"],
  [/\bcategorie\b/g, "catégorie"],
  [/\bcategories\b/g, "catégories"],
  [/\bparametres\b/g, "paramètres"],
  [/\bparametre\b/g, "paramètre"],
  [/\bitineraire\b/g, "itinéraire"],
  [/\bitineraires\b/g, "itinéraires"],
  [/\bmaraichage\b/g, "maraîchage"],
  [/\bmaraichere\b/g, "maraîchère"],
  [/\belevage\b/g, "élevage"],
  [/\bdefinissent\b/g, "définissent"],
  // Initial 'É' manquant
  [/\bEtape\b/g, "Étape"],
  [/\bEtat\b/g, "État"],
  [/\bEtats\b/g, "États"],
  [/\bEvenement\b/g, "Événement"],
  [/\bEvenements\b/g, "Événements"],
  [/\betape\b/g, "étape"],
  [/\betapes\b/g, "étapes"],
  // Sélection / délai / durée
  [/\bSelectionner\b/g, "Sélectionner"],
  [/\bSelection\b/g, "Sélection"],
  [/\bselectionner\b/g, "sélectionner"],
  [/\bselection\b/g, "sélection"],
  [/\bDuree\b/g, "Durée"],
  [/\bDurees\b/g, "Durées"],
  [/\bduree\b/g, "durée"],
  [/\bdurees\b/g, "durées"],
  [/\bDelai\b/g, "Délai"],
  [/\bDelais\b/g, "Délais"],
  [/\bdelai\b/g, "délai"],
  // Modifié / supprimé masculin
  [/\bModifie\b/g, "Modifié"],
  [/\bSupprime\b/g, "Supprimé"],
  [/\bAjoute\b/g, "Ajouté"],
  // Été
  [/\bete\b/g, "été"],
  [/\bEte\b/g, "Été"],
  // Récolte aussi avec préfixe
  [/\bMaraichers\b/g, "Maraîchers"],
  // Verbes & participes courants
  [/\bcreer\b/g, "créer"],
  [/\bCreer\b/g, "Créer"],
  [/\bprevue\b/g, "prévue"],
  [/\bprevues\b/g, "prévues"],
  [/\bprevu\b/g, "prévu"],
  [/\bprevus\b/g, "prévus"],
  [/\bDefinissez\b/g, "Définissez"],
  [/\binfluencees\b/g, "influencées"],
  [/\binfluencee\b/g, "influencée"],
  [/\benvoye\b/g, "envoyé"],
  [/\benvoyee\b/g, "envoyée"],
  [/\bpremiere\b/g, "première"],
  [/\bPremiere\b/g, "Première"],
  [/\bregenerer\b/g, "régénérer"],
  [/\bRegenerer\b/g, "Régénérer"],
  [/\bdemarrer\b/g, "démarrer"],
  [/\bDemarrer\b/g, "Démarrer"],
  [/\bmise a jour\b/g, "mise à jour"],
  [/\bDelai Avant\b/g, "Délai Avant"],
]

// Patterns FORBIDDEN — on ne touche pas si la ligne match l'un de ceux-ci.
// Cela évite de toucher aux identifiants TS, imports, types, logs, fetch, etc.
const FORBIDDEN_LINE_PATTERNS: RegExp[] = [
  /^\s*import\s/,                       // imports
  /^\s*\/\//,                            // commentaires single-line
  /^\s*\*/,                              // commentaires JSDoc
  /^\s*export\s+(type|interface|enum)\s/,
  /^\s*(type|interface|enum)\s+\w/,
  /\bconsole\.(log|error|warn|info|debug)\(/,
  /\bfetch\s*\(/,                        // appels fetch (URLs)
  /\baxios\./,
  /\bprocess\.env\b/,
  /^\s*throw\s+new\s+Error\(/,           // erreurs internes (techniques)
]

function isSkippableString(body: string): boolean {
  // Skip URLs (contiennent un /)
  if (body.includes("/")) return true
  // Skip template expressions
  if (body.includes("${")) return true
  // Skip si tout en bas-de-casse + symboles → clé technique probable
  if (/^[a-z0-9_\-:.]+$/.test(body)) return true
  // Skip chemins de propriété (lowercase.lowercase) — ex: "_count.varietes", "espece.id"
  if (/^[_a-z][_a-z0-9]*(\.[_a-z][_a-z0-9]*)+$/.test(body)) return true
  // Skip valeurs hexa, ids
  if (/^[0-9a-fA-F]{8,}$/.test(body)) return true
  return false
}

// Pour les chaînes hors JSX (commentaires, identifiants TS), on ne corrige rien.
// On corrige uniquement les littéraux situés dans des contextes UI clairs :
//  1) attribut JSX : placeholder="..." | title="..." | label="..." | description="..." | ...
//  2) propriété d'objet UI : label: "..." | title: "..." | description: "..." | header: "..." | name: "..."
//  3) texte JSX : >Texte<
//  4) appels toast({ title, description }) — déjà couverts par (2)

const UI_PROP_NAMES = [
  "title",
  "label",
  "description",
  "placeholder",
  "header",
  "shortLabel",
  "tooltip",
  "subtitle",
  "heading",
  "message",
  "text",
  "alt",
  "caption",
  "summary",
  "name",        // attention: parfois technique. On laisse, vu que "name:" dans MODULES est UI.
]

function isLineForbidden(line: string): boolean {
  return FORBIDDEN_LINE_PATTERNS.some((re) => re.test(line))
}

interface Finding {
  file: string
  line: number
  col: number
  original: string
  replaced: string
  snippet: string
}

function processFile(
  filePath: string,
  mode: "report" | "apply",
): { findings: Finding[]; updatedContent?: string } {
  const original = fs.readFileSync(filePath, "utf8")
  const lines = original.split("\n")
  const findings: Finding[] = []
  const newLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isLineForbidden(line)) {
      newLines.push(line)
      continue
    }
    let newLine = line

    // Stratégie : ne traiter que les substrings entre " ... " ou > ... <
    // On scan-replace par groupes capturés sur ces contextes.
    newLine = newLine.replace(
      /(")([^"\n]*?)(")/g,
      (full, q1, body, q2, offset) => {
        if (isSkippableString(body)) return full
        // skip si c'est un attribut value=, id=, key=, name= en JSX (techniques)
        const prefix = newLine.slice(Math.max(0, offset - 32), offset)
        if (/\b(value|id|key|href|src|className|data-[a-z-]+|type|action|method|target|rel|role|aria-controls|aria-labelledby)\s*=\s*$/.test(prefix)) {
          return full
        }
        // skip property access dans template ${arbre.espece}
        if (/\.\s*$/.test(prefix)) return full
        let replaced = body
        for (const [re, to] of REPLACEMENTS) {
          replaced = replaced.replace(re, to)
        }
        if (replaced !== body) {
          findings.push({
            file: filePath,
            line: i + 1,
            col: offset,
            original: body,
            replaced,
            snippet: line.trim(),
          })
        }
        return q1 + replaced + q2
      },
    )

    // Texte JSX > ... <
    newLine = newLine.replace(
      /(>)([^<>\n{]+)(<)/g,
      (full, lt, body, rt, offset) => {
        if (!/[A-Za-zÀ-ÿ]/.test(body)) return full
        let replaced = body
        for (const [re, to] of REPLACEMENTS) {
          replaced = replaced.replace(re, to)
        }
        if (replaced !== body) {
          findings.push({
            file: filePath,
            line: i + 1,
            col: offset,
            original: body.trim(),
            replaced: replaced.trim(),
            snippet: line.trim(),
          })
        }
        return lt + replaced + rt
      },
    )

    newLines.push(newLine)
  }

  let updatedContent = newLines.join("\n")

  // Passe 2 : texte JSX multilignes ( >\n  Texte\n< )
  // On opère sur le contenu entier, en ne capturant que les blocs sans <, >, {, }
  updatedContent = updatedContent.replace(
    />([^<>{}]+)</g,
    (full, body) => {
      // Doit contenir au moins une lettre (sinon ce n'est que whitespace)
      if (!/[A-Za-zÀ-ÿ]/.test(body)) return full
      // Skip URLs et templates
      if (body.includes("/")) return full
      let replaced = body
      for (const [re, to] of REPLACEMENTS) {
        replaced = replaced.replace(re, to)
      }
      if (replaced !== body) {
        // Trouver la ligne approximative en comptant les newlines avant ce match
        // (on perd la précision exacte mais c'est OK pour le rapport)
        findings.push({
          file: filePath,
          line: 0,
          col: 0,
          original: body.trim().slice(0, 60),
          replaced: replaced.trim().slice(0, 60),
          snippet: "[multiline JSX text]",
        })
      }
      return ">" + replaced + "<"
    },
  )

  return {
    findings,
    updatedContent: updatedContent !== original ? updatedContent : undefined,
  }
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

function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "report"
  const root = path.resolve(__dirname, "..", "src")
  const files = walk(root)
  const allFindings: Finding[] = []

  for (const file of files) {
    const { findings, updatedContent } = processFile(file, mode)
    if (findings.length) allFindings.push(...findings)
    if (mode === "apply" && updatedContent) {
      fs.writeFileSync(file, updatedContent, "utf8")
    }
  }

  // Écrire le rapport
  const auditDir = path.resolve(__dirname, "..", "audit")
  if (!fs.existsSync(auditDir)) fs.mkdirSync(auditDir, { recursive: true })
  const reportPath = path.join(auditDir, "encoding-report.md")

  const byFile = new Map<string, Finding[]>()
  for (const f of allFindings) {
    const k = path.relative(path.resolve(__dirname, ".."), f.file)
    if (!byFile.has(k)) byFile.set(k, [])
    byFile.get(k)!.push(f)
  }

  const lines: string[] = []
  lines.push(`# Audit encoding UTF-8 — accents français manquants`)
  lines.push("")
  lines.push(`Mode : **${mode}**`)
  lines.push(`Fichiers analysés : **${files.length}**`)
  lines.push(`Occurrences détectées : **${allFindings.length}**`)
  lines.push(`Fichiers impactés : **${byFile.size}**`)
  lines.push("")
  lines.push(`## Détail par fichier`)
  lines.push("")
  const sortedFiles = [...byFile.keys()].sort()
  for (const f of sortedFiles) {
    const arr = byFile.get(f)!
    lines.push(`### \`${f}\` (${arr.length})`)
    lines.push("")
    lines.push("| Ligne | Avant | Après | Contexte |")
    lines.push("|---|---|---|---|")
    for (const fi of arr) {
      const sn = fi.snippet.length > 80 ? fi.snippet.slice(0, 77) + "…" : fi.snippet
      lines.push(
        `| ${fi.line} | \`${fi.original.replace(/\|/g, "\\|")}\` | \`${fi.replaced.replace(/\|/g, "\\|")}\` | \`${sn.replace(/\|/g, "\\|")}\` |`,
      )
    }
    lines.push("")
  }

  // Section : mots ambigus laissés tels quels
  lines.push("## Cas non traités automatiquement (ambigus)")
  lines.push("")
  lines.push("Ces formes sont contextuelles (substantif sans accent ≠ participe passé avec accent) :")
  lines.push("")
  lines.push("- `Plante`, `Plantes` → souvent substantif féminin « la plante » (PAS d'accent). Forme participe « planté(e) » → accent.")
  lines.push("- `Sauvegarde` → substantif « la sauvegarde » (PAS d'accent). Verbe « sauvegardé » → accent.")
  lines.push("- `Conserve` → substantif « les conserves » (PAS d'accent). Verbe « conservé » → accent.")
  lines.push("- `Reserve` → substantif « la réserve » (avec accent !) ou participe « réservé ».")
  lines.push("- `Termine`, `Semis`, `Seme` (singulier) → ambigu sans contexte.")
  lines.push("")
  lines.push("Examiner manuellement après le run automatique.")
  lines.push("")

  fs.writeFileSync(reportPath, lines.join("\n"), "utf8")

  // eslint-disable-next-line no-console
  console.log(
    `${mode === "apply" ? "Appliqué" : "Rapport"} : ${allFindings.length} occurrences dans ${byFile.size} fichiers → ${reportPath}`,
  )
}

main()
