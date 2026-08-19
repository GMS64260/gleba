/**
 * Invariant « un type d'espèce ne s'affiche jamais sans libellé ».
 *
 * Ticket FB-E33FAA (2026-08-18) — la Vigie a signalé que
 * /maraichage/especes/new n'affichait aucun libellé lisible pour `ornement`.
 * Cause : l'écran itérait ESPECE_TYPES (sept valeurs) mais labellisait via une
 * carte LOCALE de six entrées, donc rendait une option VIDE. Quatre écrans du
 * référentiel portaient la même carte recopiée ; une seule avait reçu le
 * libellé « Ornement » (feedback cmpm71z5s, mai 2026), et le correctif n'a
 * jamais atteint les autres. Deux mois et demi plus tard, le même défaut était
 * re-signalé ailleurs.
 *
 * Leçon du vault appliquée ici : une correction n'est acquise que si l'ancien
 * chemin devient impossible. Ces tests interdisent donc la carte locale, en
 * plus de vérifier l'exhaustivité de la SSOT.
 */

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  ESPECE_TYPES,
  ESPECE_TYPE_DESCRIPTIONS,
  ESPECE_TYPE_LABELS,
  UNITE_RENDEMENT,
  createEspeceSchema,
  formatRendement,
  libelleUniteRendement,
  uniteRendementParType,
  updateEspeceSchema,
} from '../espece'

/** Écrans qui touchent au type d'une espèce, à quelque titre que ce soit. */
const ECRANS_TYPE_ESPECE = [
  'src/app/maraichage/especes/new/page.tsx',
  'src/app/maraichage/especes/page.tsx',
  'src/app/maraichage/especes/[id]/page.tsx',
  'src/app/referentiel/page.tsx',
  'src/components/potager/ReferentielTab.tsx',
  'src/components/especes/NouvelleEspecePersoDialog.tsx',
  // 5e chemin du même défaut : le badge de type y affichait
  // `type.replace('_',' ')`, donc le slug à peine déguisé. Aligné sur le helper
  // partagé le 2026-08-18, et gardé ici pour qu'il ne reparte pas.
  'src/components/especes/EspeceCombobox.tsx',
]

/**
 * Ceux qui RENDENT un libellé de type (colonne, badge, option, sous-titre).
 * La fiche `especes/[id]` en est absente à dessein : elle n'affiche pas le type,
 * elle s'en sert seulement pour déduire l'unité du rendement — d'où l'assertion
 * dédiée plus bas. Écart connu, hors périmètre de ce ticket : la fiche d'une
 * espèce ne montre donc nulle part son type, et ne permet pas de le corriger.
 */
const ECRANS_AFFICHANT_LE_TYPE = ECRANS_TYPE_ESPECE.filter(
  (chemin) => chemin !== 'src/app/maraichage/especes/[id]/page.tsx'
)

/** Espèce minimale valide, pour n'éprouver qu'un champ à la fois. */
const especeMinimale = { id: 'Zinnia', type: 'fleur', vivace: false, aPlanifier: true } as const

