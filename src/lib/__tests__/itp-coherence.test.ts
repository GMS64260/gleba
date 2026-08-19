/**
 * Invariants de cohérence de la chaîne ITP.
 *
 * Chaque cas ci-dessous correspond à une incohérence réellement constatée entre
 * deux surfaces de l'application : un même itinéraire n'avait ni le même nom, ni
 * les mêmes semaines, ni les mêmes conditions d'accès selon l'écran ou l'outil
 * qui le lisait. Ces tests verrouillent la règle unique, pas son appelant.
 */

import { describe, expect, it } from 'vitest'

import {
  ZONES_METROPOLE,
  decalageItpPourLecteur,
  decalageItpPourZone,
  itpApplicableAZone,
} from '@/lib/calendrier-climat'
import { whereItpApplicable, whereItpUtilisable } from '@/lib/itp-acces'
import { fenetreItp, nomAffichableItp, nomAffichableItpAvecFenetre } from '@/lib/itp-label'
import { nomItpDepuisSaisie } from '@/lib/itp-nom'
import { normalizeReferentielKey } from '@/lib/normalize'
import { ZONES_CLIMAT, zoneClimatiqueDepuisCodePostal } from '@/lib/terroir'

describe("nom affiché d'un ITP", () => {
  it("rend tel quel le libellé saisi par un membre, tirets compris", () => {
    // QA cmswxyuoi : le serveur conserve le libellé, mais le sélecteur d'ITP du
    // formulaire de culture le repassait dans `libelleItp` et affichait
    // « Marc · v7 · radis · automne · 2026 ».
    expect(
      nomAffichableItp({
        id: 'cmswxxflj001cz0uv7rgv7wof',
        nom: 'MARC-V7-Radis-automne-2026',
        userId: 'user-1',
      })
    ).toBe('MARC-V7-Radis-automne-2026')
  })

  it('rend lisible un slug technique du catalogue officiel', () => {
    expect(nomAffichableItp({ id: 'Radis-ete-serre', nom: 'Radis-ete-serre', userId: null })).toBe(
      'Radis · été · serre'
    )
  })

  it("n'abîme pas un libellé officiel déjà rédigé en français", () => {
    // 648 des 770 entrées officielles sont des phrases contenant des traits
    // d'union internes (« Chou-fleur ») : les découper cassait le nom.
    expect(
      nomAffichableItp({
        id: 'INRAE-MESCLUN-0110',
        nom: 'Chou-fleur · CHOUX FLEUR — plein champ',
        userId: null,
      })
    ).toBe('Chou-fleur · CHOUX FLEUR — plein champ')
  })

  it('retire les semaines de la source figées dans le libellé officiel', () => {
    // 529 libellés d'import portent « — implantation S27–S31 · S53–S52 ». Ces
    // semaines sont celles de la SOURCE : affichées à côté d'une colonne qui
    // montre les semaines recalées sur la zone, elles se contredisaient.
    expect(
      nomAffichableItp({
        id: 'INRAE-MESCLUN-0110',
        nom: 'Chou-fleur · CHOUX FLEUR — plein champ — implantation S27–S31 · S53–S52',
        userId: null,
      })
    ).toBe('Chou-fleur · CHOUX FLEUR — plein champ')
  })

  it("ne retouche pas le libellé d'un membre, même s'il ressemble à un import", () => {
    const nom = 'Mon radis — implantation S12'
    expect(nomAffichableItp({ id: 'cmperso', nom, userId: 'user-1' })).toBe(nom)
  })

  it('distingue deux scénarios par leur fenêtre courante, pas par le libellé figé', () => {
    // Trois « Concombre — sous abri » ne diffèrent que par leur calendrier :
    // sans fenêtre recalculée, la liste déroulante offrait trois lignes
    // identiques.
    const base = {
      id: 'INRAE-MESCLUN-0113',
      nom: 'Concombre — sous abri — implantation S18–S20 · S24–S35',
      userId: null,
    }
    expect(
      nomAffichableItpAvecFenetre({
        ...base,
        semaineImplantationDebut: 19,
        semaineImplantationFin: 21,
      })
    ).toBe('Concombre — sous abri · impl. S19–S21')
    expect(
      nomAffichableItpAvecFenetre({
        ...base,
        semaineImplantationDebut: 23,
        semaineImplantationFin: 25,
      })
    ).toBe('Concombre — sous abri · impl. S23–S25')
  })

  it("retombe sur le semis quand aucune fenêtre d'implantation n'est renseignée", () => {
    expect(fenetreItp({ semaineSemis: 10, semaineImplantationDebut: null })).toBe('S10')
    expect(fenetreItp({ semaineImplantationDebut: 12, semaineImplantationFin: 12 })).toBe('S12')
    expect(fenetreItp({})).toBeNull()
  })

  it("reconstruit depuis l'espèce les identifiants techniques historiques", () => {
    expect(
      nomAffichableItp({
        id: 'ITP-AIL-01',
        nom: null,
        userId: null,
        espece: { id: 'Ail', nom: 'Ail', couleur: null },
        modeDemarrage: 'Plantation',
      })
    ).toBe('Ail — plantation')
  })

  it("retombe sur l'identifiant quand aucun nom n'est disponible", () => {
    expect(nomAffichableItp({ id: 'Aneth', nom: null, userId: null })).toBe('Aneth')
  })
})

