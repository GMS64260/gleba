/**
 * Invariant « une production florale reste visible ».
 *
 * Ticket FB-PMWX8O (2026-08-18) : une ferme florale s'est vu répondre que Gleba
 * ne savait pas gérer de catégorie « fleur ». Le type manquait, mais surtout
 * chaque écran de maraîchage réénumérait le triplet historique
 * `['legume','aromatique','engrais_vert']` dans son filtre. Ajouter un type au
 * référentiel sans reprendre ces listes le rend invisible en silence : l'espèce
 * existe, se crée, et ne se retrouve nulle part.
 *
 * Ce test verrouille les deux moitiés du correctif — la SSOT des types conduits
 * sur planche, et l'absence de réénumération en dur dans les filtres.
 */

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ESPECE_TYPES,
  ESPECE_TYPES_MARAICHAGE,
  ESPECE_TYPE_LABELS,
} from '../validations/espece'

const RACINE_SRC = path.join(process.cwd(), 'src')

function fichiersSource(racine: string): string[] {
  const trouves: string[] = []
  for (const entree of fs.readdirSync(racine, { withFileTypes: true })) {
    const complet = path.join(racine, entree.name)
    if (entree.isDirectory()) {
      if (entree.name === 'node_modules' || entree.name === '__tests__') continue
      trouves.push(...fichiersSource(complet))
    } else if (/\.(ts|tsx)$/.test(entree.name) && !entree.name.includes('.test.')) {
      trouves.push(complet)
    }
  }
  return trouves
}

describe('type d\'espèce « fleur »', () => {
  it('appartient au référentiel et porte un libellé', () => {
    expect(ESPECE_TYPES).toContain('fleur')
    expect(ESPECE_TYPE_LABELS.fleur).toBe('Fleur')
  })

  it('est conduit sur planche, comme les légumes', () => {
    expect(ESPECE_TYPES_MARAICHAGE).toContain('fleur')
    for (const type of ESPECE_TYPES_MARAICHAGE) {
      expect(ESPECE_TYPES).toContain(type)
    }
  })

  it('chaque type du référentiel a un libellé', () => {
    for (const type of ESPECE_TYPES) {
      expect(ESPECE_TYPE_LABELS[type]).toBeTruthy()
    }
  })

  it('les ligneux d\'agrément restent hors du maraîchage', () => {
    // `ornement` porte les arbres et arbustes d'agrément du verger (Albizia,
    // Bambou, Frêne, Tilleul) : ils ne se cultivent pas sur planche.
    expect(ESPECE_TYPES_MARAICHAGE as readonly string[]).not.toContain('ornement')
    expect(ESPECE_TYPES_MARAICHAGE as readonly string[]).not.toContain('arbre_fruitier')
    expect(ESPECE_TYPES_MARAICHAGE as readonly string[]).not.toContain('petit_fruit')
  })

  it('aucun filtre ne réénumère le triplet historique en dur', () => {
    const motifs = [
      /\[\s*'legume'\s*,\s*'aromatique'\s*,\s*'engrais_vert'\s*\]/,
      /\[\s*"legume"\s*,\s*"aromatique"\s*,\s*"engrais_vert"\s*\]/,
    ]
    const coupables = fichiersSource(RACINE_SRC).filter((fichier) => {
      const contenu = fs.readFileSync(fichier, 'utf8')
      return motifs.some((motif) => motif.test(contenu))
    })
    expect(coupables.map((f) => path.relative(process.cwd(), f))).toEqual([])
  })

  it('le sélecteur d\'espèce expose un onglet par type de maraîchage', () => {
    const source = fs.readFileSync(
      path.join(RACINE_SRC, 'components', 'especes', 'EspeceCombobox.tsx'),
      'utf8'
    )
    const bloc = source.slice(source.indexOf('const TABS'), source.indexOf('// Stockage des'))
    for (const type of ESPECE_TYPES_MARAICHAGE) {
      expect(bloc).toContain(`key: "${type}"`)
    }
  })
})