describe("libellés des types d'espèce", () => {
  it('chaque type du référentiel a un libellé et une description', () => {
    for (const type of ESPECE_TYPES) {
      expect(ESPECE_TYPE_LABELS[type], `libellé manquant pour ${type}`).toBeTruthy()
      expect(ESPECE_TYPE_DESCRIPTIONS[type], `description manquante pour ${type}`).toBeTruthy()
    }
  })

  it('ornement est nommé, puisque le catalogue en contient', () => {
    // Sept ligneux d'agrément en production (Albizia, Bambou, Frêne, Tilleul…) :
    // le type n'est pas théorique, son libellé s'affiche pour de vrai.
    expect(ESPECE_TYPE_LABELS.ornement).toBe('Ornement')
    expect(ESPECE_TYPE_DESCRIPTIONS.ornement).toContain('planche')
  })

  it("aucun écran ne réénumère les libellés des types en dur", () => {
    // Signature d'une carte de libellés recopiée : une clé de type suivie d'un
    // libellé littéral (`engrais_vert: 'Engrais vert'`). Les listes d'onglets,
    // légitimement propres à chaque écran, ne matchent pas — elles écrivent
    // `{ value: 'engrais_vert', label: 'Engrais verts' }`.
    const coupables: string[] = []
    for (const relatif of ECRANS_TYPE_ESPECE) {
      const contenu = fs.readFileSync(path.join(process.cwd(), relatif), 'utf8')
      if (/\b(engrais_vert|arbre_fruitier|ornement)\s*:\s*['"]/.test(contenu)) {
        coupables.push(relatif)
      }
    }
    expect(coupables).toEqual([])
  })

  it('chaque écran qui affiche un type passe par le référentiel', () => {
    const orphelins = ECRANS_AFFICHANT_LE_TYPE.filter((relatif) => {
      const contenu = fs.readFileSync(path.join(process.cwd(), relatif), 'utf8')
      return !/libelleTypeEspece|ESPECE_TYPE_LABELS/.test(contenu)
    })
    expect(orphelins).toEqual([])
  })

  it("étiquette une unité absente ou hors canon sans jamais rendre vide", () => {
    expect(libelleUniteRendement('kg_arbre')).toBe('kg/arbre')
    expect(libelleUniteRendement('biomasse_t_ha')).toBe('t/ha')
    expect(libelleUniteRendement(null)).toBe('kg/m²')
    expect(libelleUniteRendement('unite_heritee_inconnue')).toBe('kg/m²')
    // Même moitié « unité » que l'affichage d'un rendement complet.
    expect(formatRendement(150, 'kg_arbre')).toBe('150,0 kg/arbre')
  })

  it("aucun écran ne redérive l'unité de rendement à la main", () => {
    // Trois écrans déduisaient l'unité par un ternaire local sur
    // `type === 'arbre_fruitier'`, ce qui étiquetait les engrais verts en kg/m².
    const coupables = ECRANS_TYPE_ESPECE.filter((relatif) => {
      const contenu = fs.readFileSync(path.join(process.cwd(), relatif), 'utf8')
      return /['"]kg\/m²['"]|kg\/arbre['"]/.test(contenu)
    })
    expect(coupables).toEqual([])
  })
})

describe("unité de rendement d'une espèce", () => {
  it('chaque type a une unité, et cette unité existe', () => {
    for (const type of ESPECE_TYPES) {
      expect(UNITE_RENDEMENT).toContain(uniteRendementParType(type))
    }
  })

  it("suit la convention documentée (docs/conventions.md)", () => {
    expect(uniteRendementParType('arbre_fruitier')).toBe('kg_arbre')
    expect(uniteRendementParType('engrais_vert')).toBe('biomasse_t_ha')
    expect(uniteRendementParType('fleur')).toBe('kg_m2')
    expect(uniteRendementParType('legume')).toBe('kg_m2')
    expect(uniteRendementParType('ornement')).toBe('kg_m2')
    // Un type inconnu (donnée héritée) reste lisible plutôt que de casser.
    expect(uniteRendementParType(null)).toBe('kg_m2')
  })
})

describe('plausibilité du rendement, par unité', () => {
  it('accepte un rendement par arbre au-delà de 100 kg', () => {
    // Le catalogue lui-même porte 150 kg/arbre (arbre à pain) et 100
    // (avocatier), entrés par migration donc jamais passés par zod : la borne
    // uniforme à 100 interdisait à l'utilisateur de déclarer le sien.
    const r = createEspeceSchema.safeParse({
      ...especeMinimale,
      type: 'arbre_fruitier',
      rendement: 150,
    })
    expect(r.success).toBe(true)
  })

  it('refuse un rendement au mètre carré invraisemblable', () => {
    const r = createEspeceSchema.safeParse({ ...especeMinimale, rendement: 150 })
    expect(r.success).toBe(false)
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path.join('.') === 'rendement')
      expect(issue?.message).toContain('kg/m²')
    }
  })

  it("borne selon l'unité EXPLICITE du payload quand elle est fournie", () => {
    const r = createEspeceSchema.safeParse({
      ...especeMinimale,
      type: 'fleur',
      uniteRendement: 'kg_arbre',
      rendement: 150,
    })
    expect(r.success).toBe(true)
  })

  it("ne rejette pas un PATCH de rendement qui n'établit aucune unité", () => {
    // `updateEspeceSchema` est un `.partial()` : l'unité vit en base, pas dans
    // le payload. Deviner « kg/m² » y refuserait la correction de rendement
    // d'un arbre fruitier — soit le cas même que la borne existe pour ouvrir.
    const r = updateEspeceSchema.safeParse({ rendement: 150 })
    expect(r.success).toBe(true)
  })

  it('garde un plafond absolu pour les saisies aberrantes', () => {
    expect(updateEspeceSchema.safeParse({ rendement: 100000 }).success).toBe(false)
  })
})
