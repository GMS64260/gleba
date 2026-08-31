import { describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { decouperSql } from '../../../prisma/seed-varietes-arbres'

const FICHIER = path.join(process.cwd(), 'prisma', 'seed-varietes-arbres.sql')

/**
 * Issue #30 (Siruv, 2026-08-26) : `prisma/seed-varietes-arbres.sql` n'était
 * appelé nulle part, et cassé même lancé à la main — familles en français
 * rejetées par le trigger `enforce_famille_latine`, `nom_normalise` NOT NULL
 * absent des INSERT. Vérifié sur une base neuve : 0 variété arboricole.
 *
 * Ces tests gardent les deux défauts fermés dans le FICHIER, là où un test
 * d'intégration coûterait une base.
 */
describe('découpage du script SQL', () => {
  it('ne coupe pas sur un point-virgule à l’intérieur d’une chaîne', () => {
    const sql = "INSERT INTO t VALUES ('a;b'); SELECT 1;"
    expect(decouperSql(sql)).toEqual(["INSERT INTO t VALUES ('a;b')", 'SELECT 1'])
  })

  it('respecte les apostrophes échappées en doublon', () => {
    const sql = "INSERT INTO t VALUES ('l''oïdium; sensible'); SELECT 2;"
    expect(decouperSql(sql)).toHaveLength(2)
  })

  it('ignore les commentaires de ligne hors chaîne', () => {
    const sql = "-- un point-virgule ; en commentaire\nSELECT 1;"
    expect(decouperSql(sql)).toEqual(['SELECT 1'])
  })

  it("ne prend pas un double tiret DANS une chaîne pour un commentaire", () => {
    const sql = "INSERT INTO t VALUES ('a -- pas un commentaire'); SELECT 3;"
    expect(decouperSql(sql)).toHaveLength(2)
  })
})

describe('intégrité du catalogue arboricole', () => {
  const sql = fs.readFileSync(FICHIER, 'utf-8')

  it('découpe le fichier en instructions exécutables', () => {
    // 1 familles + 1 espèces + 15 blocs de variétés.
    expect(decouperSql(sql)).toHaveLength(17)
  })

  it('n’emploie que des noms de familles latins (APG IV)', () => {
    // Le trigger `enforce_famille_latine` refuse « Rosacées » et fait échouer
    // l'INSERT des espèces en bloc, donc tout le reste du fichier.
    const instructions = decouperSql(sql)
    const donnees = instructions.filter((i) => !i.startsWith('--')).join('\n')
    for (const francais of [
      'Rosacées',
      'Moracées',
      'Oléacées',
      'Juglandacées',
      'Fagacées',
      'Actinidiacées',
      'Lythracées',
      'Ébénacées',
      'Rutacées',
      'Grossulariacées',
    ]) {
      expect(donnees.includes(`'${francais}'`)).toBe(false)
    }
    expect(donnees).toContain("'Rosaceae'")
  })

  it('renseigne nom_normalise sur chaque insertion de variété', () => {
    const blocs = decouperSql(sql).filter((i) => i.includes('INSERT INTO varietes'))
    expect(blocs.length).toBeGreaterThan(0)
    for (const bloc of blocs) {
      expect(bloc).toContain('nom_normalise')
      // La clé vient de la fonction SQL, miroir exact de `normalizeReferentielKey` :
      // une troisième copie de la formule finirait par diverger.
      expect(bloc).toContain('gleba_cle_referentiel(')
    }
  })

  it('ne réécrit jamais une entrée déjà au catalogue', () => {
    // Un seed rejoué à chaque démarrage qui ferait `DO UPDATE` écraserait les
    // corrections agronomiques posées depuis (leçon Marc, 2026-05-16).
    const instructions = decouperSql(sql)
    for (const instruction of instructions.filter((i) => i.startsWith('INSERT'))) {
      expect(instruction).toContain('DO NOTHING')
      expect(instruction).not.toContain('DO UPDATE')
    }
  })

  it('n’emploie pas d’identifiants préfixés par l’espèce', () => {
    // Le reste du catalogue nomme « Meeker », pas « Framboisier-Meeker » ; la
    // clé d'unicité étant (espece, nom_normalise), le préfixe faisait passer 49
    // cultivars déjà présents pour des nouveautés.
    const donnees = decouperSql(sql).join('\n')
    expect(donnees).not.toContain("'Framboisier-")
    expect(donnees).not.toContain("'Olivier-")
    expect(donnees).toContain("'Meeker'")
  })
})
