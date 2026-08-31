/**
 * Seed du catalogue variétal arboricole (petits fruits, méditerranéens, noyers,
 * châtaigniers, kiwis, grenadiers, plaqueminiers, agrumes, cognassier, néflier).
 *
 * Issue #30 (Siruv, 2026-08-26) : `prisma/seed-varietes-arbres.sql` — 901 lignes
 * de données INRAE/AFIDOL/pépinières françaises — n'était appelé NULLE PART, ni
 * par l'entrypoint, ni par package.json, ni par un script. Mesuré sur une base
 * neuve reconstruite par `prisma migrate deploy` + les seeds de l'entrypoint le
 * 2026-08-26 : 0 variété arboricole. Et le fichier était cassé même lancé à la
 * main (familles en français rejetées par le trigger `enforce_famille_latine`,
 * `nom_normalise` NOT NULL absent des INSERT) — les deux défauts sont corrigés
 * dans le SQL lui-même.
 *
 * Pourquoi un exécuteur TypeScript plutôt qu'un `psql` : l'image applicative est
 * une image Next standalone, elle ne contient PAS de client PostgreSQL. Le SQL
 * est donc découpé ici puis passé à `$executeRawUnsafe`.
 *
 * Invariant de démarrage : ce seed ne doit JAMAIS empêcher l'application de
 * démarrer. Chaque instruction est isolée ; un échec est compté et journalisé,
 * pas propagé.
 *
 * Usage : npx tsx prisma/seed-varietes-arbres.ts
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

/**
 * Découpe un script SQL en instructions.
 *
 * Un `split(';')` naïf ne convient pas : les descriptions variétales sont des
 * chaînes littérales qui peuvent contenir `;` ou `--`, et les apostrophes y sont
 * échappées en `''`. On suit donc l'état « dans une chaîne » caractère par
 * caractère, et on ignore les commentaires de ligne hors chaîne.
 */
export function decouperSql(sql: string): string[] {
  const instructions: string[] = []
  let courant = ''
  let dansChaine = false
  let dansCommentaire = false

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i]

    if (dansCommentaire) {
      if (c === '\n') {
        dansCommentaire = false
        courant += c
      }
      continue
    }

    if (dansChaine) {
      courant += c
      if (c === "'") {
        // `''` à l'intérieur d'une chaîne est une apostrophe échappée, pas une fin.
        if (sql[i + 1] === "'") {
          courant += sql[i + 1]
          i++
        } else {
          dansChaine = false
        }
      }
      continue
    }

    if (c === '-' && sql[i + 1] === '-') {
      dansCommentaire = true
      i++
      continue
    }

    if (c === "'") {
      dansChaine = true
      courant += c
      continue
    }

    if (c === ';') {
      const instruction = courant.trim()
      if (instruction) instructions.push(instruction)
      courant = ''
      continue
    }

    courant += c
  }

  const reste = courant.trim()
  if (reste) instructions.push(reste)
  return instructions
}

async function main() {
  const fichier = path.join(__dirname, 'seed-varietes-arbres.sql')
  if (!fs.existsSync(fichier)) {
    console.log(`⚠️  ${fichier} introuvable, seed arboricole ignoré`)
    return
  }

  const instructions = decouperSql(fs.readFileSync(fichier, 'utf-8'))
  let ok = 0
  const echecs: string[] = []

  for (const instruction of instructions) {
    try {
      await prisma.$executeRawUnsafe(instruction)
      ok++
    } catch (erreur) {
      const message = erreur instanceof Error ? erreur.message : String(erreur)
      echecs.push(`${instruction.slice(0, 60).replace(/\s+/g, ' ')}… → ${message}`)
    }
  }

  const varietes = await prisma.variete.count({
    where: {
      userId: null,
      espece: {
        is: {
          type: { in: ['arbre_fruitier', 'petit_fruit'] },
        },
      },
    },
  })

  console.log(
    `✓ Seed variétés arboricoles : ${ok}/${instructions.length} instructions, ` +
      `${varietes} variétés arboricoles au catalogue.`
  )
  for (const echec of echecs) console.error(`  ✗ ${echec}`)
}

/**
 * Ne s'exécute QUE lancé comme script.
 *
 * `decouperSql` est testé par `src/lib/__tests__/seed-varietes-arbres-sql.test.ts` ;
 * sans cette garde, importer ce module depuis un test ouvrirait une connexion
 * Prisma et jouerait le seed sur la base pointée par `DATABASE_URL` — donc la
 * production quand elle est chargée. Un module ne doit jamais écrire en base du
 * seul fait qu'on l'importe.
 */
const lanceCommeScript =
  typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module

if (lanceCommeScript) {
  main()
    .catch((erreur) => {
      // Jamais bloquant : l'application doit démarrer même si ce seed échoue.
      console.error('Seed variétés arboricoles ignoré :', erreur)
    })
    .finally(() => prisma.$disconnect())
}
