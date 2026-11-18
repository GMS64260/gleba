import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import {
  CHAMPS_PROPRIETAIRE,
  PERIMETRE_EFFACEMENT,
  controlerPerimetre,
  estModeleZonePrivee,
  type ClassementModele,
  type ModeleDmmf,
} from './perimetre-effacement'

const GRAINE = 20261118
const SCHEMAS = [
  Prisma.dmmf.datamodel.models,
  Prisma.dmmf.datamodel.models.filter((m) => !estModeleZonePrivee(m.name)),
] as const

function generateur() {
  let etat = GRAINE
  return (max: number) => {
    etat = (Math.imul(etat, 1664525) + 1013904223) >>> 0
    return etat % max
  }
}

describe(`invariants du périmètre RGPD — graine ${GRAINE}`, () => {
  it('signale chaque modèle ajouté sans classement, partagé ou propre à un compte (350 schémas)', () => {
    const alea = generateur()
    const champs = ['id', ...CHAMPS_PROPRIETAIRE]
    for (let i = 0; i < 350; i++) {
      const schema: ModeleDmmf[] = [...SCHEMAS[alea(SCHEMAS.length)]]
      const nom = `ModeleAjoute${i}`
      const champ = champs[alea(champs.length)]
      schema.splice(alea(schema.length + 1), 0, { name: nom, fields: [{ name: champ, kind: 'scalar', type: 'String' }] })
      expect(controlerPerimetre(schema), `ajout ${i}`).toEqual([{
        modele: nom,
        probleme: champ === 'id' ? 'n’est pas classé' : 'porte un propriétaire et n’est pas classé',
      }])
    }
  })

  it('refuse de laisser hors périmètre un modèle partagé qui acquiert un propriétaire (350 schémas)', () => {
    const alea = generateur()
    const perimetre: Readonly<Record<string, ClassementModele>> = PERIMETRE_EFFACEMENT
    const champs = [
      ...CHAMPS_PROPRIETAIRE.map((name) => ({ name, kind: 'scalar', type: 'String' })),
      { name: 'responsable', kind: 'object', type: 'User' },
    ]
    for (let i = 0; i < 350; i++) {
      const schema: readonly ModeleDmmf[] = SCHEMAS[alea(SCHEMAS.length)]
      const partages = schema.filter((m) => perimetre[m.name]?.categorie === 'hors_perimetre')
      const modele = partages[alea(partages.length)]
      const champ = champs[alea(champs.length)]
      const modifie = schema.map((m) => m.name === modele.name ? { ...m, fields: [...m.fields, champ] } : m)
      expect(controlerPerimetre(modifie), `${i} : ${modele.name}.${champ.name}`).toEqual([{
        modele: modele.name,
        probleme: 'porte un propriétaire mais est déclaré hors périmètre',
      }])
    }
  })
})
