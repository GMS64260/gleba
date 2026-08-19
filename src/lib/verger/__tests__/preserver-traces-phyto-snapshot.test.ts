/**
 * Lien entre une trace phyto détachée et l'arbre supprimé qui l'a portée —
 * ticket cmsx6acih (QA 2026-08-17).
 *
 * `Intervention.arbreId` est remis à NULL à la suppression de l'arbre : la note
 * snapshotée est le SEUL lien restant. Le registre du verger la relit pour
 * continuer d'afficher la trace, comme la suppression le promet. Écriture et
 * lecture doivent donc rester symétriques.
 */

import { describe, it, expect } from 'vitest'
import {
  PREFIXE_ARBRE_SUPPRIME,
  arbreSupprimeDansNotes,
  noteArbreSupprime,
} from '../preserver-traces-phyto'

describe('noteArbreSupprime / arbreSupprimeDansNotes', () => {
  it('relit l’identité qu’elle a écrite, espèce comprise', () => {
    const note = noteArbreSupprime({ id: 1, nom: 'QA Hélène v7c Jonagold', espece: 'Pommier' })
    expect(note).toBe(`${PREFIXE_ARBRE_SUPPRIME}QA Hélène v7c Jonagold (Pommier)]`)
    expect(arbreSupprimeDansNotes(note)).toBe('QA Hélène v7c Jonagold (Pommier)')
  })

  it('relit une identité sans espèce renseignée', () => {
    const note = noteArbreSupprime({ id: 2, nom: 'Arbre nu', espece: null })
    expect(arbreSupprimeDansNotes(note)).toBe('Arbre nu')
  })

  it('reconnaît la note même suivie des notes d’origine', () => {
    const note = `${noteArbreSupprime({ id: 3, nom: 'Cerisier A', espece: 'Cerisier' })}\nOpérateur : Hélène`
    expect(arbreSupprimeDansNotes(note)).toBe('Cerisier A (Cerisier)')
  })

  it('ne voit pas d’arbre supprimé dans une note ordinaire', () => {
    expect(arbreSupprimeDansNotes(null)).toBeNull()
    expect(arbreSupprimeDansNotes('')).toBeNull()
    expect(arbreSupprimeDansNotes('Traitement de printemps')).toBeNull()
    // Le marqueur ne compte que sur la PREMIÈRE ligne, là où il est écrit.
    expect(arbreSupprimeDansNotes(`Note libre\n${PREFIXE_ARBRE_SUPPRIME}Pommier]`)).toBeNull()
  })
})
