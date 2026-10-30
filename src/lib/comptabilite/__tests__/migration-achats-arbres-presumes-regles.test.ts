/**
 * Migration 20261030090000 : les achats d'arbre repris en dette le 2026-10-28
 * passent présumés réglés. Sans base dans ce banc, le test garde les deux
 * erreurs qui la rendraient silencieusement inopérante ou trop large : une note
 * qui ne correspond pas à celle de la reprise, et une clé de suivi qui ne
 * correspond pas à `cleSourceReglement`.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cleSourceReglement } from '../cle-reglement'

const lire = (nom: string) => readFileSync(`prisma/migrations/${nom}/migration.sql`, 'utf8')
const reprise = lire('20261028193000_verger_raccords_comptables')
const migration = lire('20261030090000_achats_arbres_presumes_regles')
const sansCommentaires = migration.replace(/--.*$/gm, '')
// Littéral SQL → texte (les apostrophes doublées sont échappées).
const texteSql = (litteral: string) => litteral.slice(1, -1).replace(/''/g, "'")

describe('migration des achats d’arbre présumés réglés', () => {
  it('ne vise que les lignes portant la note exacte de la reprise du 2026-10-28', () => {
    const noteReprise = /'(Achat repris depuis la fiche arbre[^']*)'/.exec(reprise)![1]
    const filtre = /d\.notes = ('(?:[^']|'')*')/.exec(sansCommentaires)![1]
    expect(texteSql(filtre)).toBe(noteReprise)
    expect(sansCommentaires).toMatch(/d\.source_type = 'achat_arbre'\s+AND d\.auto = true\s+AND d\.paye = false/)
  })

  it('est idempotente : la nouvelle note ne correspond plus au filtre', () => {
    const nouvelle = texteSql(/notes = ('(?:[^']|'')*')/.exec(sansCommentaires.split('WHERE')[0])![1])
    expect(nouvelle).toBe("Achat repris depuis la fiche arbre ; présumé réglé à l'achat.")
    expect(nouvelle).not.toBe(texteSql(/d\.notes = ('(?:[^']|'')*')/.exec(sansCommentaires)![1]))
    expect(sansCommentaires).toMatch(/SET paye = true/)
  })

  it('reconnaît un achat suivi dans Règlements par la clé de `cleSourceReglement`', () => {
    const expression = /c\.cle = (.+)$/m.exec(sansCommentaires)![1].trim()
    const morceaux = expression.split('||').map((m) => m.trim())
    const evaluer = (sourceId: number) =>
      morceaux.map((m) => (m === 'd.source_id::text' ? String(sourceId) : texteSql(m))).join('')
    for (const id of [1, 42, 123456]) expect(evaluer(id)).toBe(cleSourceReglement('depense', 'achat_arbre', id))
    expect(sansCommentaires).toMatch(/c\.user_id = d\.user_id/)
  })
})
