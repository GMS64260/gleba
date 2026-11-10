/**
 * Double démarrage sur une base neuve : le conteneur rejoue migrations et seed
 * à chaque redémarrage, le jeu d'exemple ne doit donc être créé qu'une fois.
 *
 *   tsx scripts/qa/verifier-double-demarrage.ts memoriser   (après le 1er seed)
 *   tsx scripts/qa/verifier-double-demarrage.ts comparer    (après le 2e seed)
 *
 * Utilisé par le job `base-neuve` de la CI.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const FICHIER = path.join(os.tmpdir(), 'gleba-double-demarrage.json')

async function compter(): Promise<Record<string, number>> {
  const [planches, cultures, recoltes, arbres, objets] = await Promise.all([
    prisma.planche.count(), prisma.culture.count(), prisma.recolte.count(), prisma.arbre.count(), prisma.objetJardin.count(),
  ])
  return { planches, cultures, recoltes, arbres, objets }
}

async function main() {
  const mode = process.argv[2]
  const comptes = await compter()
  if (mode === 'memoriser') {
    writeFileSync(FICHIER, JSON.stringify(comptes))
    console.log(`✓ Premier démarrage : ${JSON.stringify(comptes)}`)
    return
  }
  if (mode !== 'comparer') throw new Error('Usage : verifier-double-demarrage.ts memoriser|comparer')
  const avant = JSON.parse(readFileSync(FICHIER, 'utf8')) as Record<string, number>
  const ecarts = Object.keys(avant).filter((cle) => avant[cle] !== comptes[cle])
  if (ecarts.length > 0) {
    throw new Error(`Le second démarrage a changé le jeu d'exemple : ${ecarts.map((c) => `${c} ${avant[c]} → ${comptes[c]}`).join(', ')}`)
  }
  console.log(`✓ Second démarrage : jeu d'exemple inchangé (${JSON.stringify(comptes)})`)
}

main()
  .catch((e) => { console.error('Erreur:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