describe('libellé et clé de dédup', () => {
  it('conserve la ponctuation du libellé et la retire de la clé', () => {
    expect(nomItpDepuisSaisie('  TEST-Marc-Phacélie-v7  ')).toEqual({
      nom: 'TEST-Marc-Phacélie-v7',
      nomNormalise: 'test marc phacelie v7',
    })
  })

  it('donne la même clé à deux graphies du même nom', () => {
    expect(nomItpDepuisSaisie('Carotte-Nantaise').nomNormalise).toBe(
      nomItpDepuisSaisie('carotte nantaise').nomNormalise
    )
  })

  /**
   * Contrat JS ↔ SQL. Les valeurs attendues ont été produites par la fonction
   * `gleba_cle_referentiel` sur la base réelle (migration
   * `cle_referentiel_formule_unique`) : elles pinnent l'égalité des deux
   * formules sur les libellés qui les faisaient précisément diverger — tiret
   * cadratin des imports INRAE et fleurs coupées, point médian, apostrophe
   * courbe.
   */
  it.each([
    ['Rudbeckie — plein champ', 'rudbeckie plein champ'],
    [
      'Chou-fleur · CHOUX FLEUR — plein champ — implantation S27–S31 · S53–S52',
      'chou fleur · choux fleur plein champ implantation s27 s31 · s53 s52',
    ],
    ['Ail-printemps', 'ail printemps'],
    ['Mâche-automne', 'mache automne'],
    ['Chou chinois · Choux chinois Pack Choï — sous abri forcé', 'chou chinois · choux chinois pack choi sous abri force'],
    ['Pois d’hiver', "pois d'hiver"],
  ])('reproduit la clé SQL pour « %s »', (nom, attendu) => {
    expect(normalizeReferentielKey(nom)).toBe(attendu)
  })
})

describe('calage climatique du lecteur', () => {
  it("n'applique aucun décalage à l'ITP personnel sans zone lu par son auteur", () => {
    const itp = { zoneClimat: null, userId: 'user-1' }
    expect(decalageItpPourLecteur(itp, 'montagnard', 'user-1')).toBe(0)
  })

  it("transpose le même ITP pour un autre lecteur", () => {
    const itp = { zoneClimat: null, userId: 'user-1' }
    expect(decalageItpPourLecteur(itp, 'montagnard', 'user-2')).toBe(3)
  })

  it("transpose un ITP personnel qui porte une zone, même pour son auteur", () => {
    const itp = { zoneClimat: 'oceanique', userId: 'user-1' }
    expect(decalageItpPourLecteur(itp, 'montagnard', 'user-1')).toBe(4)
  })

  it('vaut le calage source→cible pour le catalogue officiel', () => {
    const itp = { zoneClimat: 'oceanique', userId: null }
    expect(decalageItpPourLecteur(itp, 'semi_continental', 'user-1')).toBe(
      decalageItpPourZone('oceanique', 'semi_continental')
    )
  })

  it('reste neutre quand la zone du lecteur est indéterminée', () => {
    // Code postal hors format ou absent : aucune zone, donc aucun décalage —
    // et surtout pas une zone devinée.
    expect(decalageItpPourLecteur({ zoneClimat: 'oceanique', userId: null }, null, 'user-1')).toBe(0)
  })
})

describe("règles d'accès à un ITP", () => {
  it('exige à la fois le service et la visibilité', () => {
    const where = whereItpUtilisable('user-1')
    expect(where.AND[0]).toEqual({ actif: true })
    expect(where.AND[1]).toEqual({
      OR: [{ userId: null }, { partageCommunaute: true }, { userId: 'user-1' }],
    })
  })

  it("le filtre serveur de zone reflète exactement la règle client", () => {
    for (const zone of ZONES_CLIMAT) {
      const where = whereItpApplicable(zone) as {
        zoneClimat?: unknown
        OR?: { zoneClimat: unknown }[]
      }
      if (where.OR) {
        // Métropole : générique + zones métropolitaines, jamais les tropicaux.
        const acceptees = [null, ...ZONES_METROPOLE]
        for (const candidate of ZONES_CLIMAT) {
          expect(acceptees.includes(candidate)).toBe(itpApplicableAZone(candidate, zone))
        }
      } else {
        expect(where.zoneClimat).toBe(zone)
        for (const candidate of ZONES_CLIMAT) {
          expect(candidate === zone).toBe(itpApplicableAZone(candidate, zone))
        }
        expect(itpApplicableAZone(null, zone)).toBe(false)
      }
    }
  })

  it('ne recopie pas la liste des zones métropolitaines', () => {
    expect([...ZONES_METROPOLE]).toEqual([
      'oceanique',
      'oceanique_altere',
      'semi_continental',
      'montagnard',
      'mediterraneen',
    ])
  })
})

describe('zone climatique depuis le code postal', () => {
  it('accepte un code postal complet', () => {
    expect(zoneClimatiqueDepuisCodePostal('64000')).not.toBeNull()
    expect(zoneClimatiqueDepuisCodePostal('20200')).toBe('mediterraneen')
  })

  it("refuse de deviner à partir d'un code tronqué", () => {
    // Constaté en prod : « 50 », « 200 », « 2424 ». La zone était pourtant
    // dérivée avec aplomb, et tout le calage ITP en découlait.
    expect(zoneClimatiqueDepuisCodePostal('50')).toBeNull()
    expect(zoneClimatiqueDepuisCodePostal('200')).toBeNull()
    expect(zoneClimatiqueDepuisCodePostal('2424')).toBeNull()
    expect(zoneClimatiqueDepuisCodePostal('')).toBeNull()
    expect(zoneClimatiqueDepuisCodePostal('640000')).toBeNull()
    expect(zoneClimatiqueDepuisCodePostal('6400A')).toBeNull()
  })

  it("garde la dérivation d'outre-mer sur le préfixe à trois chiffres", () => {
    expect(zoneClimatiqueDepuisCodePostal('97400')).toBe('tropical_austral')
    expect(zoneClimatiqueDepuisCodePostal('97100')).toBe('tropical_antilles')
    expect(zoneClimatiqueDepuisCodePostal('97300')).toBe('equatorial')
  })
})
