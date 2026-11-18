/**
 * Régénère docs/rgpd-perimetre-effacement.md depuis la classification
 * typée (src/lib/rgpd/perimetre-effacement.ts) et le schéma Prisma (DMMF).
 * Usage : npx tsx scripts/rgpd/generer-perimetre-effacement.ts [--verifier]
 * --verifier : n'écrit rien, code 1 si le document diverge ou si le
 * périmètre n'est pas exhaustif.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { Prisma } from '@prisma/client'
import { controlerPerimetre } from '../../src/lib/rgpd/perimetre-effacement'
import { genererDocumentPerimetre } from '../../src/lib/rgpd/perimetre-effacement-doc'

const cible = path.join(process.cwd(), 'docs', 'rgpd-perimetre-effacement.md')
const modeles = Prisma.dmmf.datamodel.models
const anomalies = controlerPerimetre(modeles)
if (anomalies.length) {
  for (const a of anomalies) console.error(`${a.modele} : ${a.probleme}`)
  process.exit(1)
}
const contenu = genererDocumentPerimetre(modeles)
if (process.argv.includes('--verifier')) {
  let actuel = ''
  try { actuel = readFileSync(cible, 'utf8') } catch { /* absent */ }
  if (actuel !== contenu) {
    console.error(`${cible} diverge du module : relancer sans --verifier.`)
    process.exit(1)
  }
  console.log('Document à jour.')
} else {
  writeFileSync(cible, contenu, 'utf8')
  console.log(`Écrit : ${cible} (${modeles.length} modèles)`)
}
