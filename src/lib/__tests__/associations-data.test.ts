import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { classeAssociation, evaluerAssociations, type AssociationEvaluable } from '@/lib/associations-alertes'

/**
 * Garde-fou sur le référentiel des associations (fichier source du dépôt).
 *
 * Depuis le 2026-11-12 les alertes lisent les lignes de famille : une ligne
 * « famille seule » d'une règle incompatible oppose le pivot à toutes les
 * espèces de la famille. « Romarin ! » déclarait ainsi cinq familles entières
 * incompatibles, « Tomate ! » toutes les Alliaceae. Une incompatibilité se
 * déclare espèce par espèce (ou par groupe nommé, comme « Chou »).
 */
const source = path.join(process.cwd(), 'associations_enriched_v2_2026.json')

type Detail = {
  especeId: string | null
  familleId: string | null
  groupe: string | null
  requise: boolean
  notes: string | null
}
type Regle = { id: string; nom: string; description: string | null; notes: string | null; details: Detail[] }

const regles = (JSON.parse(fs.readFileSync(source, 'utf8')) as { associations: Regle[] }).associations
// Le fichier ne porte pas de `type` : même lecture que la migration 20260514370000.
const estIncompatible = (r: Regle) =>
  r.nom.includes('!') || classeAssociation(null, r.nom) === 'defavorable'
const incompatibles = regles.filter(estIncompatible)

describe('référentiel des associations', () => {
  it('contient des règles incompatibles à vérifier', () => {
    expect(regles.length).toBeGreaterThan(100)
    expect(incompatibles.length).toBeGreaterThan(10)
  })

  it("n'oppose aucune espèce à une famille entière", () => {
    const fautives = incompatibles.flatMap((r) =>
      r.details
        .filter((d) => !d.especeId && !d.groupe?.trim() && d.familleId)
        .map((d) => `${r.nom} (${r.id}) : famille ${d.familleId}`)
    )
    expect(fautives).toEqual([])
  })

  it("ne déclenche aucune alerte d'incompatibilité au niveau d'une famille", () => {
    // Deux espèces fictives par famille citée : seule leur famille peut les relier.
    const familles = Array.from(
      new Set(regles.flatMap((r) => r.details.map((d) => d.familleId).filter((f): f is string => !!f)))
    )
    const pivots = Array.from(
      new Set(incompatibles.flatMap((r) => r.details.filter((d) => d.requise && d.especeId).map((d) => d.especeId as string)))
    )
    const fictives = familles.map((f) => `espece-fictive-${f.toLowerCase()}`)
    const contexte = new Map(fictives.map((id, i) => [id, { nom: id, familleId: familles[i] }]))
    const evaluables: AssociationEvaluable[] = incompatibles.map((r) => ({ ...r, type: 'incompatible' }))
    const alertes = evaluerAssociations(evaluables, [...pivots, ...fictives], contexte).filter(
      (a) => a.niveau === 'famille'
    )
    expect(alertes.map((a) => a.message)).toEqual([])
  })

  it('donne au moins deux membres à chaque règle incompatible, pivot compris', () => {
    expect(incompatibles.filter((r) => r.details.length < 2).map((r) => r.nom)).toEqual([])
  })

  it('donne à « Chou-rave ! » le chou-rave pour pivot (et non le chou-fleur, copié de la règle voisine)', () => {
    const chouRave = regles.find((r) => r.id === 'cml1gbccs001p2vbmmm3in7ji')
    expect(chouRave?.details.filter((d) => d.requise).map((d) => d.especeId)).toEqual(['Chou-rave'])
  })
})
