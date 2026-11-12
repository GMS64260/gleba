/**
 * Schémas de modification sans valeurs par défaut (revue Codex DATA-02, 2026-11-12).
 *
 * Avec zod 4, `.partial()` garde les `.default()` : un champ absent ressortait
 * avec sa valeur par défaut, et la route qui étalait les données l'écrivait.
 */
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { partielSansDefauts } from '../partiel'
import { updateVarieteSchema } from '../variete'
import { updateParcelleSchema } from '../parcelle'
import { updateAssociationSchema } from '../association'
import { updateEspeceSchema } from '../espece'
import { updateITPSchema } from '../itp'
import { updatePlancheSchema } from '../planche'
import { updateCultureSchema } from '../culture'
import { updateSaillieSchema } from '../saillie'
import { updateRotationSchema } from '../rotation'
import { updateRecolteSchema } from '../recolte'

describe('partielSansDefauts', () => {
  const base = z.object({
    nom: z.string().min(1),
    actif: z.boolean().default(true),
    couches: z.array(z.enum(['A', 'B'])).default([]),
    pays: z.string().nullable().default('France'),
    note: z.string().optional().default('x'),
  })
  const maj = partielSansDefauts(base)

  it('laisse absent un champ non envoyé', () => {
    expect(maj.parse({})).toEqual({})
    expect(maj.parse({ nom: 'N' })).toEqual({ nom: 'N' })
  })

  it('garde les contrôles des champs envoyés', () => {
    expect(maj.safeParse({ couches: ['Z'] }).success).toBe(false)
    expect(maj.safeParse({ nom: '' }).success).toBe(false)
    expect(maj.parse({ actif: false, couches: [], pays: null })).toEqual({ actif: false, couches: [], pays: null })
  })

  it('ne modifie pas le schéma de création', () => {
    expect(base.parse({ nom: 'N' })).toEqual({ nom: 'N', actif: true, couches: [], pays: 'France', note: 'x' })
  })
})

describe('schémas de modification', () => {
  it('corriger la note d’une variété ne touche pas à son label bio', () => {
    expect(updateVarieteSchema.parse({ description: 'Note' })).toEqual({ description: 'Note' })
    expect(updateVarieteSchema.parse({ bio: false })).toEqual({ bio: false })
  })

  it('renommer une parcelle ne touche pas à ses ateliers', () => {
    expect(updateParcelleSchema.parse({ nom: 'Nom' })).toEqual({ nom: 'Nom' })
    expect(updateParcelleSchema.parse({ couches: [] })).toEqual({ couches: [] })
  })

  // Inventaire du 2026-11-12 : ces schémas sont écrits champ par champ ou étalés.
  // Quatre schémas comptables (clients, fournisseurs, ventes et dépenses
  // manuelles) gardent leurs défauts : leurs routes filtrent déjà les champs
  // envoyés (`champsReellementEnvoyes`, `champsEnvoyes`). `updateInterventionSchema`
  // (route écrite depuis le corps brut) et `updateCollecteLaitSchema` (drapeau de
  // confirmation jamais écrit) n'en écrivent pas non plus.
  it.each([
    ['updateVarieteSchema', updateVarieteSchema, {}],
    ['updateParcelleSchema', updateParcelleSchema, {}],
    ['updateAssociationSchema', updateAssociationSchema, {}],
    ['updateEspeceSchema', updateEspeceSchema, {}],
    ['updateITPSchema', updateITPSchema, {}],
    ['updatePlancheSchema', updatePlancheSchema, {}],
    ['updateCultureSchema', updateCultureSchema, {}],
    ['updateSaillieSchema', updateSaillieSchema, { id: 'x' }],
    ['updateRotationSchema', updateRotationSchema, {}],
    ['updateRecolteSchema', updateRecolteSchema, {}],
  ] as const)('%s n’ajoute aucun champ absent du corps', (_nom, schema, corps) => {
    expect(Object.keys((schema as z.ZodType).parse(corps) as object)).toEqual(Object.keys(corps))
  })
})
