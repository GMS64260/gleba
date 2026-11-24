/**
 * Reprise du modèle de stock unique, L3 : lots d'inventaire pour les comptages
 * qui dépassent les lots (`repriseLotsInventaire`).
 *
 * À lancer DEPUIS L'HÔTE, dans un arbre assemblé (public + zone privée) du
 * commit en production : l'image ne contient ni `src/` ni `tsconfig`. Avec la
 * base de production en `DATABASE_URL`, après sauvegarde :
 *   npx tsx scripts/reprise-stock-lots-inventaire.ts            (à blanc)
 *   npx tsx scripts/reprise-stock-lots-inventaire.ts --ecrire   (après accord)
 * Options : `--user <id>` (un seul compte), `--journal <fichier>` (lignes JSON,
 * identifiants des lots créés, pour un éventuel retour arrière).
 * La console ne montre ni nom ni courriel (identifiant de compte tronqué).
 */
import { writeFileSync } from 'node:fs'
import { repriseLotsInventaire } from '../src/lib/stocks/reprise-inventaire'
import prisma from '../src/lib/prisma'

const option = (nom: string) => {
  const i = process.argv.indexOf(nom)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const ecrire = process.argv.includes('--ecrire')
const userId = option('--user')
const journal = option('--journal')

repriseLotsInventaire({ ecrire, userId })
  .then((lignes) => {
    for (const l of lignes.filter((x) => x.action !== 'aucune')) {
      console.log([l.userId.slice(0, 6), l.especeId.slice(0, 24), l.unite, `stock ${l.stock}`, `lots ${l.lots}`, `écart ${l.ecart}`, l.action, l.lotId ?? ''].join(' | '))
    }
    if (journal) writeFileSync(journal, lignes.map((l) => JSON.stringify(l)).join('\n') + '\n', { mode: 0o600 })
    const parAction = lignes.reduce<Record<string, number>>((n, l) => ({ ...n, [l.action]: (n[l.action] ?? 0) + 1 }), {})
    console.log(`${ecrire ? 'Écrit' : 'Passage à blanc'} : ${lignes.length} comptages examinés`, parAction)
  })
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
