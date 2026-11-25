/**
 * Reprise de la lignée des lots de récolte scindés AVANT la colonne
 * `recoltes.recolte_origine_id` (migration 20261125200000).
 *
 * Une vente ou une sortie partielle a créé une seconde ligne sans lien avec la
 * première. Le seul indice sûr est la note que le code écrivait sur la ligne
 * créée, et qui cite l'identifiant de la ligne d'origine :
 *   « Reliquat non vendu de la récolte #N » (vente partielle, depuis 2026-06) ;
 *   « Reliquat de la récolte #N » et « Part sortie de la récolte #N » (sorties
 *   partielles, depuis 2026-11-24, seulement si le lot n'avait pas de note).
 * Une part n'est reliée que si la ligne citée existe, appartient au même
 * compte, porte la même espèce, la même culture et la même date, et a un
 * identifiant plus petit. Les chaînes sont remontées jusqu'à la récolte saisie.
 * Jamais de lien sur une simple coïncidence de date.
 *
 * Non reliées, par construction : sortie partielle d'un lot qui avait déjà une
 * note, note modifiée depuis, origine supprimée, redatée ou rattachée à une
 * autre culture, compte restauré ou importé (les notes citent les anciens
 * identifiants). Ces lignes restent comptées chacune comme une récolte.
 *
 * À blanc par défaut : rien n'est écrit.
 *
 *   tsx scripts/reprise-lignee-recoltes.ts [--journal fichier.json] [--appliquer]
 *
 * Un compte, une transaction, sous le verrou du stock commercial de ce compte
 * (celui des scissions) : un compte en échec est annulé en entier, nommé par
 * son identifiant, et n'empêche pas les autres. Une part déjà re-scindée depuis
 * la migration a des parts qui la pointent : elles sont ramenées à la récolte
 * saisie avec elle, une part ne pointe jamais une autre part.
 *
 * Le journal ne porte que des identifiants. Chaque ligne mise à jour déclenche
 * les contrôles de stock de `recoltes` : lancer hors marché.
 */
import { writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { verrouillerStockCommercial } from '../src/lib/stocks/verrou-commercial'

const NOTE = '(?:Reliquat non vendu de la récolte|Reliquat de la récolte|Part sortie de la récolte) #'

/** Parts à relier : identifiant de la part et de sa récolte saisie, par compte ($1) ou tous (NULL). */
export const SQL_LIGNEES = `
WITH RECURSIVE indice AS (
  SELECT p.id, p.user_id, p.espece, p.culture, p.date,
    substring(p.notes FROM '^${NOTE}([0-9]{1,9})')::int AS parent_id
  FROM recoltes p
  WHERE p.recolte_origine_id IS NULL AND p.notes ~ '^${NOTE}[0-9]{1,9}'
    AND ($1::text IS NULL OR p.user_id = $1)
), lien AS (
  SELECT i.id AS part_id, o.id AS parent_id, o.recolte_origine_id AS parent_origine
  FROM indice i JOIN recoltes o ON o.id = i.parent_id
  WHERE o.id < i.id AND o.user_id = i.user_id AND o.espece = i.espece
    AND o.culture IS NOT DISTINCT FROM i.culture AND o.date = i.date
), chaine AS (
  SELECT part_id, parent_id AS racine, parent_origine, 1 AS n FROM lien
  UNION ALL
  SELECT c.part_id, l.parent_id, l.parent_origine, c.n + 1
  FROM chaine c JOIN lien l ON l.part_id = c.racine
  WHERE c.parent_origine IS NULL AND c.n < 100
), racine AS (
  SELECT DISTINCT ON (part_id) part_id, COALESCE(parent_origine, racine) AS racine_id
  FROM chaine ORDER BY part_id, n DESC
)
SELECT part_id AS "partId", racine_id AS "racineId" FROM racine ORDER BY part_id`

type Lien = { partId: number; racineId: number }
type Client = Pick<PrismaClient, '$queryRawUnsafe' | 'recolte'>

/**
 * Relie les parts d'un compte à leur récolte saisie ; à blanc, ne fait que les
 * lister. À appeler dans une transaction, sous le verrou du stock commercial.
 */
export async function reprendreLigneesCompte(tx: Client, userId: string, appliquer: boolean): Promise<Lien[]> {
  const liens = await tx.$queryRawUnsafe<Lien[]>(SQL_LIGNEES, userId)
  if (!appliquer) return liens
  for (const { partId, racineId } of liens) {
    await tx.recolte.updateMany({ where: { id: partId, userId, recolteOrigineId: null }, data: { recolteOrigineId: racineId } })
    // Parts nées de cette part depuis la migration : elles suivent la récolte saisie.
    await tx.recolte.updateMany({ where: { userId, recolteOrigineId: partId }, data: { recolteOrigineId: racineId } })
  }
  const [{ n: chaines }] = await tx.$queryRawUnsafe<Array<{ n: number }>>(SQL_CHAINES, userId)
  if (chaines > 0) throw new Error(`${chaines} part(s) pointeraient une autre part`)
  return liens
}

/** Lignes qui portent une note de scission, reliables ou non. */
const SQL_CANDIDATES = `SELECT user_id AS "userId", count(*)::int AS n FROM recoltes WHERE recolte_origine_id IS NULL AND notes ~ '^${NOTE}[0-9]{1,9}' GROUP BY user_id ORDER BY user_id`
/** Une part ne doit jamais pointer une autre part. */
const SQL_CHAINES = `SELECT count(*)::int AS n FROM recoltes p JOIN recoltes o ON o.id = p.recolte_origine_id WHERE o.recolte_origine_id IS NOT NULL AND p.user_id = $1`

async function main() {
  const args = process.argv.slice(2)
  const appliquer = args.includes('--appliquer')
  const fichier = args.includes('--journal') ? args[args.indexOf('--journal') + 1] : undefined
  const prisma = new PrismaClient()
  try {
    const comptes = await prisma.$queryRawUnsafe<Array<{ userId: string; n: number }>>(SQL_CANDIDATES)
    const journal: Array<{ userId: string; candidates: number; liens: Lien[] }> = []
    const echecs: Array<{ userId: string; erreur: string }> = []
    for (const { userId, n } of comptes) {
      try {
        const liens = await prisma.$transaction(async (tx) => {
          await verrouillerStockCommercial(tx, userId)
          return reprendreLigneesCompte(tx, userId, appliquer)
        }, { timeout: 120_000 })
        journal.push({ userId, candidates: n, liens })
      } catch (erreur) {
        echecs.push({ userId, erreur: erreur instanceof Error ? erreur.message.split('\n').at(-1) ?? '' : String(erreur) })
      }
    }
    const candidates = comptes.reduce((somme, c) => somme + c.n, 0)
    const reliees = journal.reduce((somme, c) => somme + c.liens.length, 0)
    console.log(`${comptes.length} compte(s), ${candidates} ligne(s) portent une note de scission ; ${reliees} reliable(s) à leur récolte saisie.`)
    console.log(appliquer ? `Écrit : ${reliees} part(s) reliée(s).` : 'Passage à blanc : rien écrit. Ajoutez --appliquer pour écrire.')
    for (const e of echecs) console.error(`Compte ${e.userId} annulé : ${e.erreur}`)
    if (fichier) writeFileSync(fichier, JSON.stringify({ applique: appliquer, date: new Date().toISOString(), echecs, journal }, null, 2), { mode: 0o600 })
    if (echecs.length > 0) process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

if (process.argv[1]?.endsWith('reprise-lignee-recoltes.ts')) {
  main().catch((erreur) => { console.error(erreur); process.exitCode = 1 })
}
