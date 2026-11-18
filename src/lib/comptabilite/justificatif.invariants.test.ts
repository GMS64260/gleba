import { describe, expect, it } from 'vitest'
import { createVenteManuelleSchema, updateVenteManuelleSchema } from '@/lib/validations/vente-manuelle'
import { createDepenseManuelleSchema, updateDepenseManuelleSchema } from '@/lib/validations/depense-manuelle'
import { estCheminJustificatif, estNomJustificatif } from './justificatif'

const GRAINE = 20261118
const schemas = [createVenteManuelleSchema, updateVenteManuelleSchema, createDepenseManuelleSchema, updateDepenseManuelleSchema]

function generateur() {
  let etat = GRAINE
  return (borne: number) => {
    etat = (Math.imul(etat, 1664525) + 1013904223) >>> 0
    return Math.floor((etat / 0x100000000) * borne)
  }
}

describe(`Invariants des justificatifs comptables — graine ${GRAINE}`, () => {
  it('360 chemins UUID v4 : acceptation et conservation exacte par les quatre schémas, refus des détournements', () => {
    const suivant = generateur()
    const vus = new Set<string>()
    for (let essai = 0; essai < 360; essai++) {
      const hex = (taille: number) => Array.from({ length: taille }, () => suivant(16).toString(16)).join('')
      const uuid = `${hex(8)}-${hex(4)}-4${hex(3)}-${(8 + suivant(4)).toString(16)}${hex(3)}-${hex(12)}`
      const extension = ['pdf', 'jpg', 'png'][essai % 3]
      const nom = `${uuid}.${extension}`
      // Valeur indépendante du helper : contrat exact émis par l’upload.
      const chemin = `/api/upload/justificatif/${nom}`
      vus.add(chemin)
      const corps = { id: essai + 1, description: 'Pièce fictive', categorie: 'autre', montant: suivant(100000) / 100, tauxTVA: 0, paye: false }
      expect(estNomJustificatif(nom)).toBe(true)
      expect(estCheminJustificatif(chemin)).toBe(true)
      for (const schema of schemas) {
        expect(schema.parse({ ...corps, pjUrl: chemin })).toMatchObject({ pjUrl: chemin, montant: corps.montant, tauxTVA: 0, paye: false })
      }
      const detournements = [
        `/api/upload/photo/${nom}`, `/api/upload/justificatifX/${nom}`, `api/upload/justificatif/${nom}`,
        `https://fictif.invalid${chemin}`, `//fictif.invalid${chemin}`, `javascript:${chemin}`, `data:${chemin}`,
        `/api/upload/justificatif/../${nom}`, `/api/upload/justificatif/%2e%2e%2f${nom}`,
        `/api/upload/justificatif/%252e%252e%252f${nom}`, `/api/upload/justificatif/dossier/${nom}`,
        `/api/upload/justificatif/..\\${nom}`, `/api/upload/justificatif/${uuid}.svg`,
        `/api/upload/justificatif/${uuid}.jpeg`, `${chemin}.html`, `${chemin}?x=${essai}`, `${chemin}#fragment`, `${chemin}\n`,
        `/api/upload/justificatif/${uuid.slice(0, 14)}1${uuid.slice(15)}.${extension}`,
        `/api/upload/justificatif/${uuid.slice(0, 19)}7${uuid.slice(20)}.${extension}`,
      ]
      for (const pjUrl of detournements) {
        expect(estCheminJustificatif(pjUrl), `essai ${essai} : ${pjUrl}`).toBe(false)
        for (const schema of schemas) expect(schema.safeParse({ ...corps, pjUrl }).success, pjUrl).toBe(false)
      }
    }
    expect(vus.size).toBe(360)
  })
})
